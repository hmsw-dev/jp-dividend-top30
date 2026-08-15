import { formatExMonths, formatMoney, formatPrice, formatYield } from '../format';
import type { SortKey, SortState, Stock } from '../types';
import { MarketTag } from './MarketTag';

interface Props {
  stocks: Stock[];
  sort: SortState;
  onSortChange: (sort: SortState) => void;
}

interface Column {
  key: SortKey | null;
  label: string;
  numeric?: boolean;
}

const COLUMNS: Column[] = [
  { key: 'rank', label: '順位' },
  { key: 'name', label: '銘柄名 / コード' },
  { key: 'market', label: '市場' },
  { key: 'sector', label: '業種' },
  { key: 'price', label: '株価（円）', numeric: true },
  { key: 'dividend', label: '年間配当（円）', numeric: true },
  { key: 'yieldPct', label: '利回り（%）', numeric: true },
  { key: null, label: '権利確定月' },
];

export function StockTable({ stocks, sort, onSortChange }: Props) {
  const toggle = (key: SortKey) => {
    // 同じ列を押したら向きだけ反転。別の列なら、その列にとって
    // 自然な向き（数値は大きい順、文字は昇順）から始める。
    if (sort.key === key) {
      onSortChange({ key, direction: sort.direction === 'asc' ? 'desc' : 'asc' });
      return;
    }
    const numeric = COLUMNS.find((column) => column.key === key)?.numeric ?? false;
    onSortChange({ key, direction: numeric ? 'desc' : 'asc' });
  };

  return (
    <div className="table-wrap">
      <table className="stocks">
        <caption className="visually-hidden">
          配当利回り上位銘柄の一覧。列見出しのボタンで並び替えできます。
        </caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => {
              const active = column.key !== null && sort.key === column.key;
              return (
                <th
                  key={column.label}
                  scope="col"
                  style={column.numeric ? { textAlign: 'right' } : undefined}
                  aria-sort={
                    active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
                  }
                >
                  {column.key ? (
                    <button
                      type="button"
                      onClick={() => toggle(column.key as SortKey)}
                      aria-sort-active={active ? 'true' : 'false'}
                    >
                      {column.label}
                      <span aria-hidden="true">
                        {active ? (sort.direction === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {stocks.map((stock) => (
            <tr key={stock.code}>
              <td className="num">{stock.rank}</td>
              <td className="cell-name">
                {stock.name}
                <span>{stock.code}</span>
              </td>
              <td>
                <MarketTag market={stock.market} />
              </td>
              <td>{stock.sector}</td>
              <td className="num">{formatPrice(stock.price)}</td>
              <td className="num">
                {formatMoney(stock.dividend)}
                {stock.specialDividendSuspected && (
                  <span className="special-mark" title="実績配当が会社予想を大きく上回っています">
                    特別配当の疑い
                  </span>
                )}
              </td>
              <td className="num cell-yield">{formatYield(stock.yieldPct)}</td>
              <td>{formatExMonths(stock.exMonths)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
