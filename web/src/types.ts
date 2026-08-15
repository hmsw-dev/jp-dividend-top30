/** バッチ（batch/src/build.py）が出力する top30.json の型。 */

export type Market = 'プライム' | 'スタンダード' | 'グロース';

/** 業績関連のニュース見出し（Google ニュース RSS 由来）。 */
export interface NewsItem {
  title: string;
  /** news.google.com 経由で配信元へ飛ぶリンク */
  url: string;
  /** 配信媒体名。不明なら「不明」 */
  source: string;
  /** 配信日（JST、YYYY-MM-DD）。取れなければ空文字 */
  publishedAt: string;
}

export interface Stock {
  rank: number;
  code: string;
  name: string;
  market: Market;
  sector: string;
  sizeCategory: string;
  /** 終値（円） */
  price: number;
  /** 利回り計算に使った年間配当（円） */
  dividend: number;
  /** 配当利回り（%） */
  yieldPct: number;
  /** 会社予想ベースの年間配当（円）。0 なら不明 */
  forwardDividend: number;
  /** 配当の根拠: 「実績(TTM)」または「直近1期」 */
  dividendBasis: string;
  /** 権利確定月（1〜12） */
  exMonths: number[];
  /** 時価総額（円）。0 なら不明 */
  marketCap: number;
  /** 実績配当が会社予想を大きく上回る＝一時的な高利回りの疑い */
  specialDividendSuspected: boolean;
  priceDate: string;

  /**
   * 事業内容。Yahoo Finance の longBusinessSummary で、**英語原文**。
   * 日本語の事業概要を返すソースがないため翻訳せずそのまま出している。
   * 取得できない銘柄では空文字。
   */
  businessSummary?: string;
  /** 公式サイト URL。空文字なら不明 */
  website?: string;
  /** 正社員数。0 なら不明 */
  employees?: number;
  /** 本社所在地（市区名・英字表記）。空文字なら不明 */
  headquarters?: string;
  /** 業績関連ニュース。取得できなかった場合は空配列 */
  news?: NewsItem[];
}

export interface Summary {
  avgYield: number;
  avgPrice: number;
  count: number;
  topStock: { code: string; name: string; yieldPct: number } | null;
}

export interface SectorCount {
  sector: string;
  count: number;
}

export interface Stats {
  /** 取得対象とした普通株の数 */
  universe: number;
  /** 株価を取得できた銘柄数 */
  priced: number;
  /** 配当実績を確認できた銘柄数 */
  withDividend: number;
  /** 最後まで取得できなかった銘柄数 */
  unreachable: number;
  /** 個別検証で数値を確定できた候補数 */
  verified: number;
}

export interface Top30Data {
  generatedAt: string;
  priceDate: string;
  masterDate: string;
  nextUpdate: string;
  source: string;
  stats: Stats;
  summary: Summary;
  sectorBreakdown: SectorCount[];
  stocks: Stock[];
}

export type SortKey = 'rank' | 'name' | 'market' | 'sector' | 'price' | 'dividend' | 'yieldPct';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

export interface Filters {
  query: string;
  market: Market | 'all';
  sector: string;
  excludeSpecial: boolean;
}
