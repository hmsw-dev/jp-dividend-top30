"""JPX「東証上場銘柄一覧」Excel から銘柄マスタを組み立てる。"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from . import config

logger = logging.getLogger(__name__)

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


def _clean(value: object) -> str:
    """Excel のセルを文字列に正規化する。JPX は欠損を "-" で埋めている。"""
    text = str(value).strip()
    return "" if text in ("-", "nan", "None") else text


def load_universe(excel_path: Path | None = None) -> tuple[list[MasterStock], str]:
    """Excel を読み、対象となる普通株のリストと基準日を返す。

    Returns:
        (銘柄リスト, 基準日 "YYYY-MM-DD")
    """
    path = excel_path or config.JPX_EXCEL
    if not path.exists():
        raise FileNotFoundError(
            f"JPX銘柄一覧が見つかりません: {path}\n"
            "https://www.jpx.co.jp/markets/statistics-equities/misc/01.html "
            "から data_j.xls をダウンロードして配置してください。"
        )

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
