import { useCallback, useMemo, useState } from 'react';
import { downloadCsv } from './csv';
import { Disclaimer } from './components/Disclaimer';
import { FilterBar } from './components/FilterBar';
import { Header } from './components/Header';
import { SectorBreakdown } from './components/SectorBreakdown';
import { StockCards } from './components/StockCards';
import { StockDetailDialog } from './components/StockDetailDialog';
import { StockTable } from './components/StockTable';
import { SummaryCards } from './components/SummaryCards';
import type { Filters, SortState, Stock } from './types';
import { useTop30 } from './useTop30';

type View = 'dashboard' | 'table';

const INITIAL_FILTERS: Filters = {
  query: '',
  market: 'all',
  sector: 'all',
  excludeSpecial: false,
};

export default function App() {
  const { status, data, error, reload } = useTop30();
  const [view, setView] = useState<View>('dashboard');
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [sort, setSort] = useState<SortState>({ key: 'rank', direction: 'asc' });
  const [reloading, setReloading] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: 'ok' | 'error' } | null>(null);
  const [selected, setSelected] = useState<Stock | null>(null);

  const showToast = useCallback((message: string, kind: 'ok' | 'error') => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const handleReload = useCallback(async () => {
    setReloading(true);
    const ok = await reload(true);
    setReloading(false);
    showToast(
      ok ? 'データを再読み込みしました ✅' : '再読み込みに失敗しました ❌ 通信状況をご確認ください',
      ok ? 'ok' : 'error',
    );
  }, [reload, showToast]);

  const sectors = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.stocks.map((stock) => stock.sector))].sort((a, b) =>
      a.localeCompare(b, 'ja'),
    );
  }, [data]);

  const visibleStocks = useMemo(() => {
    if (!data) return [];
    return sortStocks(filterStocks(data.stocks, filters), sort);
  }, [data, filters, sort]);

  if (status === 'loading') {
    return (
      <div className="screen-message">
        <h1>読み込み中…</h1>
        <p>ランキングデータを取得しています。</p>
      </div>
    );
  }

  if (status === 'error' || !data) {
    return (
      <div className="screen-message screen-message--error">
        <h1>データを読み込めませんでした</h1>
        <p>{error}</p>
        <p>
          ローカルで初回起動した場合は、先に <code>make data</code> を実行して
          <code>web/public/data/top30.json</code> を生成してください。
        </p>
      </div>
    );
  }

  return (
    <>
      <Header data={data} reloading={reloading} onReload={handleReload} />

      <main className="layout">
        <SummaryCards summary={data.summary} stats={data.stats} />
        <SectorBreakdown sectors={data.sectorBreakdown} total={data.summary.count} />

        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          sort={sort}
          onSortChange={setSort}
          sectors={sectors}
          onExport={() => {
            downloadCsv(visibleStocks, data.priceDate);
            showToast(`${visibleStocks.length} 件を CSV に出力しました ✅`, 'ok');
          }}
          exportDisabled={visibleStocks.length === 0}
        />

        {/* 表示切り替えは検索・絞り込みの直下に置く。ヘッダー直下だと
            スクロール後に画面外へ出てしまい、切り替えたいときに見えない。 */}
        <div className="view-switch">
          <div className="tabs" role="tablist" aria-label="表示切り替え">
            <button
              type="button"
              role="tab"
              className="tabs__button"
              aria-selected={view === 'dashboard'}
              onClick={() => setView('dashboard')}
            >
              ダッシュボード
            </button>
            <button
              type="button"
              role="tab"
              className="tabs__button"
              aria-selected={view === 'table'}
              onClick={() => setView('table')}
            >
              一覧表
            </button>
          </div>

          <p className="result-count">
            {visibleStocks.length} 件を表示中（全 {data.stocks.length} 件）
          </p>
        </div>

        {visibleStocks.length === 0 ? (
          <div className="empty-state">
            条件に一致する銘柄がありません。検索語やフィルターを見直してください。
          </div>
        ) : view === 'dashboard' ? (
          <StockCards stocks={visibleStocks} onSelect={setSelected} />
        ) : (
          <StockTable stocks={visibleStocks} sort={sort} onSortChange={setSort} />
        )}

        <Disclaimer data={data} />
      </main>

      <StockDetailDialog stock={selected} onClose={() => setSelected(null)} />

      {toast && (
        <div className={`toast${toast.kind === 'error' ? ' toast--error' : ''}`} role="status">
          {toast.message}
        </div>
      )}
    </>
  );
}

function filterStocks(stocks: Stock[], filters: Filters): Stock[] {
  const query = filters.query.trim().toLowerCase();

  return stocks.filter((stock) => {
    if (filters.market !== 'all' && stock.market !== filters.market) return false;
    if (filters.sector !== 'all' && stock.sector !== filters.sector) return false;
    if (filters.excludeSpecial && stock.specialDividendSuspected) return false;
    if (query) {
      const haystack = `${stock.name}${stock.code}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function sortStocks(stocks: Stock[], sort: SortState): Stock[] {
  const factor = sort.direction === 'asc' ? 1 : -1;

  return [...stocks].sort((a, b) => {
    switch (sort.key) {
      case 'price':
      case 'dividend':
      case 'yieldPct':
      case 'rank':
        return (a[sort.key] - b[sort.key]) * factor;
      case 'name':
        // 銘柄名は同名がありうるので、証券コードで決定的に並べる。
        return a.code.localeCompare(b.code, 'ja') * factor;
      case 'market':
      case 'sector':
        return a[sort.key].localeCompare(b[sort.key], 'ja') * factor;
      default:
        return 0;
    }
  });
}
