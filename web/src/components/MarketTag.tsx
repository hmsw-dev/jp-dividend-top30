import type { Market } from '../types';

const CLASS_BY_MARKET: Record<Market, string> = {
  プライム: 'market-tag market-tag--prime',
  スタンダード: 'market-tag market-tag--standard',
  グロース: 'market-tag market-tag--growth',
};

/** 市場区分は色だけでなく必ず名称も出す（色覚特性に依存させない）。 */
export function MarketTag({ market }: { market: Market }) {
  return <span className={CLASS_BY_MARKET[market] ?? 'market-tag'}>{market}</span>;
}
