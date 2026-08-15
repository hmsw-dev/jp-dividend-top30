import type { Filters, Market, SortKey, SortState } from '../types';

interface Props {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  sectors: string[];
  onExport: () => void;
  exportDisabled: boolean;
}

const MARKETS: Market[] = ['プライム', 'スタンダード', 'グロース'];

/** 並び順の選択肢。テーブルのヘッダークリックとも状態を共有する。 */
const SORT_OPTIONS: { label: string; key: SortKey; direction: SortState['direction'] }[] = [
  { label: '順位（昇順）', key: 'rank', direction: 'asc' },
  { label: '順位（降順）', key: 'rank', direction: 'desc' },
  { label: '利回りが高い順', key: 'yieldPct', direction: 'desc' },
  { label: '利回りが低い順', key: 'yieldPct', direction: 'asc' },
  { label: '株価が高い順', key: 'price', direction: 'desc' },
  { label: '株価が安い順', key: 'price', direction: 'asc' },
  { label: '証券コード順', key: 'name', direction: 'asc' },
];

export function FilterBar({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  sectors,
  onExport,
  exportDisabled,
}: Props) {
  const sortValue = `${sort.key}:${sort.direction}`;

  return (
    <section className="filters" aria-label="絞り込みと並び替え">
      <div className="field">
        <label className="field__label" htmlFor="filter-query">
          検索（銘柄名・証券コード）
        </label>
        <input
          id="filter-query"
          type="search"
          placeholder="例: 商事 / 8058"
          value={filters.query}
          onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="filter-market">
          市場区分
        </label>
        <select
          id="filter-market"
          value={filters.market}
          onChange={(event) =>
            onFiltersChange({ ...filters, market: event.target.value as Filters['market'] })
          }
        >
          <option value="all">全市場</option>
          {MARKETS.map((market) => (
            <option key={market} value={market}>
              {market}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="filter-sector">
          業種
        </label>
        <select
          id="filter-sector"
          value={filters.sector}
          onChange={(event) => onFiltersChange({ ...filters, sector: event.target.value })}
        >
          <option value="all">全業種</option>
          {sectors.map((sector) => (
            <option key={sector} value={sector}>
              {sector}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="filter-sort">
          並び替え
        </label>
        <select
          id="filter-sort"
          value={sortValue}
          onChange={(event) => {
            const [key, direction] = event.target.value.split(':');
            onSortChange({ key: key as SortKey, direction: direction as SortState['direction'] });
          }}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={`${option.key}:${option.direction}`} value={`${option.key}:${option.direction}`}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="filters__side">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={filters.excludeSpecial}
            onChange={(event) =>
              onFiltersChange({ ...filters, excludeSpecial: event.target.checked })
            }
          />
          特別配当の疑いを除く
        </label>
        <button
          type="button"
          className="csv-button"
          onClick={onExport}
          disabled={exportDisabled}
        >
          ⬇ CSV 出力
        </button>
      </div>
    </section>
  );
}
