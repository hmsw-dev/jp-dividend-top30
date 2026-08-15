/** 表示用の整形。数値の桁数を画面全体で揃えるため、必ずここを通す。 */

const JPY = new Intl.NumberFormat('ja-JP');

export function formatPrice(value: number): string {
  // 株価は 1 円未満の刻みがある銘柄もあるため、端数がある場合だけ小数を出す。
  return Number.isInteger(value) ? JPY.format(value) : JPY.format(Math.round(value * 10) / 10);
}

export function formatMoney(value: number): string {
  return JPY.format(Math.round(value * 100) / 100);
}

/** 利回りは仕様どおり小数点 2 桁で統一する。 */
export function formatYield(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function formatMarketCap(value: number): string {
  if (!value) return '—';
  const oku = value / 100_000_000;
  if (oku >= 10_000) return `${(oku / 10_000).toFixed(2)}兆円`;
  return `${JPY.format(Math.round(oku))}億円`;
}

export function formatEmployees(value: number | undefined): string {
  if (!value) return '—';
  return `${JPY.format(value)} 人`;
}

export function formatExMonths(months: number[]): string {
  if (!months.length) return '—';
  return months.map((month) => `${month}月`).join('・');
}

/** ISO8601 を日本時間の "YYYY/MM/DD HH:mm" にする。 */
export function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
    hour12: false,
  }).format(date);
}

export function formatDate(value: string): string {
  if (!value) return '—';
  return value.replace(/-/g, '/');
}
