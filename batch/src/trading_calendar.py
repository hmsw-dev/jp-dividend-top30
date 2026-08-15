"""東証の営業日判定。

自動更新は営業日の引け後だけ動かせばよい（同じ営業日のうちは終値が変わらない）ため、
バッチ側で休場日を判定してスキップする。
"""

from __future__ import annotations

from datetime import date, timedelta

import jpholiday

# 東証は 12/31〜1/3 が年末年始休場。祝日カレンダーには含まれないので個別に持つ。
_YEAR_END_HOLIDAYS = {(12, 31), (1, 1), (1, 2), (1, 3)}


def is_trading_day(day: date) -> bool:
    """東証の営業日なら True。"""
    if day.weekday() >= 5:  # 土日
        return False
    if (day.month, day.day) in _YEAR_END_HOLIDAYS:
        return False
    return not jpholiday.is_holiday(day)


def next_trading_day(after: date) -> date:
    """`after` の翌日以降で最初の営業日。"""
    day = after + timedelta(days=1)
    # 年末年始と連休が重なっても 10 日以内には必ず営業日が来る。
    for _ in range(15):
        if is_trading_day(day):
            return day
        day += timedelta(days=1)
    return day
