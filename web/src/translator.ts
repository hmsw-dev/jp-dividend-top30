/**
 * ブラウザ内蔵の翻訳機能（Translator API）を使って事業内容を日本語にする。
 *
 * 端末内で完結するので API キーも通信費もかからない。ただし Chrome 138 以降の
 * デスクトップ限定で、モバイル・Safari・Firefox では使えない。
 * 使えない環境では翻訳ボタン自体を出さない（機能検出による段階的強化）。
 *
 * なお「このページを翻訳」というブラウザ標準のUIは、ページ側から呼び出す手段が
 * 提供されていない。そちらはユーザーが自分で起動するものなので、ここでは
 * テキスト単位で翻訳するこの API を使っている。
 */

const SOURCE_LANGUAGE = 'en';
const TARGET_LANGUAGE = 'ja';

/** Translator.availability() の戻り値。 */
type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

interface LanguagePair {
  sourceLanguage: string;
  targetLanguage: string;
}

interface TranslatorInstance {
  translate(text: string): Promise<string>;
  destroy?(): void;
}

interface TranslatorApi {
  availability(options: LanguagePair): Promise<Availability>;
  create(
    options: LanguagePair & { monitor?: (monitor: EventTarget) => void },
  ): Promise<TranslatorInstance>;
}

/** 標準の型定義にはまだ入っていないため、あるかどうかを見てから使う。 */
function getApi(): TranslatorApi | null {
  return (globalThis as { Translator?: TranslatorApi }).Translator ?? null;
}

export function isTranslatorSupported(): boolean {
  return getApi() !== null;
}

/**
 * この端末で英→日の翻訳が使えるか。
 * 'downloadable' はモデル未取得なだけで、作成時にダウンロードが走る。
 */
export async function checkAvailability(): Promise<Availability> {
  const api = getApi();
  if (!api) return 'unavailable';
  try {
    return await api.availability({
      sourceLanguage: SOURCE_LANGUAGE,
      targetLanguage: TARGET_LANGUAGE,
    });
  } catch {
    return 'unavailable';
  }
}

// 同じ銘柄を開き直すたびに翻訳し直さない。ページを離れるまで保持する。
const cache = new Map<string, string>();

// インスタンス生成はモデルの初期化を伴うので使い回す。
let instance: Promise<TranslatorInstance> | null = null;

function getInstance(onDownloadProgress?: (ratio: number) => void): Promise<TranslatorInstance> {
  const api = getApi();
  if (!api) return Promise.reject(new Error('この環境では翻訳機能を利用できません'));

  if (!instance) {
    instance = api
      .create({
        sourceLanguage: SOURCE_LANGUAGE,
        targetLanguage: TARGET_LANGUAGE,
        monitor(monitor) {
          monitor.addEventListener('downloadprogress', (event) => {
            // loaded は 0〜1。初回のみモデルのダウンロードが走る。
            const { loaded } = event as Event & { loaded?: number };
            if (typeof loaded === 'number') onDownloadProgress?.(loaded);
          });
        },
      })
      // 失敗を握ったままにすると次回以降ずっと同じ失敗を返すので捨てる。
      .catch((error) => {
        instance = null;
        throw error;
      });
  }
  return instance;
}

/**
 * 英文を日本語にする。`cacheKey` は銘柄コードを想定。
 * 初回はモデルのダウンロードが入るため `onDownloadProgress` で進捗を受け取れる。
 */
export async function translateToJapanese(
  cacheKey: string,
  text: string,
  onDownloadProgress?: (ratio: number) => void,
): Promise<string> {
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const translator = await getInstance(onDownloadProgress);
  const translated = await translator.translate(text);
  cache.set(cacheKey, translated);
  return translated;
}
