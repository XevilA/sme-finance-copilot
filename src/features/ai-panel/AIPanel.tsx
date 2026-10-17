import React, { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { AIResponse } from "@/api/contracts/types";
import { useAnalysisContext, useEnvelope } from "@/hooks/useEnvelope";
import {
  Sparkles,
  X,
  Target,
  Lightbulb,
  HelpCircle,
  FileText,
  ArrowRight,
  RefreshCw,
  Zap,
} from "lucide-react";

export const AIPanel: React.FC = () => {
  const {
    isAIPanelOpen,
    setAIPanelOpen,
    currentPage,
    activeEvidenceTargetId,
    setActiveEvidenceTarget,
    setCurrentPage,
    hasUnsavedChanges,
  } = useAppStore();

  const { accepted, stale } = useAnalysisContext();
  const [selectedRefId, setSelectedRefId] = useState<string | null>(null);
  const load = useCallback(
    () => (isAIPanelOpen ? apiClient.getAIExplanation(currentPage) : Promise.reject(new Error("panel closed"))),
    [isAIPanelOpen, currentPage]);
  const state = useEnvelope<AIResponse>(load, [isAIPanelOpen, currentPage]);
  const aiData = isAIPanelOpen ? state.envelope?.data ?? null : null;
  const loading = isAIPanelOpen && state.loading;
  const error = isAIPanelOpen ? state.error : null;
  // Deterministic rules are the default. A model run only reorders finding IDs,
  // and a provider failure is reported as a warning with the rules output kept.
  const aiMode = aiData?.mode || accepted?.result.data.aiMode || null;
  const shown: AIResponse | null = isAIPanelOpen && !loading
    ? aiData || {
        pageId: currentPage,
        summary: error ? "เรียกคำอธิบายจาก backend ไม่สำเร็จ" : "ยังไม่มีคำอธิบายสำหรับหน้านี้",
        reasoning: error || "backend ไม่ได้คืนคำอธิบายของหน้านี้ · ลองนำเข้าข้อมูลหรือเปิดหน้าอื่น",
        dataUsed: [],
        suggestions: [],
        unknowns: [error ? `ข้อผิดพลาด: ${error}` : "backend ไม่ได้คืนคำอธิบายของหน้านี้"],
      }
    : null;
  const aiWarning = aiData?.warning || accepted?.result.data.aiWarning || null;

  useEffect(() => {
    if (!isAIPanelOpen) {
      setActiveEvidenceTarget(null);
      setSelectedRefId(null);
    }
  }, [isAIPanelOpen, setActiveEvidenceTarget]);

  if (!isAIPanelOpen) return null;

  const handleHighlightEvidence = (item: { id: string; targetElementId: string }) => {
    if (selectedRefId === item.id) {
      setSelectedRefId(null);
      setActiveEvidenceTarget(null);
    } else {
      setSelectedRefId(item.id);
      setActiveEvidenceTarget(item.targetElementId);

      // Smooth scroll target element into viewport if needed
      const elem = document.getElementById(item.targetElementId);
      if (elem) {
        elem.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  const quickQuestions: Record<string, string[]> = {
    overview: ["เงินสดลดลงเพราะอะไร?", "รับงานนี้เงินหมุนทันไหม?", "ค่าใช้จ่ายตัวไหนกระทบมากที่สุด?"],
    swarm: ["ทำไมถึงเสนอ 6 ร้านนี้?", "ทุนที่ขาด 29,500 บาทแก้ยังไง?", "สลับร้านสำรองได้ไหม?"],
    cashflow: ["เงินจะติดลบวันไหนบ้าง?", "ถ้าขอเครดิตเทอมสั้นลงเงินจะดีขึ้นไหม?", "ทำไมเงินเข้าช้า?"],
    health: ["Current Ratio 1.15 บ่งบอกอะไร?", "ทำไมถึงคำนวณ DIO ไม่ได้?", "ควรลดต้นทุนจุดไหน?"],
    funding: ["ทำไมแนะนำ Invoice Factoring?", "ดอกเบี้ยรวมเท่าไร?", "ต้องใช้เอกสารอะไรบ้าง?"],
  };

  const currentQuestions = quickQuestions[currentPage] || [
    "เงินหายไปตรงไหน?",
    "งานนี้คุ้มไหม?",
    "ใช้ทุนน้อยลงได้ไหม?",
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-soft-lg border-l border-borderLine flex flex-col animate-slide-in">
      {/* Header */}
      <div className="p-4 border-b border-borderLine flex items-center justify-between bg-gradient-to-r from-brand/5 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand text-white flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display font-bold text-ink text-sm flex items-center gap-1.5">
              <span>SME Copilot Intelligence</span>
              <span className="text-[10px] bg-brand/10 text-brand px-1.5 py-0.2 rounded font-normal">
                {aiMode === "rules" ? "กฎเกณฑ์ (deterministic)" : aiMode ? `โหมด ${aiMode}` : "ยังไม่ทราบโหมด"}
              </span>
            </h3>
            <p className="text-[11px] text-ink-muted">
              อธิบายบริบทหน้า: {currentPage}
              {aiData?.policyVersion ? ` · เกณฑ์ ${aiData.policyVersion}` : ""}
              {aiWarning ? ` · ใช้ผลจากกฎเกณฑ์แทนโมเดล: ${aiWarning}` : ""}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAIPanelOpen(false)}
          className="p-1.5 text-ink-muted hover:text-ink hover:bg-slate-100 rounded-lg transition-colors"
          title="ปิดแผง (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Stale Warning Bar if user made sandbox simulation changes */}
      {(hasUnsavedChanges || stale) && (
        <div className="p-2.5 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-900 flex items-center justify-between">
          <span>
            {stale
              ? "ข้อมูลตั้งต้นถูกแก้หลังการวิเคราะห์ ผลนี้จึงเป็นของข้อมูลชุดก่อน"
              : "มีรายการจำลองที่ยังไม่บันทึก ผลนี้อิงจากข้อมูลเดิม"}
          </span>
          <button
            type="button"
            onClick={() => { setAIPanelOpen(false); setCurrentPage("import"); }}
            className="px-2 py-0.5 bg-brand text-white text-[10px] font-medium rounded hover:bg-brand-dark flex items-center gap-1"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            <span>วิเคราะห์ใหม่</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {loading ? (
          <div className="space-y-4 animate-pulse pt-4">
            <div className="h-4 bg-slate-200 rounded w-3/4" />
            <div className="h-20 bg-slate-200 rounded" />
            <div className="h-16 bg-slate-200 rounded" />
          </div>
        ) : shown ? (
          <>
            {/* 1. Summary & Reasoning */}
            <div className="bg-slate-50 p-3.5 rounded-card border border-slate-100">
              <span className="text-[10px] font-bold text-brand uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                สรุปเหตุและผลทางการเงิน
              </span>
              <p className="text-ink font-medium leading-relaxed mb-2">{shown.summary}</p>
              <p className="text-ink-muted leading-relaxed text-[11px] border-t border-slate-200/80 pt-2">
                {shown.reasoning}
              </p>
            </div>

            {/* 2. Data Used with Evidence Beam Selector (S7) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-ink uppercase tracking-wider flex items-center gap-1">
                  <Target className="w-3.5 h-3.5 text-brand" />
                  ข้อมูลที่ใช้คำนวณ (Evidence Refs)
                </span>
                <span className="text-[10px] text-brand font-medium">
                  {!shown.dataUsed.length
                    ? "ยังไม่มีตัวเลขที่ใช้อ้างอิง"
                    : selectedRefId ? "กำลังส่องแสงอ้างอิง" : "คลิกเพื่อส่องแสงดูจุดจริง"}
                </span>
              </div>

              <div className="space-y-1.5">
                {shown.dataUsed.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleHighlightEvidence(item)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      selectedRefId === item.id
                        ? "bg-brand/10 border-brand text-brand ring-2 ring-brand/30 shadow-sm"
                        : "bg-white border-borderLine hover:border-brand/40 text-ink"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-brand text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                        {item.refNum}
                      </span>
                      <div>
                        <div className="font-semibold text-xs">{item.label}</div>
                        <div className="text-[10px] text-ink-muted font-mono">{item.targetElementId}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 font-bold font-mono text-xs">
                      <span>{item.value}</span>
                      <Zap className={`w-3.5 h-3.5 ${selectedRefId === item.id ? "text-brand animate-pulse" : "text-slate-300"}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Actionable Suggestions */}
            <div>
              <span className="text-[11px] font-bold text-ink uppercase tracking-wider block mb-2 flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5 text-resource-dark" />
                ข้อเสนอแนะเชิงกลยุทธ์
              </span>
              <div className="space-y-2">
                {shown.suggestions.map((sug, idx) => {
                  const text = typeof sug === "string" ? sug : sug.text;
                  const target = typeof sug === "string" ? null : sug.targetPage || null;
                  const label = typeof sug === "string" ? null : sug.actionLabel || null;
                  return (
                    <div
                      key={idx}
                      className="p-3 bg-resource-light/60 border border-resource/30 rounded-xl text-ink leading-relaxed"
                    >
                      <p className="mb-2 text-[11px] font-medium">{text}</p>
                      <button
                        type="button"
                        onClick={() => { if (target) setCurrentPage(target as never); }}
                        disabled={!target}
                        title={target ? undefined : "ข้อเสนอนี้ไม่ได้ระบุหน้าเป้าหมายจาก backend"}
                        className="text-[11px] font-bold text-resource-dark hover:underline flex items-center gap-1"
                      >
                        <span>{target ? label || `ไปที่หน้า ${target}` : "ไม่ได้ระบุหน้าเป้าหมาย"}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Unknowns / What is missing */}
            <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200 text-amber-900">
              <span className="text-[10px] font-bold uppercase tracking-wider block mb-1 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-attention" />
                สิ่งที่ระบบยังไม่ทราบ (ความไม่แน่นอน)
              </span>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-amber-800">
                {(shown.unknowns.length ? shown.unknowns : ["backend ไม่ได้ระบุรายการที่ยังไม่ทราบสำหรับข้อมูลชุดนี้"]).map((unk, idx) => (
                  <li key={idx}>{unk}</li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </div>

      {/* Quick Prompt Questions */}
      <div className="p-3 bg-slate-50 border-t border-borderLine space-y-1.5">
        <span className="text-[10px] font-bold text-ink-muted uppercase block">
          คำถามลัด (ยังไม่รองรับการถาม-ตอบ แสดงเป็นตัวอย่างคำถาม):
        </span>
        <div className="flex flex-wrap gap-1.5">
          {currentQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              disabled
              title="ยังไม่มี endpoint ถาม-ตอบ · GET /ai/explain คืนคำอธิบายจากกฎเกณฑ์ของหน้านี้เท่านั้น"
              className="text-[10px] bg-white border border-slate-200 hover:border-brand hover:text-brand px-2.5 py-1 rounded-chip text-ink transition-colors text-left"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
