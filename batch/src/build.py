"""バッチのエントリポイント。

    python -m src.build                 # 全銘柄を処理して top30.json を生成
    python -m src.build --limit 300     # 動作確認用に先頭 300 銘柄だけ
    python -m src.build --skip-holidays # 東証の休場日なら何もせず終了

処理は 2 段階:
    1. screener  … 全銘柄を一括取得して高利回りの候補を絞る（速いが概算）
    2. verifier  … 候補だけ個別取得して配当と株価を確定する（正確）
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from . import config, news, ranking
from .screener import screen_all
from .trading_calendar import is_trading_day, next_trading_day
from .universe import load_universe
from .verifier import verify

JST = timezone(timedelta(hours=9))

logger = logging.getLogger("build")


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-7s %(message)s",
        datefmt="%H:%M:%S",
    )

    today = datetime.now(JST).date()
    if args.skip_holidays and not is_trading_day(today):
        logger.info("%s は東証の休場日のため、更新をスキップします", today)
        return 0

    masters, master_date = load_universe(allow_download=not args.no_download)
    codes = [master.code for master in masters]
    if args.limit:
        codes = codes[: args.limit]
        logger.info("--limit 指定により %d 銘柄に絞り込みました", len(codes))

    screened, stats = screen_all(codes)
    candidate_codes = ranking.select_candidates(masters, screened)
    if not candidate_codes:
        logger.error("候補を 1 件も抽出できませんでした。既存のJSONは更新しません")
        return 1

    verified = verify(candidate_codes)
    top, confirmed_count = ranking.build_ranking(masters, screened, verified)

    if not top:
        logger.error("ランキングを 1 件も算出できませんでした。既存のJSONは更新しません")
        return 1

    # ニュースは TOP30 が確定してから集める。候補 150 件分を取ると無駄が大きい。
    # 取れなくてもランキング自体は成立するので、失敗しても先に進む。
    news.attach(top)

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        # 画面に出す「データ基準日」。TOP30 の終値のうち最も新しい日付。
        "priceDate": max((s.priceDate for s in top if s.priceDate), default=""),
        "masterDate": master_date,
        "nextUpdate": f"{next_trading_day(today).isoformat()} 20:00 JST",
        "source": "yfinance (Yahoo Finance) / 銘柄マスタ: JPX 東証上場銘柄一覧",
        "stats": {
            "universe": len(codes),
            "priced": stats.priced,
            "withDividend": stats.with_dividend,
            "unreachable": stats.failed,
            "verified": confirmed_count,
        },
        "summary": ranking.build_summary(top),
        "sectorBreakdown": ranking.build_sector_breakdown(top),
        "stocks": [ranking.to_json_dict(stock) for stock in top],
    }

    output = Path(args.output) if args.output else config.OUTPUT_JSON
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    logger.info("書き出しました: %s", output)
    _log_preview(top)
    return 0


def _log_preview(top: list[ranking.RankedStock]) -> None:
    logger.info("--- TOP10 プレビュー ---")
    for stock in top[:10]:
        mark = " ※特別配当の疑い" if stock.specialDividendSuspected else ""
        logger.info(
            "%2d. %s %-16s %6.2f%%  株価 %8.1f  配当 %7.2f (%s)%s",
            stock.rank,
            stock.code,
            stock.name[:16],
            stock.yieldPct,
            stock.price,
            stock.dividend,
            stock.dividendBasis,
            mark,
        )


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="高配当日本株 TOP30 データ生成")
    parser.add_argument(
        "--limit", type=int, default=0, help="先頭 N 銘柄だけ処理する（動作確認用）"
    )
    parser.add_argument("--output", default="", help="出力先 JSON のパス")
    parser.add_argument(
        "--no-download",
        action="store_true",
        help="JPXから銘柄一覧を取得せず、手元のファイルを使う",
    )
    parser.add_argument(
        "--skip-holidays",
        action="store_true",
        help="東証の休場日なら何もせず終了する（CI 用）",
    )
    return parser.parse_args(argv)


if __name__ == "__main__":
    sys.exit(main())
