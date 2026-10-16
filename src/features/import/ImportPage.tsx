import React, { useRef, useState } from "react";
import { apiClient, FinancialInput } from "@/api/client";
import { useAppStore } from "@/store/useAppStore";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { StateRenderer } from "@/components/ui/StateRenderer";
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
  const { setCurrentPage, addToast } = useAppStore();
  const [activeTab, setActiveTab] = useState<"upload" | "manual" | "saved">("manual");
  const [activeSection, setActiveSection] = useState<number>(1);
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
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
    { key: "currency", label: "สกุลเงิน (THB)", section: 1, type: "text", required: true },
    { key: "kind", label: "ประเภทข้อมูล (actual / forecast / simulated)", section: 1, type: "text", required: true },
    { key: "period_start", label: "วันเริ่มงวด", section: 1, type: "date", required: true },
    { key: "period_end", label: "วันสิ้นงวด", section: 1, type: "date", required: true },
    { key: "total_expenses", label: "ค่าใช้จ่ายรวมในงวด (฿)", section: 2 },
    { key: "cost_of_goods_sold", label: "ต้นทุนขายในงวด (฿)", section: 2 },
    { key: "operating_expenses", label: "ค่าใช้จ่ายดำเนินงานในงวด (฿)", section: 2 },
    { key: "interest_expense", label: "ดอกเบี้ยจ่ายในงวด (฿)", section: 2 },
    { key: "tax_expense", label: "ภาษีในงวด (฿)", section: 2 },
    { key: "net_income", label: "กำไรสุทธิในงวด (฿)", section: 2, signed: true },
    { key: "operating_cash_flow", label: "กระแสเงินสดจากการดำเนินงาน (฿)", section: 3, signed: true },
    { key: "investing_cash_flow", label: "กระแสเงินสดจากการลงทุน (฿)", section: 3, signed: true },
    { key: "financing_cash_flow", label: "กระแสเงินสดจากการจัดหาเงิน (฿)", section: 3, signed: true },
    { key: "capital_expenditure", label: "รายจ่ายลงทุน (฿)", section: 3 },
    { key: "operating_cash_outflow", label: "เงินสดจ่ายจากการดำเนินงาน (฿)", section: 3 },
    { key: "assets", label: "สินทรัพย์รวม (฿)", section: 4, required: true },
    { key: "liabilities", label: "หนี้สินรวม (฿)", section: 4, required: true },
    { key: "equity", label: "ส่วนของเจ้าของ (฿)", section: 4, required: true, signed: true },
    { key: "opening_assets", label: "สินทรัพย์ต้นงวด (฿)", section: 4 },
    { key: "opening_equity", label: "ส่วนของเจ้าของต้นงวด (฿)", section: 4, signed: true },
    { key: "current_assets", label: "สินทรัพย์หมุนเวียน (฿)", section: 5 },
    { key: "current_liabilities", label: "หนี้สินหมุนเวียน (฿)", section: 5 },
    { key: "working_capital_needed", label: "เงินทุนหมุนเวียนที่ต้องใช้ (฿)", section: 5 },
    { key: "buyer_deposit", label: "มัดจำผู้ซื้อที่พร้อมใช้ (฿)", section: 5 },
    { key: "committed_funding", label: "เงินทุนที่ยืนยันแล้ว (฿)", section: 5 },
    { key: "cash_available_for_debt_service", label: "เงินสดที่ใช้ชำระหนี้ได้ (฿)", section: 7, signed: true },
    { key: "debt_principal_due", label: "เงินต้นที่ถึงกำหนดในงวด (฿)", section: 7 },
    { key: "debt_interest_due", label: "ดอกเบี้ยที่ถึงกำหนดในงวด (฿)", section: 7 },
    { key: "loan.principal", label: "เงินต้นสินเชื่อที่พิจารณา (฿)", section: 7 },
    { key: "loan.annual_interest_rate", label: "ดอกเบี้ยต่อปีแบบทศนิยม (เช่น 0.12)", section: 7 },
    { key: "loan.periods", label: "จำนวนงวดสินเชื่อ", section: 7, type: "integer" },
    { key: "loan.payments_per_year", label: "จำนวนงวดชำระต่อปี", section: 7, type: "integer" },
    { key: "loan.timing", label: "เวลาชำระ (end / beginning)", section: 7, type: "text" },
    { key: "units_sold", label: "จำนวนหน่วยที่ขายในงวด", section: 8, type: "integer" },
    { key: "unit_price", label: "ราคาขายต่อหน่วย (฿)", section: 8 },
    { key: "variable_cost_per_unit", label: "ต้นทุนผันแปรต่อหน่วย (฿)", section: 8 },
    { key: "fixed_costs", label: "ต้นทุนคงที่ในงวด (฿)", section: 8 },
    { key: "initial_investment", label: "เงินลงทุนเริ่มต้น (฿)", section: 8 },
    { key: "investment_net_gain", label: "กำไรสุทธิจากการลงทุน (฿)", section: 8, signed: true },
  ];

  const updateDraft = (key: string, value: string) => {
    setDraft((previous) => {
      const next = { ...previous, [key]: value };
      try { sessionStorage.setItem("financial-input-draft-v1", JSON.stringify(next)); } catch { /* Optional local draft only. */ }
      return next;
    });
  };

  // Stepper Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<"idle" | "reading" | "validating" | "analyzing">("idle");

  const sections = [
    { id: 1, title: "1. ข้อมูลทั่วไปและประเภทธุรกิจ", status: "incomplete" },
    { id: 2, title: "2. รายได้และค่าใช้จ่าย", status: "incomplete" },
    { id: 3, title: "3. เงินสดคงเหลือและบัญชีธนาคาร", status: "incomplete" },
    { id: 4, title: "4. สินทรัพย์ หนี้สิน และส่วนทุน", status: "incomplete" },
    { id: 5, title: "5. ลูกหนี้การค้าและเจ้าหนี้การค้า", status: "incomplete" },
    { id: 6, title: "6. สินค้าคงคลังของสด (สต็อก)", status: "incomplete" }, // Shows Rule #3 demonstration!
    { id: 7, title: "7. ภาระผ่อนและวันครบกำหนด", status: "incomplete" },
    { id: 8, title: "8. สินค้าหลักและสัดส่วนยอดขาย", status: "incomplete" },
  ].map((section) => ({ ...section, status: fields.some((field) => field.section === section.id)
    && fields.filter((field) => field.section === section.id && !field.key.startsWith("loan.")).every((field) => draft[field.key]?.trim())
    ? "complete" : "incomplete" }));

  const runAnalysis = async (file?: File) => {
    if (busy.current) return;
    busy.current = true;
    setIsAnalyzing(true);
    setAnalysisStep("reading");
    try {
      let input: FinancialInput;
      if (file) {
        input = (await apiClient.uploadStatement(file)).input;
      } else {
        const values: Record<string, unknown> = {};
        const loan: Record<string, string | number> = {};
        for (const field of [...fields, { key: "revenue" }, { key: "cash_balance" }, { key: "minimum_cash_reserve" }]) {
          const value = draft[field.key]?.trim();
          if (!value) continue; // Unknown is absent, never silently zero.
          const integer = field.key === "units_sold" || field.key === "loan.periods" || field.key === "loan.payments_per_year";
          if (integer && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))) throw new Error(`${field.key}: กรุณาระบุจำนวนเต็ม`);
          const parsed = integer ? Number(value) : value;
          if (field.key.startsWith("loan.")) loan[field.key.slice(5)] = parsed;
          else values[field.key] = parsed;
        }
        if (Object.keys(loan).length) values.loan = loan;
        input = values as FinancialInput;
      }
      setAnalysisStep("validating");
      input = (await apiClient.validateManual(input)).data;
      if (!file) await apiClient.calculate(input);
      setAnalysisStep("analyzing");
      await apiClient.analyze(input, file ? file.name : draft.shop_name);
      addToast({ type: "success", title: "วิเคราะห์ข้อมูลสำเร็จ", message: "อัปเดตโมเดลการเงินและสุขภาพธุรกิจเรียบร้อยแล้ว" });
      setCurrentPage("overview");
    } catch (error) {
      addToast({ type: "error", title: "การแจ้งเตือนความสมบูรณ์", message: error instanceof Error ? error.message : "ไม่สามารถคำนวณข้อมูลได้", duration: 10000 });
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
              ข้อมูลธุรกิจ & นำเข้าไฟล์ (Business Data Input)
            </h1>
            <DataKindBadge kind="actual" size="md" />
          </div>
          <p className="text-xs text-ink-muted mt-0.5">
            อัปโหลดไฟล์สเปรดชีต Excel (.xlsx) หรือกรอกแบบฟอร์ม 8 หมวดเพื่อสร้างฐานข้อมูลจริง
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "upload" ? "bg-white text-brand shadow-2xs" : "text-ink-muted"
            }`}
          >
            อัปโหลดไฟล์ Excel
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("manual")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "manual" ? "bg-white text-brand shadow-2xs" : "text-ink-muted"
            }`}
          >
            กรอกเอง 8 หมวด
          </button>
        </div>
      </div>

      {/* Mode 1: File Dropzone & Column Mapping */}
      {activeTab === "upload" ? (
        <div className="space-y-6">
          <div className="p-8 border-2 border-dashed border-borderLine hover:border-brand rounded-card bg-white text-center space-y-3 transition-colors cursor-pointer"
            role="button" tabIndex={0} aria-label="ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์"
            onClick={() => !busy.current && fileInput.current?.click()}
            onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); fileInput.current?.click(); } }}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
            onDrop={(event) => { event.preventDefault(); if (event.dataTransfer.files.length !== 1) { addToast({ type: "error", title: "การแจ้งเตือนความสมบูรณ์", message: "กรุณาเลือกไฟล์ครั้งละหนึ่งไฟล์" }); return; } void runAnalysis(event.dataTransfer.files[0]); }}>
            <input ref={fileInput} type="file" accept=".xlsx" hidden disabled={isAnalyzing}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void runAnalysis(file); }} />
            <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mx-auto">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm text-ink">
                ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์
              </h3>
              <p className="text-xs text-ink-muted mt-0.5">
                รองรับไฟล์ .XLSX ตาม Template ขนาดไม่เกิน 5 MiB
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                className="px-4 py-2 bg-brand text-white text-xs font-bold rounded-btn hover:bg-brand-dark"
                disabled={isAnalyzing}
                onClick={(event) => { event.stopPropagation(); fileInput.current?.click(); }}
              >
                เลือกไฟล์จากเครื่อง
              </button>
              <button
                type="button"
                className="px-3.5 py-2 border border-slate-200 text-ink text-xs font-medium rounded-btn hover:bg-slate-50 flex items-center gap-1.5"
                onClick={(event) => { event.stopPropagation(); void apiClient.downloadTemplate().catch((error) => addToast({ type: "error", title: "การแจ้งเตือนความสมบูรณ์", message: error.message })); }}
              >
                <Download className="w-3.5 h-3.5" />
                <span>ดาวน์โหลดแบบฟอร์มตัวอย่าง (Template)</span>
              </button>
            </div>
          </div>

          {/* Sample Column Mapping Preview */}
          <div className="bg-white p-5 rounded-card border border-borderLine space-y-3">
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-ink">
              จับคู่คอลัมน์ข้อมูล (Column Mapping Interface)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-ink-muted block">คอลัมน์ในไฟล์: Date</span>
                <span className="font-bold text-ink">↔ วันที่ทำรายการ</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-ink-muted block">คอลัมน์ในไฟล์: Sales</span>
                <span className="font-bold text-ink">↔ ยอดขาย / รายได้</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-ink-muted block">คอลัมน์ในไฟล์: Cost</span>
                <span className="font-bold text-ink">↔ ต้นทุนขาย</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-ink-muted block">คอลัมน์ในไฟล์: Cash_Balance</span>
                <span className="font-bold text-ink">↔ เงินสดคงเหลือ</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Mode 2: 8-Section Long Manual Form with Sticky Nav */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Sticky Left Section Nav */}
          <div className="lg:col-span-4 bg-white p-4 rounded-card border border-borderLine shadow-soft-sm sticky top-24 space-y-2">
            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block px-1">
              หมวดหมู่งบการเงิน 8 หมวด
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
                <span>{isAnalyzing ? "กำลังประมวลผล..." : "ยืนยันข้อมูลและเริ่มวิเคราะห์"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Form Content Area */}
          <div className="lg:col-span-8 bg-white p-6 rounded-card border border-borderLine shadow-soft-sm space-y-6">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h3 className="font-display font-bold text-sm text-ink">
                หมวดที่ {activeSection}: {sections.find((s) => s.id === activeSection)?.title}
              </h3>
              <span className="text-xs text-ink-muted font-medium">บันทึกร่างอัตโนมัติ</span>
            </div>

            {/* Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-ink block mb-1">ชื่อสถานประกอบการ / ร้านค้า</label>
                <input
                  type="text"
                  name="shop_name" aria-label="ชื่อสถานประกอบการ / ร้านค้า" value={draft.shop_name || ""}
                  onChange={(event) => updateDraft("shop_name", event.target.value)} maxLength={200} disabled={isAnalyzing}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">ยอดขายเฉลี่ยต่อเดือน (฿)</label>
                <input
                  type="number"
                  name="revenue" aria-label="ยอดขายเฉลี่ยต่อเดือน (฿)" value={draft.revenue || ""}
                  onChange={(event) => updateDraft("revenue", event.target.value)} step="0.01" min="0" disabled={isAnalyzing}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">เงินสดคงเหลือในบัญชีวันนี้ (฿)</label>
                <input
                  type="number"
                  name="cash_balance" aria-label="เงินสดคงเหลือในบัญชีวันนี้ (฿)" value={draft.cash_balance || ""}
                  onChange={(event) => updateDraft("cash_balance", event.target.value)} step="0.01" min="0" disabled={isAnalyzing}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">เงินสำรองขั้นต่ำที่ต้องการ (฿)</label>
                <input
                  type="number"
                  name="minimum_cash_reserve" aria-label="เงินสำรองขั้นต่ำที่ต้องการ (฿)" value={draft.minimum_cash_reserve || ""}
                  onChange={(event) => updateDraft("minimum_cash_reserve", event.target.value)} step="0.01" min="0" disabled={isAnalyzing}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand font-mono font-bold"
                />
              </div>
              {fields.filter((field) => field.section === activeSection).map((field) => (
                <div key={field.key}>
                  <label htmlFor={`financial-${field.key}`} className="font-bold text-ink block mb-1">{field.label}</label>
                  <input id={`financial-${field.key}`} name={field.key} aria-label={field.label}
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

            {/* Row Validation Alert Demonstration (Part B Rule #3) */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-attention mt-0.5 shrink-0" />
              <div>
                <strong>การแจ้งเตือนความสมบูรณ์:</strong> ข้อมูลหมวดที่ 6 (สต็อกของสด) ยังไม่ได้กรอก{" "}
                ระบบจะไม่เดาค่าเป็น 0 แต่จะระบุว่าขาดข้อมูลเพื่อความโปร่งใส
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
                กำลังวิเคราะห์ข้อมูลธุรกิจ
              </h3>
              <p className="text-xs text-ink-muted mt-1">
                {analysisStep === "reading" && "1/3: กำลังอ่านโครงสร้างข้อมูลและแถวรายการ..."}
                {analysisStep === "validating" && "2/3: กำลังตรวจสอบดุลบัญชีและความสัมพันธ์..."}
                {analysisStep === "analyzing" && "3/3: ประมวลผลดัชนีสุขภาพการเงินและกระแสเงินสด..."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
