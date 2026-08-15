"""TOP30 の各銘柄について、業績関連のニュース見出しを集める。

Google ニュースの RSS を銘柄名で検索している。日本語で、決算発表の直後にも
追随できる情報源が他に見つからなかったため。実測での比較:

    yfinance の Ticker.news … 青山商事は 0 件。KDDI は 10 件あるが Coincheck や
                              BMW の記事で本人と無関係。すべて英語。使えない。
    Google ニュース RSS      … TOP30 の全銘柄で 11〜62 件。日本語で決算記事が並ぶ。

**この RSS は Google が公式に文書化した API ではない。** 予告なく仕様が変わったり
遮断されたりする可能性がある。そのためニュースの取得失敗はバッチ全体を止めず、
空リストを返して先に進む（画面側もニュース欄を出さないだけで成立する）。

取得は 1 日 1 回・30 銘柄だけなので、相手への負荷は小さい。
"""

from __future__ import annotations

import logging
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

from . import config

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class NewsItem:
    title: str
    url: str
    source: str
    publishedAt: str  # ISO8601（日付のみ）


def fetch_for(code: str, name: str) -> list[NewsItem]:
    """1 銘柄分のニュースを取得する。失敗しても例外は投げない。"""
    try:
        raw = _get(_build_url(name))
        items = ET.fromstring(raw).findall(".//item")
    except (urllib.error.URLError, ET.ParseError, OSError) as exc:
        logger.debug("%s のニュース取得に失敗しました: %s", code, exc)
        return []

    collected: list[NewsItem] = []
    for item in items:
        parsed = _to_news_item(item)
        if parsed is None:
            continue
        collected.append(parsed)
        if len(collected) >= config.NEWS_PER_STOCK:
            break
    return collected


def attach(stocks: list) -> int:
    """TOP30 の各銘柄にニュースを付与する。付与できた銘柄数を返す。"""
    logger.info("ニュースを取得します（%d 銘柄）", len(stocks))
    filled = 0
    for stock in stocks:
        items = fetch_for(stock.code, stock.name)
        stock.news = [item.__dict__ for item in items]
        if items:
            filled += 1
        time.sleep(config.NEWS_INTERVAL_SEC)

    if filled < len(stocks):
        logger.info("ニュースを取得できなかった銘柄: %d 件", len(stocks) - filled)
    logger.info("ニュース取得完了: %d/%d 銘柄", filled, len(stocks))
    return filled


def _build_url(name: str) -> str:
    # JPX の銘柄名は全角英数字（例: Ｈａｍｅｅ）なので、検索前に半角へ寄せる。
    # 社名を引用符で括り、「決算」を添えて業績関連に寄せている。社名だけだと
    # 同名の別法人や商品名の記事が混ざる。
    normalized = unicodedata.normalize("NFKC", name).replace("　", " ").strip()
    query = urllib.parse.quote(f'"{normalized}" 決算')
    return f"https://news.google.com/rss/search?q={query}&hl=ja&gl=JP&ceid=JP:ja"


def _get(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": config.NEWS_USER_AGENT})
    with urllib.request.urlopen(request, timeout=config.NEWS_TIMEOUT_SEC) as response:
        return response.read()


def _to_news_item(item: ET.Element) -> NewsItem | None:
    title = (item.findtext("title") or "").strip()
    url = (item.findtext("link") or "").strip()
    if not title or not url:
        return None

    # 「◯◯(株)【1234】：決算情報 - Yahoo!ファイナンス」は記事ではなく銘柄ページで、
    # 毎回必ず先頭に来る。これを残すと 3 枠のうち 1 枠が常に潰れる。
    if "：決算情報" in title:
        return None

    # RSS の title は「見出し - 媒体名」の形。媒体名は別に持たせたいので割る。
    source = (item.findtext("source") or "").strip()
    if source and title.endswith(f" - {source}"):
        title = title[: -len(f" - {source}")].strip()

    return NewsItem(
        title=title,
        url=url,
        source=source or "不明",
        publishedAt=_to_date(item.findtext("pubDate")),
    )


def _to_date(raw: str | None) -> str:
    """RFC822 の日時を JST の日付（YYYY-MM-DD）にする。"""
    if not raw:
        return ""
    try:
        parsed = parsedate_to_datetime(raw)
    except (TypeError, ValueError):
        return ""
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(config.JST).date().isoformat()
