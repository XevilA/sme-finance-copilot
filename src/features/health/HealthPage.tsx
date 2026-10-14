import React, { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { HealthIndicator, Envelope } from "@/api/contracts/types";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { StateRenderer } from "@/components/ui/StateRenderer";
import { useAnalysisStore } from "@/store/useAnalysisStore";
import {
  HeartPulse,
  TrendingUp,
  AlertTriangle,
  HelpCircle,
  FileQuestion,
  Info,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export const HealthPage: React.FC = () => {
  const { setAIPanelOpen, setCurrentPage } = useAppStore();
  const { result, inputJson, isStale, setInputJson, setResult, markStale } = useAnalysisStore();
  const [indicatorsEnvelope, setIndicatorsEnvelope] = useState<Envelope<HealthIndicator[]> | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [inspectFormulaId, setInspectFormulaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [useLlm, setUseLlm] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const evidenceTarget = useAppStore((state) => state.activeEvidenceTargetId);

  const loadData = () => {
    setError(null);
    if (result) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiClient
      .getHealthIndicators()
      .then((res) => {
        setIndicatorsEnvelope(res);
        setLoading(false);
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Cannot load financial indicators.");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [result]);

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    if (evidenceTarget?.startsWith("health-")) setActiveCategory("all");
  }, [evidenceTarget]);

  useEffect(() => {
    if (evidenceTarget?.startsWith("health-")) {
      document.getElementById(evidenceTarget)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [evidenceTarget, activeCategory]);

  const runAnalysis = async (file?: File, exampleOnly = false) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setAnalyzing(true);
    setError(null);
    markStale();
    try {
      if (exampleOnly) {
        const example = await apiClient.getAnalysisExample(controller.signal);
        setInputJson(JSON.stringify(example.data, null, 2));
      } else if (file) {
        if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > 5 * 1024 * 1024) {
          throw new Error("Upload a .xlsx workbook no larger than 5 MiB.");
        }
        setResult(await apiClient.analyzeExcel(file, useLlm, controller.signal));
      } else {
        const input = JSON.parse(inputJson);
        if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Financial input must be a JSON object.");
        setResult(await apiClient.analyzeFinancials(input, useLlm, controller.signal));
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Analysis failed.");
    } finally {
      if (!controller.signal.aborted) setAnalyzing(false);
    }
  };

  const indicators = result?.data.indicators ?? indicatorsEnvelope?.data ?? [];
  const dataKind = result?.kind ?? indicatorsEnvelope?.kind ?? "simulated";
  const filtered =
    activeCategory === "all"
      ? indicators
      : indicators.filter((i) => i.category === activeCategory);

  return (
    <StateRenderer onRetry={loadData}>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 text-ink animate-fade-in">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borderLine pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-brand text-white flex items-center justify-center font-bold">
                <HeartPulse className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-display font-bold text-ink">
                สุขภาพการเงิน 5 มิติ (Financial Health Diagnostics)
              </h1>
              <DataKindBadge kind={dataKind} size="md" />
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              ตรวจสภาพคล่อง ความสามารถทำกำไร ภาระหนี้ ประสิทธิภาพหมุนเวียน และการเติบโต
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAIPanelOpen(true)}
              className="px-3.5 py-1.5 bg-brand/10 hover:bg-brand/20 border border-brand/30 text-brand text-xs font-bold rounded-btn flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>ให้ AI อธิบายตัวชี้วัด</span>
            </button>
          </div>
        </div>

        <section aria-label="Financial analysis input" className="bg-white p-5 rounded-card border border-borderLine space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="financial-input-json" className="text-sm font-bold">Financial input (JSON or Excel)</label>
            <button type="button" disabled={analyzing} onClick={() => void runAnalysis(undefined, true)}
              className="text-xs font-bold text-brand disabled:opacity-50">Load simulated example</button>
          </div>
          <textarea id="financial-input-json" value={inputJson} onChange={(event) => setInputJson(event.target.value)}
            disabled={analyzing} rows={8} spellCheck={false} placeholder="Paste FinancialInput JSON, or load the simulated example."
            className="w-full p-3 border border-slate-200 rounded-xl text-xs font-mono" />
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <button type="button" disabled={analyzing || !inputJson.trim()} onClick={() => void runAnalysis()}
              className="px-4 py-2 bg-brand text-white rounded-btn font-bold disabled:opacity-50">
              {analyzing ? "Analyzing..." : "Calculate and analyze"}
            </button>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={useLlm} disabled={analyzing} onChange={(event) => setUseLlm(event.target.checked)} />
              Model-assisted priorities (optional)
            </label>
            <label className="flex flex-col gap-1">
              <span>Analyze Excel (.xlsx, up to 5 MiB)</span>
              <input aria-label="Analyze Excel" type="file" accept=".xlsx" disabled={analyzing} onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void runAnalysis(file);
                event.target.value = "";
              }} />
            </label>
            <a href={apiClient.getAnalysisTemplateUrl()} download className="text-brand font-bold">Download Excel template</a>
          </div>
          {!result && <p className="text-xs text-ink-muted">The preview below is simulated. Run analysis to use the backend with your supplied inputs.</p>}
          {error && <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">{error}</div>}
          {isStale && <p role="status" className="text-xs text-amber-800">Inputs changed. Displayed results refer to the previous analysis; calculate again.</p>}
          {result && <div id="health-grade" className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex flex-wrap items-center gap-3 text-sm font-bold">
              <span>Grade: {result.data.grading.grade ?? "Unavailable"}</span>
              <span>Score: {result.data.grading.score ?? "Unavailable"} / 100</span>
              <span className="text-xs font-normal">{result.data.grading.policyVersion} · {result.data.aiMode === "openai" ? "Model-assisted" : "Rules-based"}</span>
            </div>
            <p className="text-xs text-ink-muted">{result.data.grading.notice}</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
              {Object.entries(result.data.grading.components).map(([key, component]) => (
                <div key={key}><strong>{key}</strong>: {component.score ?? "Unavailable"} · weight {component.weight}
                  <p className="text-ink-muted">{component.reason || component.missingFields.join(", ")}</p>
                </div>
              ))}
            </div>
            {result.data.aiWarning && <p role="status" className="text-xs text-amber-800">{result.data.aiWarning}</p>}
            {result.status === "insufficient_data" && <p className="text-xs text-amber-800">Some metrics are unavailable. See each card and the AI Panel for missing inputs and undefined calculations.</p>}
          </div>}
        </section>

        {loading && !result && <p role="status" className="text-xs">Loading indicator preview...</p>}
        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: "all", label: "ตัวชี้วัดทั้งหมด" },
            { id: "liquidity", label: "💧 สภาพคล่อง (Liquidity)" },
            { id: "profitability", label: "📈 การทำกำไร (Profitability)" },
            { id: "debt", label: "⚖️ ภาระหนี้ (Debt)" },
            { id: "efficiency", label: "⚙️ ประสิทธิภาพ (Efficiency)" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-chip font-medium whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? "bg-brand text-white shadow-xs font-bold"
                  : "bg-white border border-borderLine text-ink hover:border-brand/40"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Indicators Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const isInsufficient = item.status === "insufficient" || item.value === null;

            return (
              <div
                id={item.id}
                key={item.id}
                className={`p-5 rounded-card border transition-all duration-200 flex flex-col justify-between space-y-3 ${
                  isInsufficient
                    ? "bg-amber-50/50 border-amber-300"
                    : "bg-white border-borderLine hover:border-brand/40 hover:shadow-soft-md"
                }`}
              >
                <div>
                  {/* Card Header: Name & Benchmark */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-[10px] font-mono text-ink-muted uppercase">
                        {item.nameEn}
                      </span>
                      <h3 className="font-display font-bold text-xs text-ink leading-snug">
                        {item.name}
                      </h3>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-chip border shrink-0 ${
                        item.status === "good"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : item.status === "warning"
                          ? "bg-amber-50 text-amber-800 border-amber-300"
                          : item.status === "danger"
                          ? "bg-red-50 text-danger border-danger/30"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {item.status === "good"
                        ? "เกณฑ์ดี"
                        : item.status === "warning"
                        ? "เฝ้าระวัง"
                        : item.status === "danger"
                        ? "ตึงตัว"
                        : "ข้อมูลไม่พอ"}
                    </span>
                  </div>

                  {/* Value or Insufficient Data Alert (Strict Rule #3: Never show 0!) */}
                  {isInsufficient ? (
                    <div className="p-3 bg-white rounded-xl border border-amber-200 space-y-1.5 my-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                        <FileQuestion className="w-4 h-4 text-attention shrink-0" />
                        <span>คำนวณไม่ได้ ขาด:</span>
                      </div>
                      <ul className="text-[11px] text-amber-800 list-disc pl-4 space-y-0.5">
                        {item.missingFields?.map((mf, idx) => (
                          <li key={idx}>{mf}</li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => setCurrentPage("import")}
                        className="text-[10px] font-bold text-brand hover:underline block pt-1"
                      >
                        + ไปเพิ่มข้อมูลที่ขาดในหน้าข้อมูลธุรกิจ
                      </button>
                    </div>
                  ) : (
                    <div className="my-2">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-extrabold font-mono text-ink tabular-nums">
                          {item.value}
                        </span>
                        <span className="text-xs font-semibold text-ink-muted">{item.unit}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        เกณฑ์มาตรฐาน: {item.benchmark}
                      </span>
                    </div>
                  )}

                  {/* Interpretation Note */}
                  <p className="text-[11px] text-ink-muted leading-relaxed line-clamp-2">
                    {item.interpretation}
                  </p>
                </div>

                {/* Footer: Formula Inspector */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <button
                    type="button"
                    onClick={() =>
                      setInspectFormulaId(inspectFormulaId === item.id ? null : item.id)
                    }
                    className="text-brand hover:underline font-medium flex items-center gap-1"
                  >
                    <Info className="w-3 h-3" />
                    <span>{inspectFormulaId === item.id ? "ซ่อนสูตร" : "ดูสูตรที่ใช้"}</span>
                  </button>

                  <DataKindBadge kind={dataKind} size="sm" />
                </div>

                {/* Formula Popover Dropdown */}
                {inspectFormulaId === item.id && (
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[10px] text-ink-muted font-mono animate-fade-in">
                    <strong>สูตร:</strong> {item.formula}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </StateRenderer>
  );
};
