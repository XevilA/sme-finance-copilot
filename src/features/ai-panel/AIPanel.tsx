import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { AIResponse } from "@/api/contracts/types";
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

  const [aiData, setAIData] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRefId, setSelectedRefId] = useState<string | null>(null);

  // Fetch AI explanation based on current active page
  useEffect(() => {
    if (isAIPanelOpen) {
      setLoading(true);
      apiClient
        .getAIExplanation(currentPage)
        .then((res) => {
          setAIData(res.data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setActiveEvidenceTarget(null);
      setSelectedRefId(null);
    }
  }, [isAIPanelOpen, currentPage, setActiveEvidenceTarget]);

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
                AI วิเคราะห์
              </span>
            </h3>
            <p className="text-[11px] text-ink-muted">อธิบายบริบทหน้า: {currentPage}</p>
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
      {hasUnsavedChanges && (
        <div className="p-2.5 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-900 flex items-center justify-between">
          <span>ข้อมูลในหน้าเปลี่ยนแล้ว! การวิเคราะห์นี้อิงจากข้อมูลเดิม</span>
          <button
            type="button"
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
        ) : aiData ? (
          <>
            {/* 1. Summary & Reasoning */}
            <div className="bg-slate-50 p-3.5 rounded-card border border-slate-100">
              <span className="text-[10px] font-bold text-brand uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                สรุปเหตุและผลทางการเงิน
              </span>
              <p className="text-ink font-medium leading-relaxed mb-2">{aiData.summary}</p>
              <p className="text-ink-muted leading-relaxed text-[11px] border-t border-slate-200/80 pt-2">
                {aiData.reasoning}
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
                  {selectedRefId ? "กำลังส่องแสงอ้างอิง" : "คลิกเพื่อส่องแสงดูจุดจริง"}
                </span>
              </div>

              <div className="space-y-1.5">
                {aiData.dataUsed.map((item) => (
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
                {aiData.suggestions.map((sug, idx) => {
                  const text = typeof sug === "string" ? sug : sug.text;
                  return (
                    <div
                      key={idx}
                      className="p-3 bg-resource-light/60 border border-resource/30 rounded-xl text-ink leading-relaxed"
                    >
                      <p className="mb-2 text-[11px] font-medium">{text}</p>
                      <button
                        type="button"
                        onClick={() => {
                          if (currentPage === "overview") setCurrentPage("cashflow");
                          else if (currentPage === "swarm") setCurrentPage("funding");
                          else setCurrentPage("simulator");
                        }}
                        className="text-[11px] font-bold text-resource-dark hover:underline flex items-center gap-1"
                      >
                        <span>ไปเปิดแผนจำลองหรือดำเนินการต่อ</span>
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
                {aiData.unknowns.map((unk, idx) => (
                  <li key={idx}>{unk}</li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </div>

      {/* Quick Prompt Questions */}
      <div className="p-3 bg-slate-50 border-t border-borderLine space-y-1.5">
        <span className="text-[10px] font-bold text-ink-muted uppercase block">คำถามลัด:</span>
        <div className="flex flex-wrap gap-1.5">
          {currentQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                // Instantly simulate user asking question
              }}
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
