# 配車手配 潜在ロス分析ダッシュボード（logistics-dispatch-dashboard）

物流の配車手配データをもとに、原価削減余地を3フェーズで可視化するデジタルツイン・ダッシュボードです。

## 目的

同じ手配実績データに対して、3つのフェーズで原価と走行距離がどう変化するかをシミュレーションし、削減ポテンシャルを一目で把握できるようにしています。

1. **🔴 As-Is リアル実績** — 個別手配の単純合算（現状の原価）
2. **🟡 As-Is ルート最適化** — 同日・同一エリアの名寄せ（混載相積み）による日次積み付け改善
3. **🟢 To-Be 曜日集約プラン** — 週2回上限への曜日集約による便数削減（車格アップ分を考慮）

あわせて、競合（大手宅配便）の想定見積との比較による価格競争力（リプレイス脅威度）も可視化します。

## スクリーンショット

![screenshot](./docs/screenshot.png)

*(画像は準備中です。`docs/screenshot.png` に差し替えてください)*

## セットアップ手順

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:5173/logistics-dispatch-dashboard/` を開くと表示されます。

本番ビルドの確認:

```bash
npm run build
npm run preview
```

## デモ

GitHub Pagesで公開予定です（デプロイ後にURLを追記します）。

## 注意事項

- 画面内のデータ（納品先・手配実績・金額など）は**すべてモックデータ**です。実在の企業・取引・金額とは一切関係ありません。
- 走行距離はGPS実測ではなく、手配実績からの標準巡回ルートに基づく擬似計算値です。

## 技術スタック

- [Vite](https://vite.dev/) + [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Recharts](https://recharts.org/)
