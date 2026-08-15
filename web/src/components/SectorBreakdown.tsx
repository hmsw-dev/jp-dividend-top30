import type { SectorCount } from '../types';

interface Props {
  sectors: SectorCount[];
  total: number;
}

/**
 * 件数は数字だけでも読めるが、長さを添えると業種間の偏りが一目で分かる。
 * 系列は 1 つ（銘柄数）なので単色で塗り、色に意味は持たせない。
 */
export function SectorBreakdown({ sectors, total }: Props) {
  if (!sectors.length) return null;

  const max = Math.max(...sectors.map((sector) => sector.count));

  return (
    <section className="panel" aria-labelledby="sector-heading">
      <h2 className="panel__title" id="sector-heading">
        業種別 TOP{sectors.length}
      </h2>
      <p className="panel__hint">TOP{total} に含まれる銘柄数の多い業種</p>
      <div className="sector-grid">
        {sectors.map((sector) => (
          <div className="sector-item" key={sector.sector}>
            <p className="sector-item__name" title={sector.sector}>
              {sector.sector}
            </p>
            <span className="sector-item__count">{sector.count}</span>
            <span className="sector-item__unit">銘柄</span>
            <div
              className="sector-item__bar"
              role="img"
              aria-label={`${sector.sector} ${sector.count} 銘柄`}
            >
              <span style={{ width: `${(sector.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
