import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { FunderProject, Envelope } from "@/api/contracts/types";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { StateRenderer } from "@/components/ui/StateRenderer";
import {
  Building,
  ShieldCheck,
  FileCheck2,
  AlertTriangle,
  Lock,
  Search,
  Sparkles,
  ArrowRight,
  CheckCircle,
  HelpCircle,
} from "lucide-react";

export const FunderPage: React.FC = () => {
  const { setCurrentPage, addToast } = useAppStore();
  const [funderEnvelope, setFunderEnvelope] = useState<Envelope<FunderProject[]> | null>(null);
  const [loading, setLoading] = useState(true);

  // Budget allocation simulation
  const [allocatedBudget, setAllocatedBudget] = useState(100000);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(["funder-proj-1"]);

  const loadData = () => {
    setLoading(true);
    apiClient
      .getFunderProjects()
      .then((res) => {
        setFunderEnvelope(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleSelectProject = (id: string) => {
    if (selectedProjectIds.includes(id)) {
      setSelectedProjectIds(selectedProjectIds.filter((pid) => pid !== id));
    } else {
      setSelectedProjectIds([...selectedProjectIds, id]);
    }
  };

  const handleRequestInfo = (proj: FunderProject) => {
    addToast({
      type: "info",
      title: "ส่งคำขอข้อมูลเพิ่มเติมแล้ว",
      message: `ระบบส่งคำขอเข้าถึงเอกสารสำหรับ '${proj.title}' ไปยังเจ้าของโครงการแล้ว`,
    });
  };

  if (loading || !funderEnvelope) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-40 bg-slate-200 rounded-card animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-64 bg-slate-200 rounded-card animate-pulse" />
          <div className="h-64 bg-slate-200 rounded-card animate-pulse" />
        </div>
      </div>
    );
  }

  const projects = funderEnvelope.data;

  // Calculate used budget
  const usedBudget = selectedProjectIds.reduce((sum, id) => {
    const p = projects.find((proj) => proj.id === id);
    return sum + (p?.targetFunding || 0);
  }, 0);

  const remainingBudget = allocatedBudget - usedBudget;

  return (
    <StateRenderer onRetry={loadData}>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 text-ink animate-fade-in">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borderLine pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-brand text-white flex items-center justify-center font-bold">
                <Building className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-display font-bold text-ink">
                พอร์ทัลสำหรับผู้ให้ทุน (Funder & Investor Workspace)
              </h1>
              <DataKindBadge kind="forecast" size="md" />
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              ค้นหาโครงการที่มีหลักฐานคำสั่งซื้อยืนยัน (PO) และจำลองการจัดสรรงบประมาณ
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage("swarm")}
              className="px-3.5 py-1.5 bg-brand text-white rounded-btn text-xs font-semibold hover:bg-brand-dark flex items-center gap-1 transition-all shadow-sm"
            >
              <span>ดูห้องประกอบทีม SWARM 300 กล่อง</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Budget Allocation Simulation Bar */}
        <div className="p-5 rounded-card bg-white border border-borderLine shadow-soft-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold text-brand uppercase tracking-wider block">
                จำลองจัดสรรงบประมาณ (Capital Allocation Sandbox)
              </span>
              <h3 className="text-sm font-display font-bold text-ink">
                งบลงทุนที่เตรียมไว้: ฿{allocatedBudget.toLocaleString()}
              </h3>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-[10px] text-ink-muted block">งบที่จัดสรรแล้ว:</span>
                <span className="font-bold text-brand">฿{usedBudget.toLocaleString()}</span>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <span className="text-[10px] text-ink-muted block">คงเหลือ:</span>
                <span className={`font-bold ${remainingBudget < 0 ? "text-danger" : "text-emerald-700"}`}>
                  ฿{remainingBudget.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Allocation Progress Bar */}
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                remainingBudget < 0 ? "bg-danger" : "bg-brand"
              }`}
              style={{
                width: `${Math.min(100, (usedBudget / allocatedBudget) * 100)}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-ink-muted">
            <span>เลือกแล้ว {selectedProjectIds.length} โครงการ (ไม่จำเป็นต้องใช้หมดทั้งงบ)</span>
            <span className="font-mono">
              {Math.round((usedBudget / allocatedBudget) * 100)}% ของงบประมาณ
            </span>
          </div>
        </div>

        {/* Projects Cards with 3-Tier Evidence Badges */}
        <div className="space-y-4">
          <h3 className="text-sm font-display font-bold text-ink flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-brand" />
            <span>โครงการที่ผ่านเกณฑ์คัดกรองเบื้องต้น</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {projects.map((proj) => {
              const isSelected = selectedProjectIds.includes(proj.id);
              return (
                <div
                  key={proj.id}
                  className={`p-4 rounded-card bg-white border transition-all duration-200 flex flex-col justify-between space-y-4 select-none ${
                    isSelected
                      ? "border-brand ring-2 ring-brand/30 shadow-soft-md"
                      : "border-borderLine hover:border-brand/40"
                  }`}
                >
                  <div>
                    {/* 3-Tier Evidence Badge (Part G12) */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-chip border ${
                          proj.evidenceLevel === "confirmed_po"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : proj.evidenceLevel === "quotation"
                            ? "bg-amber-50 text-amber-800 border-amber-300"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {proj.evidenceLevelBadge}
                      </span>
                      <DataKindBadge kind="forecast" size="sm" />
                    </div>

                    <h4 className="font-display font-bold text-xs text-ink leading-snug mb-1">
                      {proj.title}
                    </h4>
                    <p className="text-[11px] text-ink-muted mb-3">{proj.enterpriseName}</p>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl text-xs mb-3">
                      <div>
                        <span className="text-[10px] text-ink-muted block">ทุนที่ต้องการ:</span>
                        <span className="font-bold font-mono text-ink">
                          ฿{proj.targetFunding.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-ink-muted block">ผลตอบแทนคาดการณ์:</span>
                        <span className="font-bold font-mono text-emerald-700">
                          {proj.roiEstimatePercent}% ต่อปี
                        </span>
                      </div>
                    </div>

                    {/* Funder Recommendation Decision (Rule: รองรับ 3 สถานะ) */}
                    <div
                      className={`p-2.5 rounded-xl text-xs border leading-relaxed mb-3 ${
                        proj.recommendationDecision === "recommend"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                          : proj.recommendationDecision === "reduced_amount_possible"
                          ? "bg-amber-50 border-amber-200 text-amber-900"
                          : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1 mb-0.5">
                        {proj.recommendationDecision === "recommend" && <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                        {proj.recommendationDecision === "reduced_amount_possible" && <AlertTriangle className="w-3.5 h-3.5 text-attention" />}
                        {proj.recommendationDecision === "insufficient_data" && <HelpCircle className="w-3.5 h-3.5 text-slate-500" />}
                        <span>
                          {proj.recommendationDecision === "recommend"
                            ? "แนะนำให้ปล่อยกู้เต็มจำนวน"
                            : proj.recommendationDecision === "reduced_amount_possible"
                            ? "ใช้ทุนน้อยลงได้ (ลดความเสี่ยง)"
                            : "ข้อมูลยังไม่พอ / ยังไม่ควรลง"}
                        </span>
                      </div>
                      <p className="text-[10px] leading-tight">{proj.recommendationNote}</p>
                    </div>

                    {/* Documents verified status */}
                    <div className="space-y-1 text-[11px] text-ink-muted">
                      <span className="font-semibold block text-[10px] text-ink">เอกสารประกอบ:</span>
                      {proj.evidenceDocuments.map((doc, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          {doc.verified ? (
                            <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                          ) : (
                            <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                          )}
                          <span className="truncate">{doc.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    {proj.hasAccessPermission ? (
                      <button
                        type="button"
                        onClick={() => handleToggleSelectProject(proj.id)}
                        className={`w-full py-2 rounded-btn text-xs font-bold transition-all ${
                          isSelected
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "bg-brand text-white hover:bg-brand-dark"
                        }`}
                      >
                        {isSelected ? "✓ รวมในงบจัดสรรแล้ว" : "+ จัดสรรงบให้โครงการนี้"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRequestInfo(proj)}
                        className="w-full py-2 rounded-btn text-xs font-medium bg-slate-100 text-ink hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>ขอสิทธิ์ดูเอกสารสัญญา</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </StateRenderer>
  );
};
