"""1 段目: 全銘柄をざっと取得して、高利回りの候補を絞り込む。

1 銘柄ずつ `Ticker.info` を叩くと 3,800 銘柄で 30 分以上かかり、レート制限にも
頻繁に当たる。`yf.download` に複数ティッカーをまとめて渡すと 1 リクエストで
100 銘柄分の時系列を取得でき、全銘柄でも 5 分程度で終わる。
`actions=True` を付ければ配当履歴も同じレスポンスに含まれる。

ただしこの一括データは配当額の株式分割調整が銘柄によって不揃いで、
利回りがそのままでは信用できない。ここでの役割は「候補を絞る」ことまでとし、
最終的な数値は verifier.py で確定させる。
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

import pandas as pd
import yfinance as yf

from . import config

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ScreenResult:
    """1 銘柄分の粗い取得結果。"""

    code: str
    price: float
    price_date: str  # "YYYY-MM-DD"
    ttm_dividend: float  # 直近 12 か月の配当合計（分割調整が不確かな概算値）
    # 権利確定月。配当「額」は分割調整が怪しいが、配当落ち「日」は影響を受けない
    # ため、こちらはそのまま信用できる。
    ex_months: tuple[int, ...] = ()

    @property
    def estimated_yield(self) -> float:
        return self.ttm_dividend / self.price * 100 if self.price > 0 else 0.0


@dataclass
class ScreenStats:
    """取得の歩留まり。画面に「取得できた件数」を出すために持ち回る。"""

    requested: int = 0
    priced: int = 0  # 株価が取れた銘柄数
    with_dividend: int = 0  # 配当実績が確認できた銘柄数
    failed: int = 0  # 上場廃止・データなしなど最後まで取れなかった銘柄数
    unreachable_codes: list[str] = field(default_factory=list)


def screen_all(codes: list[str]) -> tuple[list[ScreenResult], ScreenStats]:
    """全銘柄をスクリーニングする。

    取得できなかった銘柄はラウンドを分けて取り直す。1 回で諦めると、
    終盤にレート制限へ当たったときに数百銘柄が丸ごと欠落してしまう。
    """
    _prepare_cache()

    stats = ScreenStats(requested=len(codes))
    results: dict[str, ScreenResult] = {}

    as_of = pd.Timestamp.now().normalize()
    ttm_start = as_of - pd.DateOffset(years=1)

    pending = list(codes)
    for round_number in range(1, config.RETRY_ROUNDS + 1):
        if not pending:
            break
        if round_number > 1:
            logger.info(
                "未取得 %d 銘柄を再取得します（ラウンド %d/%d、%d 秒待機）",
                len(pending),
                round_number,
                config.RETRY_ROUNDS,
                config.RETRY_ROUND_WAIT_SEC,
            )
            # レート制限は時間を置かないと解除されないため、必ず冷ます。
            time.sleep(config.RETRY_ROUND_WAIT_SEC)

        pending = _run_round(pending, results, ttm_start, round_number)

    stats.priced = len(results)
    stats.with_dividend = sum(1 for r in results.values() if r.ttm_dividend > 0)
    stats.failed = len(pending)
    stats.unreachable_codes = pending

    logger.info(
        "スクリーニング完了: 株価 %d / 配当あり %d / 取得不可 %d（対象 %d）",
        stats.priced,
        stats.with_dividend,
        stats.failed,
        stats.requested,
    )
    return list(results.values()), stats


def _run_round(
    codes: list[str],
    results: dict[str, ScreenResult],
    ttm_start: pd.Timestamp,
    round_number: int,
) -> list[str]:
    """1 ラウンド分を実行し、取得できなかった銘柄コードを返す。"""
    batches = [
        codes[i : i + config.BATCH_SIZE]
        for i in range(0, len(codes), config.BATCH_SIZE)
    ]
    logger.info(
        "ラウンド %d: %d 銘柄を %d バッチで取得します",
        round_number,
        len(codes),
        len(batches),
    )

    still_missing: list[str] = []
    for index, batch in enumerate(batches, start=1):
        frame = _download_batch(batch)
        if frame is None:
            still_missing.extend(batch)
            continue

        for code in batch:
            result = _extract(frame, code, ttm_start)
            if result is None:
                still_missing.append(code)
            else:
                results[code] = result

        logger.info(
            "  進捗 %d/%d バッチ  累計 %d 銘柄取得",
            index,
            len(batches),
            len(results),
        )
        if index < len(batches):
            time.sleep(config.INTER_BATCH_WAIT_SEC)

    return still_missing


def _prepare_cache() -> None:
    """yfinance のタイムゾーンキャッシュを用意する。

    yfinance はダウンロードスレッドの中でこのディレクトリを作ろうとするため、
    並列実行時に複数スレッドが同時に作成して失敗する。先に作れば競合しない。
    """
    tz_cache = config.CACHE_DIR / "tz"
    tz_cache.mkdir(parents=True, exist_ok=True)
    yf.set_tz_cache_location(str(tz_cache))


def _download_batch(codes: list[str]) -> pd.DataFrame | None:
    """1 バッチ分をダウンロードする。"""
    tickers = [f"{code}.T" for code in codes]

    for attempt in range(1, config.MAX_RETRIES + 1):
        try:
            frame = yf.download(
                tickers,
                period=config.HISTORY_PERIOD,
                actions=True,  # 配当・分割を同じレスポンスに含める
                group_by="ticker",
                auto_adjust=False,  # 配当落ち調整前の実際の終値が欲しい
                threads=True,
                progress=False,
            )
            if frame is not None and not frame.empty:
                return frame
        except Exception as exc:  # yfinance は多様な例外を投げる
            logger.debug("ダウンロード失敗（試行 %d）: %s", attempt, exc)

        if attempt < config.MAX_RETRIES:
            time.sleep(config.RETRY_WAIT_SEC * attempt)

    return None


def _extract(
    frame: pd.DataFrame, code: str, ttm_start: pd.Timestamp
) -> ScreenResult | None:
    """まとめて取得した DataFrame から 1 銘柄分を切り出す。"""
    try:
        sub = frame[f"{code}.T"]
    except KeyError:
        return None

    if "Close" not in sub.columns:
        return None

    closes = sub["Close"].dropna()
    if closes.empty:
        return None

    price = float(closes.iloc[-1])
    if price <= 0:
        return None

    dividends = (
        sub["Dividends"].dropna() if "Dividends" in sub.columns else pd.Series(dtype=float)
    )
    dividends = dividends[dividends > 0]
    if not dividends.empty:
        dividends.index = pd.DatetimeIndex([_to_naive(ts) for ts in dividends.index])
        dividends = dividends[dividends.index >= ttm_start]

    return ScreenResult(
        code=code,
        price=price,
        price_date=_to_naive(closes.index[-1]).strftime("%Y-%m-%d"),
        ttm_dividend=float(dividends.sum()) if not dividends.empty else 0.0,
        ex_months=tuple(sorted({int(ts.month) for ts in dividends.index}))
        if not dividends.empty
        else (),
    )


def _to_naive(timestamp: pd.Timestamp) -> pd.Timestamp:
    """tz 付き・tz なしが混在するため、比較前に tz を落として揃える。"""
    ts = pd.Timestamp(timestamp)
    if ts.tzinfo is not None:
        ts = ts.tz_localize(None)
    return ts.normalize()
