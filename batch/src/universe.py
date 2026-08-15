"""JPX「東証上場銘柄一覧」Excel から銘柄マスタを組み立てる。"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path

import pandas as pd
import requests

from . import config

logger = logging.getLogger(__name__)

# ダウンロードしたファイルが期待どおりの銘柄一覧かを確かめるための列。
_REQUIRED_COLUMNS = {"日付", "コード", "銘柄名", "市場・商品区分", "33業種区分"}

# 証券コードは 4 文字。従来は数字 4 桁のみだったが、JPX は 2024 年以降の新規上場に
# 「130A」のような英数字コードを割り当てている（例: 141A トライアルホールディングス）。
# 数字だけに限定すると実在の上場企業を 140 社以上取りこぼすため、英数字を許容する。
_CODE_PATTERN = re.compile(r"^[0-9A-Z]{4}$")


@dataclass(frozen=True)
class MasterStock:
    """銘柄マスタ 1 行。"""

    code: str
    name: str
    market: str  # 「プライム」「スタンダード」「グロース」に正規化済み
    sector: str
    size_category: str


def _resolve_source(allow_download: bool) -> Path:
    """使用する Excel ファイルを決める。ダウンロードを試し、駄目なら手元のファイル。"""
    if allow_download:
        if _download_latest():
            return config.JPX_EXCEL_CACHE
        reason = "ダウンロードできなかったため"
    else:
        reason = "--no-download が指定されたため"

    # 前回の実行でダウンロード済みのものが残っていればそれを使う。
    if config.JPX_EXCEL_CACHE.exists():
        logger.warning("%s、前回取得した銘柄一覧を使います", reason)
        return config.JPX_EXCEL_CACHE

    if config.JPX_EXCEL_BUNDLED.exists():
        logger.warning("%s、同梱の銘柄一覧を使います（内容が古い可能性があります）", reason)
        return config.JPX_EXCEL_BUNDLED

    raise FileNotFoundError(
        "JPX銘柄一覧を取得できず、代替ファイルもありません。\n"
        "https://www.jpx.co.jp/markets/statistics-equities/misc/01.html から "
        f"data_j.xls をダウンロードし、{config.JPX_EXCEL_BUNDLED} に配置してください。"
    )


def _download_latest() -> bool:
    """JPX から最新の銘柄一覧を取得してキャッシュに保存する。

    ダウンロードそのものが成功しても、メンテナンス中の HTML が返るような
    ケースがあるため、Excel として読めることを確認してから確定させる。
    """
    logger.info("JPXから最新の銘柄一覧を取得します: %s", config.JPX_EXCEL_URL)
    try:
        response = requests.get(
            config.JPX_EXCEL_URL,
            timeout=config.JPX_DOWNLOAD_TIMEOUT_SEC,
            headers={"User-Agent": "jp-dividend-top30 (batch)"},
        )
        response.raise_for_status()
    except Exception as exc:
        logger.warning("銘柄一覧のダウンロードに失敗しました: %s", exc)
        return False

    content = response.content
    if len(content) < config.JPX_MIN_FILE_BYTES:
        logger.warning(
            "ダウンロードしたファイルが小さすぎます（%d バイト）。破棄します", len(content)
        )
        return False

    config.JPX_EXCEL_CACHE.parent.mkdir(parents=True, exist_ok=True)
    # 検証前のデータで既存のキャッシュを壊さないよう、一時ファイル経由で置き換える。
    temporary = config.JPX_EXCEL_CACHE.with_suffix(".xls.tmp")
    temporary.write_bytes(content)

    try:
        preview = pd.read_excel(temporary, dtype=str, nrows=5)
        missing = _REQUIRED_COLUMNS - set(preview.columns)
        if missing:
            raise ValueError(f"必要な列がありません: {sorted(missing)}")
    except Exception as exc:
        logger.warning("ダウンロードしたファイルを解析できませんでした: %s", exc)
        temporary.unlink(missing_ok=True)
        return False

    temporary.replace(config.JPX_EXCEL_CACHE)
    logger.info("最新の銘柄一覧を取得しました（%d バイト）", len(content))
    return True


def _clean(value: object) -> str:
    """Excel のセルを文字列に正規化する。JPX は欠損を "-" で埋めている。"""
    text = str(value).strip()
    return "" if text in ("-", "nan", "None") else text


def load_universe(
    excel_path: Path | None = None, allow_download: bool = True
) -> tuple[list[MasterStock], str]:
    """銘柄一覧を読み、対象となる普通株のリストと基準日を返す。

    既定では JPX から最新版をダウンロードする。取得できない場合は
    リポジトリ同梱のファイルにフォールバックする。

    Returns:
        (銘柄リスト, 基準日 "YYYY-MM-DD")
    """
    path = excel_path or _resolve_source(allow_download)

    # コードは "1301" のようなゼロ埋めがあり得るため、必ず文字列として読む。
    df = pd.read_excel(path, dtype=str)
    logger.info("JPX銘柄一覧を読み込みました: %d 行", len(df))

    master_date = _parse_master_date(df)

    stocks: list[MasterStock] = []
    for _, row in df.iterrows():
        raw_market = _clean(row.get("市場・商品区分"))
        market = config.TARGET_MARKETS.get(raw_market)
        if market is None:
            # ETF・ETN・REIT・インフラファンド・外国株・PRO Market・出資証券
            continue

        code = _clean(row.get("コード"))
        if not _CODE_PATTERN.match(code):
            # 4 文字ちょうどを条件にすることで、優先株・種類株（伊藤園第1種優先株式の
            # 25935 など、コードが 5 桁）が自動的に除外される。
            continue

        stocks.append(
            MasterStock(
                code=code,
                name=_clean(row.get("銘柄名")),
                market=market,
                sector=_clean(row.get("33業種区分")) or "その他",
                size_category=_clean(row.get("規模区分")),
            )
        )

    skipped = len(df) - len(stocks)
    logger.info("対象の普通株: %d 銘柄（除外 %d 件）", len(stocks), skipped)
    return stocks, master_date


def _parse_master_date(df: pd.DataFrame) -> str:
    """「日付」列（YYYYMMDD 文字列）から基準日を取り出す。"""
    if "日付" not in df.columns:
        return ""
    values = df["日付"].dropna().astype(str)
    if values.empty:
        return ""
    raw = values.iloc[0].strip()
    if len(raw) == 8 and raw.isdigit():
        return f"{raw[:4]}-{raw[4:6]}-{raw[6:]}"
    return raw
