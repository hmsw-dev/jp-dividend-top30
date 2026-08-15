import { useCallback, useEffect, useRef, useState } from 'react';
import {
  formatDate,
  formatEmployees,
  formatExMonths,
  formatMarketCap,
  formatMoney,
  formatPrice,
  formatYield,
} from '../format';
import { checkAvailability, isTranslatorSupported, translateToJapanese } from '../translator';
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

        <NewsList news={stock.news} />

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

        {/* 銘柄が変わったら翻訳の状態を持ち越さないよう key で作り直す。 */}
        <BusinessSummary key={stock.code} stock={stock} />
      </div>
    </dialog>
  );
}

/** 業績関連のニュース見出し。外部サイトへのリンクなので新しいタブで開く。 */
function NewsList({ news }: { news: Stock['news'] }) {
  return (
    <section className="detail__section">
      <h3 className="detail__section-title">最近のニュース</h3>

      {news && news.length > 0 ? (
        <>
          <ul className="news-list">
            {news.map((item) => (
              <li key={item.url} className="news-list__item">
                <a
                  className="news-list__link"
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.title}
                </a>
                <p className="news-list__meta">
                  {item.publishedAt && <span>{formatDate(item.publishedAt)}</span>}
                  <span>{item.source}</span>
                </p>
              </li>
            ))}
          </ul>
          <p className="detail__source">
            Google ニュースの検索結果です。見出しの選定は自動で行っているため、
            まれに関連の薄い記事が混ざります。
          </p>
        </>
      ) : (
        <p className="detail__empty">この銘柄の関連ニュースは取得できませんでした。</p>
      )}
    </section>
  );
}

type Phase = 'idle' | 'downloading' | 'translating' | 'error';

/**
 * 事業内容と、ブラウザ内蔵の翻訳ボタン。
 *
 * 翻訳が使えない環境（モバイル・Safari・Firefox）ではボタンを出さない。
 * 押せないボタンを見せても仕方がないため。
 */
function BusinessSummary({ stock }: { stock: Stock }) {
  const summary = stock.businessSummary ?? '';
  const [canTranslate, setCanTranslate] = useState(false);
  const [translated, setTranslated] = useState('');
  const [showOriginal, setShowOriginal] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!summary || !isTranslatorSupported()) return;
    let alive = true;
    void checkAvailability().then((availability) => {
      if (alive) setCanTranslate(availability !== 'unavailable');
    });
    return () => {
      alive = false;
    };
  }, [summary]);

  const handleTranslate = useCallback(async () => {
    setError('');
    setPhase('translating');
    try {
      const result = await translateToJapanese(stock.code, summary, (ratio) => {
        // 初回だけモデルのダウンロードが走る。数十MBあるので進捗を出す。
        setPhase('downloading');
        setProgress(ratio);
      });
      setTranslated(result);
      setShowOriginal(false);
      setPhase('idle');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '翻訳に失敗しました');
      setPhase('error');
    }
  }, [stock.code, summary]);

  if (!summary) {
    return (
      <section className="detail__section">
        <h3 className="detail__section-title">事業内容</h3>
        <p className="detail__empty">この銘柄の事業概要は取得できませんでした。</p>
      </section>
    );
  }

  const busy = phase === 'downloading' || phase === 'translating';
  const showingJapanese = translated !== '' && !showOriginal;

  return (
    <section className="detail__section">
      <h3 className="detail__section-title">
        事業内容
        <span className="detail__badge">{showingJapanese ? '機械翻訳' : '英語原文'}</span>

        {translated ? (
          <button
            type="button"
            className="detail__translate"
            onClick={() => setShowOriginal((previous) => !previous)}
          >
            {showOriginal ? '訳文を表示' : '原文を表示'}
          </button>
        ) : (
          canTranslate && (
            <button
              type="button"
              className="detail__translate"
              onClick={handleTranslate}
              disabled={busy}
            >
              {phase === 'downloading'
                ? `翻訳モデルを準備中 ${Math.round(progress * 100)}%`
                : phase === 'translating'
                  ? '翻訳中…'
                  : '日本語に翻訳'}
            </button>
          )
        )}
      </h3>

      <p className="detail__summary" lang={showingJapanese ? 'ja' : 'en'}>
        {showingJapanese ? translated : summary}
      </p>

      {error && <p className="detail__error">翻訳できませんでした（{error}）</p>}

      <p className="detail__source">
        Yahoo Finance が提供する事業概要です。日本語版が提供されていないため、原文は英語です。
        {showingJapanese && '表示中の日本語はブラウザの翻訳機能による機械訳で、誤りを含むことがあります。'}
      </p>
    </section>
  );
}
