"""銘柄マスタと取得結果を突き合わせ、配当利回り TOP30 を算出する。

配当利回りの定義（仕様書 3 章）:
    利回り(%) = 年間配当（実績・直近 12 か月） ÷ 直近終値 × 100
予想配当ではなく実績ベースであることに注意（実績が取れない銘柄のみ、
仕様書 7.2 に従って直近 1 期の年間配当で代替する）。
"""

from __future__ import annotations

import logging
from collections import Counter
from dataclasses import asdict, dataclass

from . import config
from .screener import ScreenResult
from .universe import MasterStock
from .verifier import VerifiedQuote

logger = logging.getLogger(__name__)


@dataclass
class RankedStock:
    """画面に出す 1 銘柄分のデータ。"""

    rank: int
    code: str
    name: str
    market: str
    sector: str
    sizeCategory: str
    price: float
    dividend: float
    yieldPct: float
    forwardDividend: float
    dividendBasis: str
    exMonths: list[int]
    marketCap: int
    specialDividendSuspected: bool
    priceDate: str


def select_candidates(
    masters: list[MasterStock], screened: list[ScreenResult]
) -> list[str]:
    """スクリーニング結果から、個別検証にかける候補コードを選ぶ。

    ここでの推定利回りは概算なので、TOP30 をそのまま切り出すのではなく
    十分に余裕のある枠を取る。
    """
    known = {master.code for master in masters}
    with_dividend = [
        result
        for result in screened
        if result.code in known and result.ttm_dividend > 0 and result.estimated_yield > 0
    ]
    with_dividend.sort(key=lambda result: result.estimated_yield, reverse=True)

    candidates = with_dividend[: config.CANDIDATE_POOL]
    if candidates:
        logger.info(
            "配当実績のある %d 銘柄から上位 %d 銘柄を候補に選びました"
            "（推定利回り %.2f%% 以上）",
            len(with_dividend),
            len(candidates),
            candidates[-1].estimated_yield,
        )
    return [result.code for result in candidates]


def build_ranking(
    masters: list[MasterStock],
    screened: list[ScreenResult],
    verified: list[VerifiedQuote],
) -> tuple[list[RankedStock], int]:
    """利回り降順の TOP30 と、ランキング候補になった銘柄数を返す。"""
    by_code = {master.code: master for master in masters}
    screen_by_code = {result.code: result for result in screened}

    candidates: list[RankedStock] = []
    excluded_outliers = 0

    for quote in verified:
        master = by_code.get(quote.code)
        if master is None:
            continue

        yield_pct = quote.yield_pct
        if yield_pct <= 0:
            continue
        if yield_pct > config.MAX_PLAUSIBLE_YIELD:
            # 株式併合の未反映などで株価だけが極端に小さい場合に発生する。
            logger.warning(
                "利回り異常のため除外: %s %s  %.1f%%（株価 %.1f / 配当 %.1f）",
                master.code,
                master.name,
                yield_pct,
                quote.price,
                quote.annual_dividend,
            )
            excluded_outliers += 1
            continue

        screen = screen_by_code.get(quote.code)
        candidates.append(
            RankedStock(
                rank=0,  # 並べ替え後に採番する
                code=master.code,
                name=master.name,
                market=master.market,
                sector=master.sector,
                sizeCategory=master.size_category,
                price=round(quote.price, 1),
                dividend=round(quote.annual_dividend, 2),
                yieldPct=round(yield_pct, 2),
                forwardDividend=round(quote.forward_dividend, 2),
                dividendBasis=quote.dividend_basis,
                exMonths=_ex_months(quote, screen),
                marketCap=quote.market_cap,
                specialDividendSuspected=_is_special(quote),
                priceDate=screen.price_date if screen else "",
            )
        )

    candidates.sort(key=lambda stock: stock.yieldPct, reverse=True)
    top = candidates[: config.TOP_N]
    for position, stock in enumerate(top, start=1):
        stock.rank = position

    logger.info(
        "確定した候補 %d 銘柄（利回り異常で除外 %d）→ TOP%d",
        len(candidates),
        excluded_outliers,
        len(top),
    )
    return top, len(candidates)


def _ex_months(quote: VerifiedQuote, screen: ScreenResult | None) -> list[int]:
    """権利確定月。

    直近 12 か月に実際に配当落ちがあった月を優先する（日本株は中間・期末の
    年 2 回が多く、次回の 1 回分だけでは実態を表しにくいため）。
    履歴が取れない場合は Yahoo の次回権利確定日から 1 か月分だけ出す。
    """
    if screen and screen.ex_months:
        return list(screen.ex_months)
    return [quote.next_ex_month] if quote.next_ex_month else []


def _is_special(quote: VerifiedQuote) -> bool:
    """記念配当・特別配当による一時的な高利回りを疑うかどうか。

    実績（TTM）が会社予想を大きく上回っている場合を疑わしいとみなす。
    予想が取れない場合は判定材料がないため、疑いなしとして扱う。
    """
    if quote.forward_dividend <= 0:
        return False
    return quote.annual_dividend > quote.forward_dividend * config.SPECIAL_DIVIDEND_RATIO


def build_summary(top: list[RankedStock]) -> dict:
    """サマリーカード 4 枚分の値を作る。"""
    if not top:
        return {"avgYield": 0.0, "avgPrice": 0.0, "count": 0, "topStock": None}

    best = top[0]
    return {
        "avgYield": round(sum(s.yieldPct for s in top) / len(top), 2),
        "avgPrice": round(sum(s.price for s in top) / len(top)),
        "count": len(top),
        "topStock": {"code": best.code, "name": best.name, "yieldPct": best.yieldPct},
    }


def build_sector_breakdown(top: list[RankedStock]) -> list[dict]:
    """TOP30 の業種内訳（上位 5 業種）。"""
    counts = Counter(stock.sector for stock in top)
    return [
        {"sector": sector, "count": count}
        for sector, count in counts.most_common(config.SECTOR_TOP_N)
    ]


def to_json_dict(stock: RankedStock) -> dict:
    return asdict(stock)
