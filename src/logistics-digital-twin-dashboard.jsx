import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";

// ============================================================
// 配車手配 デジタルツイン・ダッシュボード
// As-Is リアル実績 → As-Is ルート最適化 → To-Be 曜日集約
// データソース：手配実績データ × 運賃単価マスター（GPS実測なし）
// ============================================================

// ---- 運賃単価マスター（円/便）----
const RATE_MASTER = { "2t": 18000, "4t": 25000, "10t": 42000 };

// ---- 手配実績モックデータ（週次・10納品先）----
// optFactor: 同日同一エリア名寄せによる巡回距離削減係数（0.70〜0.82 ≒ ▲18〜30%）
const SHIPMENTS = [
  { id: 1,  dest: "小売X社 北関東DC",       area: "埼玉",   route: "埼玉ルートA",   vehicle: "4t",  trips: 5, revenue: 480000, distPerTrip: 85, optFactor: 0.70, variance: true  },
  { id: 2,  dest: "小売Y社 川口センター",   area: "埼玉",   route: "埼玉ルートA",   vehicle: "4t",  trips: 5, revenue: 420000, distPerTrip: 78, optFactor: 0.70, variance: false },
  { id: 3,  dest: "量販Z社 熊谷店",         area: "埼玉",   route: "埼玉ルートB",   vehicle: "2t",  trips: 3, revenue: 210000, distPerTrip: 95, optFactor: 0.78, variance: true  },
  { id: 4,  dest: "食品スーパーP社 大宮物流C", area: "埼玉", route: "埼玉ルートA",   vehicle: "2t",  trips: 4, revenue: 300000, distPerTrip: 72, optFactor: 0.72, variance: false },
  { id: 5,  dest: "卸売Q社 幕張倉庫",       area: "千葉",   route: "千葉ルートC",   vehicle: "10t", trips: 5, revenue: 520000, distPerTrip: 60, optFactor: 0.74, variance: false },
  { id: 6,  dest: "食品スーパーR社 船橋DC", area: "千葉",   route: "千葉ルートC",   vehicle: "4t",  trips: 4, revenue: 310000, distPerTrip: 55, optFactor: 0.74, variance: true  },
  { id: 7,  dest: "量販S社 柏センター",     area: "千葉",   route: "千葉ルートD",   vehicle: "4t",  trips: 3, revenue: 240000, distPerTrip: 68, optFactor: 0.80, variance: false },
  { id: 8,  dest: "小売T社 横浜港北C",      area: "神奈川", route: "神奈川ルートE", vehicle: "4t",  trips: 5, revenue: 450000, distPerTrip: 48, optFactor: 0.72, variance: false },
  { id: 9,  dest: "食品スーパーU社 川崎DC", area: "神奈川", route: "神奈川ルートE", vehicle: "4t",  trips: 4, revenue: 330000, distPerTrip: 42, optFactor: 0.72, variance: true  },
  { id: 10, dest: "小売V社 相模原センター", area: "神奈川", route: "神奈川ルートF", vehicle: "2t",  trips: 2, revenue: 160000, distPerTrip: 88, optFactor: 0.82, variance: false },
];

// ---- フェーズ別計算ロジック ----
// Phase1: 手配数 × 単価マスター / 距離 = 個別配送の単純合算（標準巡回ルート擬似計算）
// Phase2: 同日同一エリア名寄せ。便数・曜日は不変、距離▲20〜30% → 実原価も同率で低減
// Phase3: 週2回へ曜日集約。便数削減（大型化ペナルティ +20%/便）で原価を構造的に削減
function calcRow(s) {
  const unit = RATE_MASTER[s.vehicle];
  const asIsCost = s.trips * unit;
  const asIsDist = s.trips * s.distPerTrip;

  const optCost = Math.round(asIsCost * s.optFactor);
  const optDist = Math.round(asIsDist * s.optFactor);

  const tobeTrips = Math.min(s.trips, 2);
  const upsize = s.trips > 2 ? 1.2 : 1.0; // 積載増による車格アップ分
  const tobeCost = Math.round(tobeTrips * unit * upsize * s.optFactor);
  const tobeDist = Math.round(asIsDist * s.optFactor * (tobeTrips / s.trips));

  return { ...s, unit, asIsCost, asIsDist, optCost, optDist, tobeTrips, tobeCost, tobeDist };
}

