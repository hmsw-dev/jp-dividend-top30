import { formatExMonths, formatMarketCap, formatMoney, formatPrice, formatYield } from '../format';
import type { Stock } from '../types';
import { MarketTag } from './MarketTag';

interface Props {
  stocks: Stock[];
  onSelect: (stock: Stock) => void;
}

export function StockCards({ stocks, onSelect }: Props) {
  return (
    <div className="card-grid">
      {stocks.map((stock) => (
        <StockCard key={stock.code} stock={stock} onSelect={onSelect} />
      ))}
    </div>
  );
}

function StockCard({ stock, onSelect }: { stock: Stock; onSelect: (stock: Stock) => void }) {
  const rankClass =
    stock.rank <= 3 ? `rank-badge rank-badge--${stock.rank}` : 'rank-badge';

  return (
    // カード全体をボタンにする。div + onClick だとキーボードで到達できないため。
    <article
      className="stock-card"
      role="button"
      tabIndex={0}
      aria-label={`${stock.name} の詳細を開く`}
      onClick={() => onSelect(stock)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(stock);
        }
      }}
    >
      <span className={rankClass} aria-label={`${stock.rank} 位`}>
        {stock.rank}
      </span>

      <h3 className="stock-card__name">{stock.name}</h3>
      <p className="stock-card__code">{stock.code}</p>
      <MarketTag market={stock.market} />

      <div className="yield-hero">
        <span className="yield-hero__label">配当利回り</span>
        <span className="yield-hero__value">{formatYield(stock.yieldPct)}</span>
      </div>

      <dl className="kv-list">
        <dt>株価</dt>
        <dd>{formatPrice(stock.price)} 円</dd>

        <dt>年間配当</dt>
        <dd>{formatMoney(stock.dividend)} 円</dd>

        <dt>権利確定月</dt>
        <dd>{formatExMonths(stock.exMonths)}</dd>

        <dt>業種</dt>
        <dd title={stock.sector}>{stock.sector}</dd>

        <dt>時価総額</dt>
        <dd>{formatMarketCap(stock.marketCap)}</dd>
      </dl>

      {stock.specialDividendSuspected && (
        <p className="special-flag">
          ⚠ 特別配当の疑い
          {stock.forwardDividend > 0 && `（会社予想 ${formatMoney(stock.forwardDividend)} 円）`}
        </p>
      )}

      <p className="stock-card__more" aria-hidden="true">
        タップで詳細 ›
      </p>
    </article>
  );
}
