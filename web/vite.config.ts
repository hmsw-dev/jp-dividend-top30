import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages はリポジトリ名のサブパス配下で配信されるため、
// CI 側から BASE_PATH（例: "/jp-dividend-top30/"）を渡してビルドする。
// ローカル開発や独自ドメインではルート配信なので既定は "/"。
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
