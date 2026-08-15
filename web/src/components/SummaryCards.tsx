import { formatPrice, formatYield } from '../format';
import type { Stats, Summary } from '../types';

interface Props {
  summary: Summary;
  stats: Stats;
}

/**
 * 4 つの値は互いに単位が違う単発の指標なので、グラフではなく数値タイルで出す
 * （比較すべき系列がないため、チャートにしても情報が増えない）。
 */
export function SummaryCards({ summary, stats }: Props) {
  return (
    <section className="summary-grid" aria-label="サマリー">
      <article className="stat-tile">
        <p className="stat-tile__label">平均配当利回り</p>
        <p className="stat-tile__value stat-tile__value--yield">
          {formatYield(summary.avgYield)}
        </p>
        <p className="stat-tile__sub">TOP{summary.count} の単純平均</p>
      </article>

      <article className="stat-tile">
        <p className="stat-tile__label">最高利回り</p>
        <p className="stat-tile__value stat-tile__value--yield">
          {summary.topStock ? formatYield(summary.topStock.yieldPct) : '—'}
        </p>
        <p className="stat-tile__sub">
          {summary.topStock ? `${summary.topStock.name}（${summary.topStock.code}）` : '—'}
        </p>
      </article>

      <article className="stat-tile">
        <p className="stat-tile__label">平均株価</p>
        <p className="stat-tile__value">{formatPrice(summary.avgPrice)}<span style={{ fontSize: '0.9rem' }}> 円</span></p>
        <p className="stat-tile__sub">TOP{summary.count} の単純平均</p>
      </article>

      <article className="stat-tile">
        <p className="stat-tile__label">対象銘柄数</p>
        <p className="stat-tile__value">{summary.count}<span style={{ fontSize: '0.9rem' }}> 銘柄</span></p>
        <p className="stat-tile__sub">
          配当実績あり {stats.withDividend.toLocaleString('ja-JP')} 銘柄から抽出
        </p>
      </article>
    </section>
  );
}