const PHASES = [
  { key: "asis", icon: "🔴", label: "As-Is リアル実績",   sub: "個別手配の単純合算",     color: "#f87171", ring: "ring-red-500/60",     bgOn: "bg-red-500/15 border-red-500/60" },
  { key: "opt",  icon: "🟡", label: "As-Is ルート最適化", sub: "日次積み付け改善",       color: "#fbbf24", ring: "ring-amber-400/60",   bgOn: "bg-amber-400/15 border-amber-400/60" },
  { key: "tobe", icon: "🟢", label: "To-Be 曜日集約プラン", sub: "週2回集約・便数削減",   color: "#34d399", ring: "ring-emerald-400/60", bgOn: "bg-emerald-400/15 border-emerald-400/60" },
];

const yen = (v) => "¥" + v.toLocaleString("ja-JP");
const sen = (v) => (v / 1000).toLocaleString("ja-JP", { maximumFractionDigits: 0 });

export default function LogisticsDigitalTwinDashboard() {
  const [phase, setPhase] = useState("asis");
  const [discount, setDiscount] = useState(10); // 競合割引率 %

  const rows = useMemo(() => SHIPMENTS.map(calcRow), []);

  const totals = useMemo(() => {
    const sum = (fn) => rows.reduce((a, r) => a + fn(r), 0);
    return {
      revenue: sum((r) => r.revenue),
      asIsCost: sum((r) => r.asIsCost), asIsDist: sum((r) => r.asIsDist),
      optCost: sum((r) => r.optCost),   optDist: sum((r) => r.optDist),
      tobeCost: sum((r) => r.tobeCost), tobeDist: sum((r) => r.tobeDist),
    };
  }, [rows]);

  const active = useMemo(() => {
    const map = {
      asis: { cost: totals.asIsCost, dist: totals.asIsDist },
      opt:  { cost: totals.optCost,  dist: totals.optDist },
      tobe: { cost: totals.tobeCost, dist: totals.tobeDist },
    };
    const { cost, dist } = map[phase];
    const margin = ((totals.revenue - cost) / totals.revenue) * 100;
    return { cost, dist, margin };
  }, [phase, totals]);

  // ---- 競合リプレイス脅威度 ----
  // 競合（A社・B社）想定見積 = 自社請求額 × 定価係数1.15 × (1 - 割引率)
  const competitor = useMemo(() => {
    const quote = Math.round(totals.revenue * 1.15 * (1 - discount / 100));
    const ratio = quote / totals.revenue;
    let level, color, msg;
    if (ratio < 1.0)       { level = "危険"; color = "text-red-400";     msg = "競合見積が自社請求額を下回っています"; }
    else if (ratio < 1.1)  { level = "警戒"; color = "text-amber-300";   msg = "価格差10%未満。荷主の相見積リスクあり"; }
    else                   { level = "安全"; color = "text-emerald-300"; msg = "自社優位。価格競争力を維持"; }
    return { quote, ratio, level, color, msg };
  }, [totals.revenue, discount]);

  const phaseDef = PHASES.find((p) => p.key === phase);
  const savingVsAsIs = totals.asIsCost - active.cost;

  const chartData = [
    { name: "🔴 リアル実績",   原価: Math.round(totals.asIsCost / 1000), 距離: totals.asIsDist },
    { name: "🟡 ルート最適化", 原価: Math.round(totals.optCost / 1000),  距離: totals.optDist },
    { name: "🟢 曜日集約",     原価: Math.round(totals.tobeCost / 1000), 距離: totals.tobeDist },
  ];

  const costOf = (r) => (phase === "asis" ? r.asIsCost : phase === "opt" ? r.optCost : r.tobeCost);
  const distOf = (r) => (phase === "asis" ? r.asIsDist : phase === "opt" ? r.optDist : r.tobeDist);
  const tripsOf = (r) => (phase === "tobe" ? r.tobeTrips : r.trips);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ヘッダー */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
          <div>
            <p className="text-xs tracking-widest text-cyan-400 font-semibold">LOGISTICS DIGITAL TWIN</p>
            <h1 className="text-2xl md:text-3xl font-bold">配車手配 潜在ロス分析ダッシュボード</h1>
            <p className="text-sm text-slate-400 mt-1">手配実績データ × 運賃単価マスター起点｜週次シミュレーション（GPS実測なし・擬似巡回計算）</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">対As-Is原価削減ポテンシャル</p>
            <p className={`text-xl font-bold ${savingVsAsIs > 0 ? "text-emerald-400" : "text-slate-400"}`}>
              {savingVsAsIs > 0 ? "▲" + yen(savingVsAsIs) + " /週" : "—（基準フェーズ）"}
            </p>
          </div>
        </header>

        {/* フェーズ切替トグル */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PHASES.map((p) => (
            <button
              key={p.key}
              onClick={() => setPhase(p.key)}
              className={`text-left rounded-xl border px-4 py-3 transition-all duration-200
                ${phase === p.key
                  ? `${p.bgOn} ring-2 ${p.ring} shadow-lg`
                  : "bg-slate-800/60 border-slate-700 hover:border-slate-500"}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{p.icon}</span>
                <span className="font-semibold text-sm md:text-base">{p.label}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{p.sub}</p>
            </button>
          ))}
        </div>

        {/* KPIカード */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl bg-slate-800/70 border border-slate-700 p-4">
            <p className="text-xs text-slate-400">総走行距離 / 週</p>
            <p className="text-2xl md:text-3xl font-bold mt-1" style={{ color: phaseDef.color }}>
              {active.dist.toLocaleString()}<span className="text-sm text-slate-400 ml-1">km</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">標準巡回ルート擬似計算</p>
          </div>

          <div className="rounded-xl bg-slate-800/70 border border-slate-700 p-4">
            <p className="text-xs text-slate-400">実配送コスト（支払原価）</p>
            <p className="text-2xl md:text-3xl font-bold mt-1" style={{ color: phaseDef.color }}>
              {yen(active.cost)}
            </p>
            <p className="text-xs text-slate-500 mt-1">手配数 × 単価マスター</p>
          </div>

          <div className="rounded-xl bg-slate-800/70 border border-slate-700 p-4">
            <p className="text-xs text-slate-400">自社配送利益率</p>
            <p className={`text-2xl md:text-3xl font-bold mt-1 ${active.margin < 10 ? "text-red-400" : active.margin < 20 ? "text-amber-300" : "text-emerald-300"}`}>
              {active.margin.toFixed(1)}<span className="text-sm text-slate-400 ml-1">%</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">請求額 {yen(totals.revenue)} /週</p>
          </div>

          <div className="rounded-xl bg-slate-800/70 border border-slate-700 p-4">
            <p className="text-xs text-slate-400">対競合リプレイス脅威度</p>
            <p className={`text-2xl md:text-3xl font-bold mt-1 ${competitor.color}`}>{competitor.level}</p>
            <p className="text-xs text-slate-500 mt-1">他社見積 {yen(competitor.quote)}（自社比 {(competitor.ratio * 100).toFixed(0)}%）</p>
          </div>
        </div>

        {/* 競合割引率スライダー */}
        <div className="rounded-xl bg-slate-800/70 border border-slate-700 p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="md:w-64">
              <p className="text-sm font-semibold">競合（A社・B社）割引率シナリオ</p>
              <p className="text-xs text-slate-400">定価係数115%からの値引きを想定</p>
            </div>
            <input
              type="range" min={0} max={40} step={1} value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="flex-1 accent-cyan-400 cursor-pointer"
            />
            <div className="w-28 text-right">
              <span className="text-2xl font-bold text-cyan-300">{discount}</span>
              <span className="text-sm text-slate-400">% OFF</span>
            </div>
          </div>
          <p className={`text-xs mt-2 ${competitor.color}`}>⚠ {competitor.msg}</p>
        </div>

        {/* フェーズ比較チャート */}
        <div className="rounded-xl bg-slate-800/70 border border-slate-700 p-4">
          <h2 className="text-sm font-semibold mb-3">フェーズ別 配送原価（千円） × 総走行距離（km）比較</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fill: "#94a3b8", fontSize: 11 }}
                  label={{ value: "原価（千円）", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#94a3b8", fontSize: 11 }}
                  label={{ value: "距離（km）", angle: 90, position: "insideRight", fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0" }}
                  formatter={(v, name) => [name === "原価" ? v.toLocaleString() + " 千円" : v.toLocaleString() + " km", name]}
                />
                <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 12 }} />
                <Bar yAxisId="left"  dataKey="原価" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                <Bar yAxisId="right" dataKey="距離" fill="#a78bfa" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 明細テーブル */}
        <div className="rounded-xl bg-slate-800/70 border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold">納品先別 明細（表示フェーズ：{phaseDef.icon} {phaseDef.label}）</h2>
            <span className="text-xs text-slate-500">単位：円・km / 週</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm whitespace-nowrap">
              <thead>
                <tr className="text-slate-400 bg-slate-900/60">
                  <th className="px-3 py-2 text-left">納品先</th>
                  <th className="px-3 py-2 text-left">現状ルート</th>
                  <th className="px-3 py-2 text-center">車格</th>
                  <th className="px-3 py-2 text-right">便数/週</th>
                  <th className="px-3 py-2 text-right">売上/週</th>
                  <th className="px-3 py-2 text-right text-red-300">🔴 原価</th>
                  <th className="px-3 py-2 text-right text-amber-200">🟡 原価</th>
                  <th className="px-3 py-2 text-right text-emerald-300">🟢 原価</th>
                  <th className="px-3 py-2 text-right">想定走行距離</th>
                  <th className="px-3 py-2 text-center">数量バラつき</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const margin = ((r.revenue - costOf(r)) / r.revenue) * 100;
                  return (
                    <tr key={r.id} className="border-t border-slate-700/60 hover:bg-slate-700/30 transition-colors">
                      <td className="px-3 py-2 font-medium">
                        {r.dest}
                        <span className={`ml-2 text-[10px] ${margin < 10 ? "text-red-400" : "text-slate-500"}`}>
                          利益率 {margin.toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-300">{r.route}<span className="text-slate-500">（{r.area}）</span></td>
                      <td className="px-3 py-2 text-center text-slate-300">{r.vehicle}</td>
                      <td className="px-3 py-2 text-right">
                        {tripsOf(r)}
                        {phase === "tobe" && r.trips > 2 && (
                          <span className="text-emerald-400 text-[10px] ml-1">（{r.trips}→{r.tobeTrips}）</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{yen(r.revenue)}</td>
                      <td className={`px-3 py-2 text-right ${phase === "asis" ? "font-bold text-red-300" : "text-slate-400"}`}>{sen(r.asIsCost)}千</td>
                      <td className={`px-3 py-2 text-right ${phase === "opt" ? "font-bold text-amber-200" : "text-slate-400"}`}>{sen(r.optCost)}千</td>
                      <td className={`px-3 py-2 text-right ${phase === "tobe" ? "font-bold text-emerald-300" : "text-slate-400"}`}>{sen(r.tobeCost)}千</td>
                      <td className="px-3 py-2 text-right">{distOf(r).toLocaleString()} km</td>
                      <td className="px-3 py-2 text-center">
                        {r.variance
                          ? <span className="inline-block px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/40 text-[10px]">⚠ 荷主都合変動大</span>
                          : <span className="text-slate-600 text-[10px]">安定</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-600 bg-slate-900/60 font-semibold">
                  <td className="px-3 py-2" colSpan={3}>合計</td>
                  <td className="px-3 py-2 text-right">{rows.reduce((a, r) => a + tripsOf(r), 0)}</td>
                  <td className="px-3 py-2 text-right">{yen(totals.revenue)}</td>
                  <td className="px-3 py-2 text-right text-red-300">{sen(totals.asIsCost)}千</td>
                  <td className="px-3 py-2 text-right text-amber-200">{sen(totals.optCost)}千</td>
                  <td className="px-3 py-2 text-right text-emerald-300">{sen(totals.tobeCost)}千</td>
                  <td className="px-3 py-2 text-right">{active.dist.toLocaleString()} km</td>
                  <td className="px-3 py-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <footer className="text-[11px] text-slate-500 pb-4">
          ※ 走行距離はGPS実測ではなく、手配実績からの標準巡回ルート擬似計算値。ルート最適化は同日・同一エリアの名寄せ（混載相積み）による▲18〜30%削減を仮定。曜日集約は週2回上限・車格アップ係数1.2を適用。
        </footer>
      </div>
    </div>
  );
}
