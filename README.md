# README

ブラウザ内で個人情報を自動マスクする Web アプリ。

## パッケージ

### @redactjp/redact

抽出・置換ロジックと人名検出 (kuromoji)。ブラウザ/Node 両対応。

### @redactjp/web-ui

最小の Web クライアント。実行時に `@redactjp/redact` を利用し、辞書は画面表示後に自動で遅延ロードする。

## 実行環境

- Node.js 18 以上
- npm 9 以上
- 最新版の主要ブラウザ (Chrome / Edge / Firefox / Safari)

## 使い方

### 1. 依存モジュールのインストール

```bash
npm install
```

### 2. ビルド

TypeScript の型チェック + esbuild によるバンドル/最小化を行う。

```bash
npm run typecheck
npm run build
```

### 3. Web UI 表示

任意の静的サーバで `@redactjp/web-ui` のビルド成果物を配信、または生成物をブラウザで開く。

```bash
# 例1: npx serve を使う
npx serve dist

# 例2: Python の簡易サーバを使う
python3 -m http.server --directory dist 8080

# 例3: http-server を使う
npx http-server dist -p 8080
```

## ライセンス表示

- kuromoji と辞書 (IPADIC など) のライセンス表記を同梱してください。
