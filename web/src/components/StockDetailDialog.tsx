import { useEffect, useRef } from 'react';
import {
  formatDate,
  formatEmployees,
  formatExMonths,
  formatMarketCap,
  formatMoney,
  formatPrice,
  formatYield,
} from '../format';
import type { Stock } from '../types';
import { MarketTag } from './MarketTag';

interface Props {
  stock: Stock | null;
  onClose: () => void;
}

/**
 * 銘柄カードをタップしたときに出す詳細ポップアップ。
 *
 * ネイティブの <dialog> を使っている。フォーカストラップ・Escape での閉じ操作・
 * 背景の不活性化をブラウザ任せにできるため、自前で実装するより事故が少ない。
 */
export function StockDetailDialog({ stock, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (stock && !dialog.open) {
      dialog.showModal();
    } else if (!stock && dialog.open) {
      dialog.close();
    }
  }, [stock]);

  useEffect(() => {
    // showModal() は背景のスクロールまでは止めないので、ここで止める。
    if (!stock) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [stock]);

  if (!stock) return null;

  const rankClass = stock.rank <= 3 ? `rank-badge rank-badge--${stock.rank}` : 'rank-badge';

  return (
    <dialog
      ref={ref}
      className="detail"
      aria-labelledby="detail-title"
      // Escape キーとブラウザ既定の閉じ操作を親の state に伝える。
      onClose={onClose}
      // <dialog> 自身が背景（::backdrop）のクリック対象になる。中身のクリックは
      // 子要素が target になるため、ここでは背景のみを拾える。
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="detail__inner">
        <header className="detail__head">
          <span className={rankClass} aria-label={`${stock.rank} 位`}>
            {stock.rank}
          </span>
          <h2 className="detail__title" id="detail-title">
            {stock.name}
          </h2>
          <p className="detail__code">
            {stock.code}
            <MarketTag market={stock.market} />
          </p>
          <button
            type="button"
            className="detail__close"
            onClick={onClose}
            aria-label="閉じる"
          >
            ✕
          </button>
        </header>

        <div className="detail__yield">
          <span className="detail__yield-label">配当利回り</span>
          <span className="detail__yield-value">{formatYield(stock.yieldPct)}</span>
          <span className="detail__yield-note">
            {formatMoney(stock.dividend)} 円 ÷ {formatPrice(stock.price)} 円
          </span>
        </div>

        {stock.specialDividendSuspected && (
          <p className="detail__warn">
            ⚠ 特別配当の疑い
            {stock.forwardDividend > 0 &&
              `：実績 ${formatMoney(stock.dividend)} 円に対して会社予想は ${formatMoney(
                stock.forwardDividend,
              )} 円です。`}
            記念配当などで一時的に利回りが高く出ている可能性があります。
          </p>
        )}

        <section className="detail__section">
          <h3 className="detail__section-title">配当・株価</h3>
          <dl className="detail__kv">
            <dt>株価（終値）</dt>
            <dd>{formatPrice(stock.price)} 円</dd>

            <dt>年間配当</dt>
            <dd>{formatMoney(stock.dividend)} 円</dd>

            <dt>配当の根拠</dt>
            <dd>{stock.dividendBasis}</dd>

            <dt>会社予想配当</dt>
            <dd>{stock.forwardDividend > 0 ? `${formatMoney(stock.forwardDividend)} 円` : '—'}</dd>

            <dt>権利確定月</dt>
            <dd>{formatExMonths(stock.exMonths)}</dd>

            <dt>終値日</dt>
            <dd>{formatDate(stock.priceDate)}</dd>
          </dl>
        </section>

        <section className="detail__section">
          <h3 className="detail__section-title">企業情報</h3>
          <dl className="detail__kv">
            <dt>業種</dt>
            <dd>{stock.sector}</dd>

            <dt>市場区分</dt>
            <dd>{stock.market}</dd>

            <dt>規模区分</dt>
            <dd>{stock.sizeCategory || '—'}</dd>

            <dt>時価総額</dt>
            <dd>{formatMarketCap(stock.marketCap)}</dd>

            <dt>従業員数</dt>
            <dd>{formatEmployees(stock.employees)}</dd>

            <dt>本社</dt>
            <dd>{stock.headquarters || '—'}</dd>

            <dt>公式サイト</dt>
            <dd>
              {stock.website ? (
                <a href={stock.website} target="_blank" rel="noopener noreferrer">
                  {stock.website.replace(/^https?:\/\//, '')} ↗
                </a>
              ) : (
                '—'
              )}
            </dd>
          </dl>
        </section>

        <section className="detail__section">
          <h3 className="detail__section-title">
            事業内容
            {stock.businessSummary && <span className="detail__badge">英語原文</span>}
          </h3>
          {stock.businessSummary ? (
            <>
              <p className="detail__summary" lang="en">
                {stock.businessSummary}
              </p>
              <p className="detail__source">
                Yahoo Finance が提供する事業概要です。日本語版が提供されていないため、
                原文のまま掲載しています。
              </p>
            </>
          ) : (
            <p className="detail__empty">この銘柄の事業概要は取得できませんでした。</p>
          )}
        </section>
      </div>
    </dialog>
  );
}
