import React, { useEffect, useRef, useState } from "react";
import { apiClient, FinancialInput } from "@/api/client";
import { noteDraftRevision, revisionFor } from "@/api/activeAnalysis";
import { useAppStore } from "@/store/useAppStore";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { StateRenderer } from "@/components/ui/StateRenderer";
import { StatementRecord, validateImportedPeriod } from "@/api/statementImport";
import { missingDataLabel } from "@/api/dataAvailability";
import { StatementPreview } from "./StatementPreview";
import { useAnalysisContext } from "@/hooks/useEnvelope";
import { TranslationKey, useT } from "@/i18n";
import { Sparkles, LayoutDashboard } from "lucide-react";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  Trash2,
  Save,
  Check,
} from "lucide-react";

export const ImportPage: React.FC = () => {
  const { setCurrentPage, addToast, setAIPanelOpen } = useAppStore();
  const { accepted, stale } = useAnalysisContext();
  const t = useT();
  const [activeTab, setActiveTab] = useState<"upload" | "manual" | "saved">("manual");
  const [activeSection, setActiveSection] = useState<number>(1);
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const [statementRecords, setStatementRecords] = useState<StatementRecord[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("financial-input-draft-v1") || "null");
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        return { currency: "THB", kind: "actual", ...Object.fromEntries(Object.entries(saved).filter(([, value]) => typeof value === "string")) };
      }
    } catch { /* An unavailable draft store must not prevent manual entry. */ }
    return { currency: "THB", kind: "actual" };
  });

  const fields: { key: string; label: string; section: number; type?: string; required?: boolean; signed?: boolean }[] = [
    { key: "currency", label: "Currency (THB)", section: 1, type: "text", required: true },
    { key: "kind", label: "Data type (actual / forecast / simulated)", section: 1, type: "text", required: true },
    { key: "period_start", label: "Period start date", section: 1, type: "date", required: true },
    { key: "period_end", label: "Period end date", section: 1, type: "date", required: true },
    { key: "total_expenses", label: "Total expenses for period (฿)", section: 2 },
    { key: "cost_of_goods_sold", label: "Cost of goods sold for period (฿)", section: 2 },
    { key: "operating_expenses", label: "Operating expenses for period (฿)", section: 2 },
    { key: "interest_expense", label: "Interest expense for period (฿)", section: 2 },
    { key: "tax_expense", label: "Tax expense for period (฿)", section: 2 },
    { key: "net_income", label: "Net income for period (฿)", section: 2, signed: true },
    { key: "operating_cash_flow", label: "Operating cash flow (฿)", section: 3, signed: true },
    { key: "investing_cash_flow", label: "Investing cash flow (฿)", section: 3, signed: true },
    { key: "financing_cash_flow", label: "Financing cash flow (฿)", section: 3, signed: true },
    { key: "capital_expenditure", label: "Capital expenditure (฿)", section: 3 },
    { key: "operating_cash_outflow", label: "Operating cash outflow (฿)", section: 3 },
    { key: "assets", label: "Total assets (฿)", section: 4, required: true },
    { key: "liabilities", label: "Total liabilities (฿)", section: 4, required: true },
    { key: "equity", label: "Owner's equity (฿)", section: 4, required: true, signed: true },
    { key: "opening_assets", label: "Opening assets (฿)", section: 4 },
    { key: "opening_equity", label: "Opening owner's equity (฿)", section: 4, signed: true },
    { key: "current_assets", label: "Current assets (฿)", section: 5 },
    { key: "current_liabilities", label: "Current liabilities (฿)", section: 5 },
    { key: "working_capital_needed", label: "Working capital required (฿)", section: 5 },
    { key: "buyer_deposit", label: "Available buyer deposit (฿)", section: 5 },
    { key: "committed_funding", label: "Committed funding (฿)", section: 5 },
    { key: "inventory", label: "Ending inventory value (฿)", section: 6 },
    { key: "cash_available_for_debt_service", label: "Cash available for debt service (฿)", section: 7, signed: true },
    { key: "debt_principal_due", label: "Principal due this period (฿)", section: 7 },
    { key: "debt_interest_due", label: "Interest due this period (฿)", section: 7 },
    { key: "loan.principal", label: "Loan principal under consideration (฿)", section: 7 },
    { key: "loan.annual_interest_rate", label: "Annual interest rate as a decimal (e.g. 0.12)", section: 7 },
    { key: "loan.periods", label: "Number of loan periods", section: 7, type: "integer" },
    { key: "loan.payments_per_year", label: "Payments per year", section: 7, type: "integer" },
    { key: "loan.timing", label: "Payment timing (end / beginning)", section: 7, type: "text" },
    { key: "units_sold", label: "Units sold this period", section: 8, type: "integer" },
    { key: "unit_price", label: "Selling price per unit (฿)", section: 8 },
    { key: "variable_cost_per_unit", label: "Variable cost per unit (฿)", section: 8 },
    { key: "fixed_costs", label: "Fixed costs for period (฿)", section: 8 },
    { key: "initial_investment", label: "Initial investment (฿)", section: 8 },
    { key: "investment_net_gain", label: "Net gain from investment (฿)", section: 8, signed: true },
  ];

  const updateDraft = (key: string, value: string) => {
    setDraft((previous) => {
      const next = { ...previous, [key]: value };
      try { sessionStorage.setItem("financial-input-draft-v1", JSON.stringify(next)); } catch { /* Optional local draft only. */ }
      return next;
    });
  };

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    noteDraftRevision(revisionFor(draft));
  }, [draft]);

  // Stepper Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<"idle" | "reading" | "validating" | "analyzing">("idle");

  const sections = [
    { id: 1, title: "1. Business Details & Industry", status: "incomplete" },
    { id: 2, title: "2. Revenue & Expenses", status: "incomplete" },
    { id: 3, title: "3. Cash Balance & Bank Accounts", status: "incomplete" },
    { id: 4, title: "4. Assets, Liabilities & Equity", status: "incomplete" },
    { id: 5, title: "5. Accounts Receivable & Payable", status: "incomplete" },
    { id: 6, title: "6. Fresh Inventory", status: "incomplete" }, // Shows Rule #3 demonstration!
    { id: 7, title: "7. Loan Payments & Due Dates", status: "incomplete" },
    { id: 8, title: "8. Products & Sales Mix", status: "incomplete" },
  ].map((section) => ({ ...section, title: t(`importSec.${section.id}` as TranslationKey), status: fields.some((field) => field.section === section.id)
    && fields.filter((field) => field.section === section.id && !field.key.startsWith("loan.")).every((field) => draft[field.key]?.trim())
    ? "complete" : "incomplete" }));

  // Fields of the open section the user has not filled in. An empty optional
  // field is sent as unknown, never as zero.
  const emptyInSection = fields
    .filter((field) => field.section === activeSection && !draft[field.key]?.trim())
    .map((field) => field.key);

  const runAnalysis = async (file?: File) => {
    if (busy.current) return; // One submission at a time; a second click is ignored.
    busy.current = true;
    setIsAnalyzing(true);
    setAnalysisStep("reading");
    // The revision identifies the exact draft this result belongs to, so a
    // later edit marks the result stale instead of passing it off as current.
    const revision = file ? null : revisionFor(draft);
    try {
      let input: FinancialInput;
      if (file) {
        setStatementRecords(null);
        const preview = await apiClient.previewStatement(file);
        if (preview.format === "statements") {
          setStatementRecords(preview.statements);
          return;
        }
        input = preview.input;
      } else {
        validateImportedPeriod(draft);
        const values: Record<string, unknown> = {};
        const loan: Record<string, string | number> = {};
        for (const field of [...fields, { key: "revenue" }, { key: "cash_balance" }, { key: "minimum_cash_reserve" }]) {
          const value = draft[field.key]?.trim();
          if (!value) continue; // Unknown is absent, never silently zero.
          const integer = field.key === "units_sold" || field.key === "loan.periods" || field.key === "loan.payments_per_year";
          if (integer && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))) throw new Error(`${field.key}: Enter a whole number.`);
          const parsed = integer ? Number(value) : value;
          if (field.key.startsWith("loan.")) loan[field.key.slice(5)] = parsed;
          else values[field.key] = parsed;
        }
        if (Object.keys(loan).length) values.loan = loan;
        input = values as FinancialInput;
      }
      setAnalysisStep("validating");
      input = (await apiClient.validateManual(input)).data;
      const context = { input_revision: revision || revisionFor(input) };
      if (!file) await apiClient.calculate(input, context);
      setAnalysisStep("analyzing");
      // shop_name is free text for display. It never becomes an SME identity,
      // so imported results stay unattached until a real identity is supplied.
      const result = await apiClient.analyze(input, file ? file.name : draft.shop_name, context);
      const missingFields = result.missing || [];
      const gap = missingFields.length;
      const missingSummary = missingFields.slice(0, 3).map(missingDataLabel).join(", ");
      addToast({
        type: gap ? "warning" : "success",
        title: gap ? t("import.toast.incomplete") : t("import.toast.complete"),
        message: gap
          ? t("import.toast.missing", { grade: result.data.grading?.grade || t("common.unknown"), list: missingSummary || t("import.nItems", { n: gap }), more: gap > 3 ? t("import.andMore", { n: gap - 3 }) : "" })
          : t("import.toast.ok", { grade: result.data.grading?.grade || t("common.unknown") }),
        duration: gap ? 9000 : undefined,
      });
      setCurrentPage("overview");
    } catch (error) {
      addToast({ type: "error", title: t("import.validation"), message: error instanceof Error ? error.message : t("import.calcFailed"), duration: 10000 });
    } finally {
      busy.current = false;
      setIsAnalyzing(false);
      setAnalysisStep("idle");
    }
  };

  const handleStartAnalysis = () => { void runAnalysis(); };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 text-ink animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borderLine pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-display font-bold text-ink">
              {t("import.title")}
            </h1>
            <DataKindBadge kind={draft.kind === "forecast" || draft.kind === "simulated" ? draft.kind : "actual"} size="md" />
          </div>
          <p className="text-xs text-ink-muted mt-0.5">
            {t("import.subtitle")}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex w-full sm:w-auto items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "upload" ? "bg-white text-brand shadow-2xs" : "text-ink-muted"
            }`}
          >
            {t("import.tabUpload")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("manual")}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "manual" ? "bg-white text-brand shadow-2xs" : "text-ink-muted"
            }`}
          >
            {t("import.tabManual")}
          </button>
        </div>
      </div>

      {/* สถานะผลวิเคราะห์ล่าสุด + ปุ่มไปขั้นตอนถัดไป */}
      {accepted && (
        <div role="status" className={`animate-rise p-4 rounded-card border flex flex-col md:flex-row md:items-center justify-between gap-3 ${stale ? "bg-amber-50 border-amber-300" : "bg-emerald-50 border-emerald-200"}`}>
          <div className="text-xs space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 font-bold text-ink">
              {stale ? <AlertTriangle className="w-4 h-4 text-attention" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              <span>{stale ? t("import.status.stale") : t("import.status.ready")}</span>
              <DataKindBadge kind={accepted.input.kind} />
            </div>
            <p className="text-ink-muted">
              {t("import.status.period", { start: accepted.input.period_start, end: accepted.input.period_end })}
              {" · "}{t("import.status.grade", { grade: accepted.result.data.grading?.grade ?? t("common.notAvailable") })}
              {accepted.result.missing?.length ? ` · ${t("import.status.missing", { n: accepted.result.missing.length })}` : ""}
              {stale ? ` · ${t("import.status.staleNote")}` : ""}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            {stale && (
              <button type="button" disabled={isAnalyzing} onClick={handleStartAnalysis}
                className="px-3 py-2 bg-brand text-white rounded-btn text-xs font-semibold disabled:opacity-50">
                {t("import.analyzeAgain")}
              </button>
            )}
            <button type="button" onClick={() => setCurrentPage("overview")}
              className="px-3 py-2 bg-white border border-borderLine rounded-btn text-xs font-semibold flex items-center justify-center gap-1.5">
              <LayoutDashboard className="w-3.5 h-3.5" /> {t("import.viewOverview")}
            </button>
            <button type="button" onClick={() => setAIPanelOpen(true)}
              className="px-3 py-2 bg-brand/10 border border-brand/30 text-brand rounded-btn text-xs font-semibold flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> {t("import.explainAi")}
            </button>
          </div>
        </div>
      )}

      {/* Mode 1: File Dropzone & Column Mapping */}
      {activeTab === "upload" ? (
        <div className="space-y-6">
          <div className="p-5 sm:p-8 border-2 border-dashed border-borderLine hover:border-brand rounded-card bg-white text-center space-y-3 transition-colors cursor-pointer"
            role="button" tabIndex={0} aria-label={t("import.drop")}
            onClick={() => !busy.current && fileInput.current?.click()}
            onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); fileInput.current?.click(); } }}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
            onDrop={(event) => { event.preventDefault(); if (event.dataTransfer.files.length !== 1) { addToast({ type: "error", title: t("import.validation"), message: t("import.oneFile") }); return; } void runAnalysis(event.dataTransfer.files[0]); }}>
            <input ref={fileInput} type="file" accept=".xlsx" hidden disabled={isAnalyzing}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void runAnalysis(file); }} />
            <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mx-auto">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm text-ink">
                {t("import.drop")}
              </h3>
              <p className="text-xs text-ink-muted mt-0.5">
                {t("import.supports")}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                className="px-4 py-2 bg-brand text-white text-xs font-bold rounded-btn hover:bg-brand-dark"
                disabled={isAnalyzing}
                onClick={(event) => { event.stopPropagation(); fileInput.current?.click(); }}
              >
                {t("import.choose")}
              </button>
              <button
                type="button"
                className="px-3.5 py-2 border border-slate-200 text-ink text-xs font-medium rounded-btn hover:bg-slate-50 flex items-center gap-1.5"
                onClick={(event) => { event.stopPropagation(); void apiClient.downloadTemplate().catch((error) => addToast({ type: "error", title: t("import.templateFailed"), message: error.message })); }}
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t("import.template")}</span>
              </button>
            </div>
          </div>

          {statementRecords && <StatementPreview records={statementRecords} onImport={(values) => {
            setDraft(values);
            try { sessionStorage.setItem("financial-input-draft-v1", JSON.stringify(values)); } catch { /* Optional draft store. */ }
            setStatementRecords(null);
            setActiveSection(1);
            setActiveTab("manual");
            addToast({ type: "warning", title: t("import.statementSelected"), message: t("import.reviewFigures"), duration: 10000 });
          }} />}

          {/* Template layout the parser actually reads (no automatic mapping) */}
          <div className="bg-white p-5 rounded-card border border-borderLine space-y-3">
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-ink">
              {t("import.templateRules")}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-ink-muted block">{t("import.sheetsRead")}</span>
                <span className="font-bold text-ink">Financials</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-ink-muted block">{t("import.columns")}</span>
                <span className="font-bold text-ink">field ↔ value</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-ink-muted block">{t("import.dataRows")}</span>
                <span className="font-bold text-ink">{t("import.fieldNames")}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-ink-muted block">{t("import.blankUnknown")}</span>
                <span className="font-bold text-ink">{t("import.neverZero")}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Mode 2: 8-Section Long Manual Form with Sticky Nav */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Sticky Left Section Nav */}
          <div className="lg:col-span-4 bg-white p-4 rounded-card border border-borderLine shadow-soft-sm lg:sticky lg:top-24 space-y-2">
            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block px-1">
              {t("import.categories")}
            </span>
            <div className="space-y-1">
              {sections.map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between transition-all ${
                    activeSection === sec.id
                      ? "bg-brand/10 text-brand font-bold border border-brand/20"
                      : "hover:bg-slate-50 text-ink"
                  }`}
                >
                  <span className="truncate">{sec.title}</span>
                  {sec.status === "complete" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-attention shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {/* Validation & Submit Button */}
            <div className="pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleStartAnalysis}
                disabled={isAnalyzing}
                className="w-full py-2.5 bg-brand hover:bg-brand-dark text-white rounded-btn text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <span>{isAnalyzing ? t("import.processing") : t("import.confirm")}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Form Content Area */}
          <div className="lg:col-span-8 bg-white p-4 sm:p-6 rounded-card border border-borderLine shadow-soft-sm space-y-6">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h3 className="font-display font-bold text-sm text-ink">
                {t("import.section", { n: activeSection, title: sections.find((s) => s.id === activeSection)?.title || "" })}
              </h3>
              <span className="text-xs text-ink-muted font-medium">{t("import.draftSaved")}</span>
            </div>

            {draft.statement_year && <p className="text-xs text-brand">{t("import.statementYear", { year: draft.statement_year })}</p>}

            {/* Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-ink block mb-1">{t("import.shopName")}</label>
                <input
                  type="text"
                  name="shop_name" aria-label={t("import.shopName")} value={draft.shop_name || ""}
                  onChange={(event) => updateDraft("shop_name", event.target.value)} maxLength={200} disabled={isAnalyzing}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">{t("import.revenue")}</label>
                <input
                  type="number"
                  name="revenue" aria-label={t("import.revenue")} value={draft.revenue || ""}
                  onChange={(event) => updateDraft("revenue", event.target.value)} step="0.01" min="0" disabled={isAnalyzing}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">{t("import.cashBalance")}</label>
                <input
                  type="number"
                  name="cash_balance" aria-label={t("import.cashBalance")} value={draft.cash_balance || ""}
                  onChange={(event) => updateDraft("cash_balance", event.target.value)} step="0.01" min="0" disabled={isAnalyzing}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">{t("import.minReserve")}</label>
                <input
                  type="number"
                  name="minimum_cash_reserve" aria-label={t("import.minReserve")} value={draft.minimum_cash_reserve || ""}
                  onChange={(event) => updateDraft("minimum_cash_reserve", event.target.value)} step="0.01" min="0" disabled={isAnalyzing}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand font-mono font-bold"
                />
              </div>
              {fields.filter((field) => field.section === activeSection).map((field) => (
                <div key={field.key}>
                  <label htmlFor={`financial-${field.key}`} className="font-bold text-ink block mb-1">{t(`field.${field.key}` as TranslationKey)}</label>
                  <input id={`financial-${field.key}`} name={field.key} aria-label={t(`field.${field.key}` as TranslationKey)}
                    type={field.type === "integer" ? "number" : field.type || "number"}
                    value={draft[field.key] || ""} required={field.required} disabled={isAnalyzing}
                    step={field.type === "date" || field.type === "integer" ? "1" : field.key === "loan.annual_interest_rate" ? "any" : "0.01"}
                    min={!field.signed && (!field.type || field.type === "integer") ? "0" : undefined}
                    onChange={(event) => updateDraft(field.key, event.target.value)}
                    onInput={(event) => updateDraft(field.key, event.currentTarget.value)}
                    onBlur={(event) => updateDraft(field.key, event.currentTarget.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand font-mono font-bold" />
                </div>
              ))}
            </div>

            {/* Row Validation Alert (Part B Rule #3) — from the live draft */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-attention mt-0.5 shrink-0" />
              <div>
                <strong>{t("import.validationColon")}</strong>{" "}
                {emptyInSection.length
                  ? t("import.blankFields", { n: emptyInSection.length, list: emptyInSection.join(", ") })
                  : t("import.sectionComplete")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stepper Modal during analysis */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-50 bg-navy-deep/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-card shadow-soft-lg p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center mx-auto animate-spin">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-bold text-ink text-sm">
                {t("import.analyzing")}
              </h3>
              <p className="text-xs text-ink-muted mt-1">
                {analysisStep === "reading" && t("import.step1")}
                {analysisStep === "validating" && t("import.step2")}
                {analysisStep === "analyzing" && t("import.step3")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
