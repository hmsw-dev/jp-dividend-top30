.PHONY: setup data data-quick dev build preview clean

VENV := .venv
PY   := $(VENV)/bin/python
PIP  := $(VENV)/bin/pip

## 初回セットアップ（Python 仮想環境と npm 依存関係）
setup:
	python3 -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r batch/requirements.txt
	cd web && npm install

## 全銘柄を取得して web/public/data/top30.json を生成（10 分程度）
data:
	cd batch && ../$(PY) -m src.build

## 先頭 300 銘柄だけで動作確認（1 分程度）
data-quick:
	cd batch && ../$(PY) -m src.build --limit 300

## 開発サーバー
dev:
	cd web && npm run dev

## 本番ビルド
build:
	cd web && npm run build

## ビルド結果をローカルで配信して確認
preview:
	cd web && npm run build && npm run preview

clean:
	rm -rf web/dist batch/.cache
