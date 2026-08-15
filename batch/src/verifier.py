"""2 段目: 候補銘柄を 1 件ずつ取得し、配当と株価を確定させる。

一括取得（screener.py）の配当額は株式分割の調整が銘柄によって不揃いで、
そのまま使うと利回りが過大に出ることがある。Yahoo が銘柄単位で公開している
`trailingAnnualDividendRate` は分割調整済みなので、最終的な数値はこちらを使う。

仕様書 7.2 の取得方針:
    優先      : trailingAnnualDividendRate（実績 TTM）
    代替      : dividendRate（直近 1 期の年間配当）
    どちらも無し: ランキング対象外
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone

import yfinance as yf

from . import config

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class VerifiedQuote:
    """確定した 1 銘柄分の株価・配当。"""

    code: str
    price: float
    annual_dividend: float  # 利回り計算に使う年間配当
    forward_dividend: float  # 会社予想ベースの年間配当（0 なら不明）
    dividend_basis: str  # "実績(TTM)" or "直近1期"
    market_cap: int
    next_ex_month: int  # 次回の権利確定月（0 なら不明）

    @property
    def yield_pct(self) -> float:
        return self.annual_dividend / self.price * 100 if self.price > 0 else 0.0


def verify(codes: list[str]) -> list[VerifiedQuote]:
    """候補銘柄を 1 件ずつ検証する。取得できなかった銘柄は結果に含めない。"""
    logger.info("候補 %d 銘柄を個別に検証します", len(codes))

    verified: list[VerifiedQuote] = []
    for index, code in enumerate(codes, start=1):
        quote = _fetch_one(code)
        if quote is not None:
            verified.append(quote)

        if index % 25 == 0:
            logger.info("  検証 %d/%d 銘柄（確定 %d）", index, len(codes), len(verified))
        time.sleep(config.INTER_BATCH_WAIT_SEC if index % 50 == 0 else config.INFO_INTERVAL_SEC)

    logger.info("検証完了: %d/%d 銘柄を確定", len(verified), len(codes))
    return verified


def _fetch_one(code: str) -> VerifiedQuote | None:
    info = _fetch_info(code)
    if not info:
        return None

    price = _as_float(info.get("previousClose")) or _as_float(info.get("currentPrice"))
    if price <= 0:
        logger.debug("%s: 株価を取得できませんでした", code)
        return None

    trailing = _as_float(info.get("trailingAnnualDividendRate"))
    forward = _as_float(info.get("dividendRate"))

    if trailing > 0:
        annual, basis = trailing, "実績(TTM)"
    elif forward > 0:
        # 実績が取れない場合のみ、仕様書どおり直近 1 期の年間配当に落とす。
        annual, basis = forward, "直近1期"
    else:
        return None

    return VerifiedQuote(
        code=code,
        price=price,
        annual_dividend=annual,
        forward_dividend=forward,
        dividend_basis=basis,
        market_cap=int(_as_float(info.get("marketCap"))),
        next_ex_month=_ex_month(info.get("exDividendDate")),
    )


def _fetch_info(code: str) -> dict | None:
    """`Ticker.info` を取得する。レート制限に当たったら待って再試行する。"""
    for attempt in range(1, config.INFO_MAX_RETRIES + 1):
        try:
            info = yf.Ticker(f"{code}.T").info
            if info:
                return info
        except Exception as exc:
            message = str(exc)
            is_rate_limited = "429" in message or "Too Many Requests" in message
            if attempt < config.INFO_MAX_RETRIES:
                wait = config.INFO_RETRY_WAIT_SEC * (2 if is_rate_limited else 1) * attempt
                logger.debug("%s の取得を再試行します（%s、%d 秒待機）", code, message, wait)
                time.sleep(wait)
            else:
                logger.warning("%s の取得に失敗しました: %s", code, message)
    return None


def _as_float(value: object) -> float:
    """None や文字列が混ざるため、数値化できないものは 0 として扱う。"""
    if value is None:
        return 0.0
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    return number if number == number else 0.0  # NaN を除く


def _ex_month(raw: object) -> int:
    """`exDividendDate`（UNIX 秒）から権利確定月を取り出す。"""
    seconds = _as_float(raw)
    if seconds <= 0:
        return 0
    try:
        return datetime.fromtimestamp(seconds, tz=timezone.utc).month
    except (OverflowError, OSError, ValueError):
        return 0
