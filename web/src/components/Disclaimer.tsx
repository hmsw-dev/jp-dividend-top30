import { formatDate } from '../format';
import type { Top30Data } from '../types';

export function Disclaimer({ data }: { data: Top30Data }) {
  const { stats } = data;

  return (
    <section className="disclaimer">
      <h2>ご利用にあたって</h2>
      <ul>
        <li>本サイトは情報提供のみを目的としており、投資助言ではありません。投資判断はご自身の責任で行ってください。</li>
        <li>データの正確性・完全性は保証しません。取得元の都合により遅延・欠損が発生します。</li>
        <li>
          利回りは「直近12か月の配当実績 ÷ 終値」で算出しています。実績が取得できない銘柄のみ、
          直近1期の年間配当で代替しています（各銘柄の算出根拠はCSV出力に含まれます）。
        </li>
        <li>
          記念配当・特別配当により一時的に利回りが高く出る銘柄があります。会社予想を大きく上回るものには
          「特別配当の疑い」を表示しています。
        </li>
        <li>ETF・ETN・REIT・インフラファンド・優先株・外国株は対象外です（東証上場の普通株のみ）。</li>
        <li>
          対象 {stats.universe.toLocaleString('ja-JP')} 銘柄のうち {stats.priced.toLocaleString('ja-JP')} 銘柄の株価を取得し、
          {stats.unreachable > 0 && `${stats.unreachable} 銘柄は取得できませんでした。`}
          配当実績のある {stats.withDividend.toLocaleString('ja-JP')} 銘柄から上位候補を抽出しています。
        </li>
      </ul>
      <p className="disclaimer__source">
        データ出典: {data.source} ／ 銘柄マスタ基準日: {formatDate(data.masterDate)} ／ 株価基準日:{' '}
        {formatDate(data.priceDate)}（終値）
      </p>
    </section>
  );
}
