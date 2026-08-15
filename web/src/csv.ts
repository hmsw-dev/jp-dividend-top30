import { formatExMonths } from './format';
import type { Stock } from './types';

const HEADERS = [
  '順位',
  '証券コード',
  '銘柄名',
  '市場区分',
  '業種',
  '規模区分',
  '株価(円)',
  '年間配当(円)',
  '配当利回り(%)',
  '会社予想配当(円)',
  '配当の根拠',
  '権利確定月',
  '時価総額(円)',
  '特別配当の疑い',
  '終値日',
];

function escapeCell(value: string | number): string {
  const text = String(value);
  // 銘柄名にカンマや引用符が含まれても壊れないようにする。
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(stocks: Stock[]): string {
  const rows = stocks.map((stock) => [
    stock.rank,
    stock.code,
    stock.name,
    stock.market,
    stock.sector,
    stock.sizeCategory,
    stock.price,
    stock.dividend,
    stock.yieldPct.toFixed(2),
    stock.forwardDividend,
    stock.dividendBasis,
    formatExMonths(stock.exMonths),
    stock.marketCap,
    stock.specialDividendSuspected ? 'あり' : '',
    stock.priceDate,
  ]);

  return [HEADERS, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

export function downloadCsv(stocks: Stock[], priceDate: string): void {
  // Excel が UTF-8 と判定できるよう BOM を付ける。付けないと日本語が化ける。
  const blob = new Blob(['﻿', toCsv(stocks)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `high-yield-top30_${priceDate || 'latest'}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
