import { useCallback, useEffect, useState } from 'react';
import type { Top30Data } from './types';

type Status = 'loading' | 'ready' | 'error';

interface State {
  status: Status;
  data: Top30Data | null;
  error: string;
}

/** バッチが生成した JSON を読み込む。GitHub Pages のサブパス配信に対応する。 */
const DATA_URL = `${import.meta.env.BASE_URL}data/top30.json`;

export function useTop30() {
  const [state, setState] = useState<State>({ status: 'loading', data: null, error: '' });

  const load = useCallback(async (bustCache = false): Promise<boolean> => {
    try {
      // 再読み込み時はクエリを付けて、CDN やブラウザのキャッシュを迂回する。
      const url = bustCache ? `${DATA_URL}?t=${Date.now()}` : DATA_URL;
      const response = await fetch(url, { cache: bustCache ? 'reload' : 'default' });
      if (!response.ok) {
        throw new Error(`データを取得できませんでした (HTTP ${response.status})`);
      }
      const data = (await response.json()) as Top30Data;
      if (!Array.isArray(data.stocks)) {
        throw new Error('データの形式が不正です');
      }
      setState({ status: 'ready', data, error: '' });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '不明なエラー';
      // すでに表示中のデータがあるなら消さない。再読み込みの失敗で画面が
      // 真っ白になるほうが困るため。
      setState((previous) =>
        previous.data
          ? { ...previous, error: message }
          : { status: 'error', data: null, error: message },
      );
      return false;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}
