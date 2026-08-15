import { formatDate, formatDateTime } from '../format';
import type { Top30Data } from '../types';

interface Props {
  data: Top30Data;
  reloading: boolean;
  onReload: () => void;
}

export function Header({ data, reloading, onReload }: Props) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div>
          <h1 className="site-header__title">📈 高利回り日本株 TOP30</h1>
          <ul className="site-header__meta">
            <li>
              データ基準日 <strong>{formatDate(data.priceDate)}</strong>（終値）
            </li>
            <li>
              生成 <strong>{formatDateTime(data.generatedAt)}</strong>
            </li>
            <li>
              次回更新 <strong>{data.nextUpdate}</strong>
            </li>
            <li>
              <span className="badge">
                東証全市場 {data.stats.universe.toLocaleString('ja-JP')} 銘柄が対象
              </span>
            </li>
          </ul>
        </div>

        <div className="site-header__actions">
          <button
            type="button"
            className="reload-button"
            onClick={onReload}
            disabled={reloading}
          >
            {reloading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                読み込み中…
              </>
            ) : (
              <>🔄 最新データを再読み込み</>
            )}
          </button>
          {/* 静的サイトのため、ボタンは取得ジョブの起動ではなく
              公開済みデータの再取得を行う。誤解を招かないよう明記する。 */}
          <p className="reload-note">
            株価の取得は営業日 20:00 に自動実行されます。ボタンは公開済みデータの再取得のみ行います。
          </p>
        </div>
      </div>
    </header>
  );
}
