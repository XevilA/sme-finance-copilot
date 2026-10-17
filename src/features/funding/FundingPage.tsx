import React, { useState, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { Capabilities, FundingEvaluation, FundingOption, Envelope } from "@/api/contracts/types";
import { useAnalysisContext, useEnvelope } from "@/hooks/useEnvelope";
import { FundingChip } from "@/components/signature/FundingChip";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { StateRenderer } from "@/components/ui/StateRenderer";
import {
  Coins,
  Sparkles,
  Calculator,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  FileText,
  Sliders,
  RotateCcw,
} from "lucide-react";

export const FundingPage: React.FC = () => {
  const { setCurrentPage, addToast, selectedShopId } = useAppStore();
  const { accepted, stale } = useAnalysisContext();
  const [selectedFundingId, setSelectedFundingId] = useState<string>("");
  const [isComparing, setIsComparing] = useState(false);

  // Application Drawer
  const [isApplying, setIsApplying] = useState(false);

  // With an imported statement the matcher grades that exact statement. Reading
  // GET /funding/options instead would rank a stored seed SME's numbers.
  const load = useCallback(async (): Promise<Envelope<FundingOption[]> & { evaluation?: FundingEvaluation }> => {
    if (!accepted || apiClient.isDemoMode()) return apiClient.getFundingOptions();
    const result = await apiClient.evaluateFunding(accepted.input, {
      input_revision: accepted.revision,
      sme_id: accepted.context.smeId,
      project_id: accepted.context.projectId,
    });
    return { ...result, data: result.data.options, evaluation: result.data };
  }, [accepted]);
  const state = useEnvelope<FundingOption[]>(load as () => Promise<Envelope<FundingOption[]>>);
  const { envelope: fundingEnvelope, loading, error, reload: loadData } = state;
  const evaluation = (fundingEnvelope as (Envelope<FundingOption[]> & { evaluation?: FundingEvaluation }) | null)?.evaluation;

  const capabilityState = useEnvelope<Capabilities>(useCallback(
    () => (apiClient.isDemoMode()
      ? Promise.reject(new Error("โหมดตัวอย่างไม่ประกาศความสามารถของ backend"))
      : apiClient.getCapabilities()),
    []));
  const canApply = capabilityState.envelope?.data.fundingApplication.available === true;
  const applyBlockedReason = capabilityState.envelope?.data.fundingApplication.reason
    || "backend ยังไม่มี operation สำหรับยื่นคำขอสินเชื่อ";

  const amount = (value: string | number | null | undefined) =>
    value == null || value === "" ? "ยังไม่มีข้อมูล" : `฿${Number(value).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;
  // Values supplied in the statement being graded, shown as supplied figures.
  const supplied = (field: string) => {
    const value = accepted?.input?.[field];
    return typeof value === "string" || typeof value === "number" ? value : null;
  };
  const overview = accepted?.result.views.overview.data;
  const activeId = selectedFundingId || fundingEnvelope?.data[0]?.id || "";

  const handleApply = () => {
    setIsApplying(false);
    // /capabilities declares fundingApplication unavailable: there is no actor,
    // no persistence and no status transition behind this button.
    addToast({
      type: "warning",
      title: "ยังไม่รองรับการยื่นคำขอจริง",
      message: `${applyBlockedReason} · ผลที่แสดงคือการจัดอันดับตามเกณฑ์ตัวเลขที่ส่งไป ไม่ใช่การอนุมัติสินเชื่อ`,
      duration: 9000,
    });
  };

  if (loading) {
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

  const fundingOptions = fundingEnvelope?.data || [];
  const activeFunding = fundingOptions.find((f) => f.id === activeId) || fundingOptions[0];

  if (!fundingEnvelope || error) {
    return (
      <StateRenderer currentMode="error" errorMessage={error || "อ่านทางเลือกแหล่งทุนจาก backend ไม่สำเร็จ"} onRetry={loadData}>
        {null}
      </StateRenderer>
    );
  }

  // An explicit zero gap is a known zero: no candidates are needed. An unknown
  // gap is null plus requested_amount in missing, which is not the same thing.
  if (!activeFunding) {
    return (
      <StateRenderer
        currentMode="unavailable"
        unavailableReason={evaluation?.notRequired
          ? "งบชุดนี้ไม่มีส่วนที่ขาด (funding gap = 0) จึงไม่มีการจัดอันดับแหล่งทุน"
          : "ยังไม่มีทางเลือกแหล่งทุนที่ตรงเกณฑ์ของงบชุดนี้ · ต้องมีมูลค่าส่วนที่ขาดที่คำนวณได้ก่อน"}
        missingItems={fundingEnvelope.missing}
        onRetry={loadData}
        onAddData={() => setCurrentPage("import")}
      >
        {null}
      </StateRenderer>
    );
  }

  return (
    <StateRenderer currentMode={stale ? "stale" : undefined} onRetry={loadData} onReanalyze={() => setCurrentPage("import")}>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 text-ink animate-fade-in">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borderLine pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-display font-bold text-ink">
                จับคู่แหล่งเงินทุนเฉพาะโครงการ (Smart Funding Matcher)
              </h1>
              <DataKindBadge kind="forecast" size="md" />
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              เติมทุนเฉพาะส่วนที่ขาดเพื่อเริ่มงานได้ทันที คัดกรองดอกเบี้ยและความรวดเร็วในการเบิกเงิน
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage("unlock")}
              className="px-3 py-1.5 bg-resource-light hover:bg-resource/20 border border-resource/30 text-resource-dark text-xs font-semibold rounded-btn flex items-center gap-1.5 transition-colors"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>ลองลดทุนที่ต้องใช้ (SME UNLOCK)</span>
            </button>
          </div>
        </div>

        {/* Top Summary Banner: ต้องใช้ / มีใช้ได้ / ยังขาด / ต้องใช้วันไหน */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-4 rounded-card border border-borderLine shadow-soft-sm">
          <div>
            <span className="text-[10px] text-ink-muted block uppercase tracking-wider">
              ทุนหมุนเวียนต้องใช้รวม
            </span>
            <span className="text-lg font-bold font-mono text-ink">{amount(supplied("working_capital_needed"))}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {supplied("working_capital_needed") == null ? "ขาด working_capital_needed ในงบ" : "ตามค่าที่ระบุในงบชุดนี้"}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-ink-muted block uppercase tracking-wider">
              เงินสดในมือปัจจุบัน
            </span>
            <span className="text-lg font-bold font-mono text-ink">{amount(overview?.cashBalance)}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {overview?.cashBalance == null ? "ขาด cash_balance ในงบ" : `หลังกันสำรอง ${amount(overview?.usableCashAfterReserve)}`}
            </span>
          </div>

          <div className="border-x border-slate-100 px-3">
            <span className="text-[10px] font-bold text-danger block uppercase tracking-wider">
              ทุนที่ยังขาด (Funding Gap)
            </span>
            <span className="text-lg font-extrabold font-mono text-danger tabular-nums">
              {evaluation ? amount(evaluation.requestedAmount) : "ยังไม่มีข้อมูล"}
            </span>
            <span className="text-[10px] text-danger font-medium block mt-0.5">
              {!evaluation
                ? "นำเข้างบก่อนเพื่อคำนวณส่วนที่ขาด"
                : evaluation.notRequired
                ? "งบชุดนี้ไม่มีส่วนที่ขาด (ศูนย์ที่ทราบค่า)"
                : evaluation.requestedAmount == null
                ? "ยังคำนวณไม่ได้ ไม่ใช่ศูนย์"
                : `เกรด ${evaluation.grade || "ยังไม่ทราบ"} คะแนน ${evaluation.gradeScore || "ยังไม่ทราบ"}`}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-brand block uppercase tracking-wider font-semibold">
              วันที่ต้องมีเงินสดพร้อม
            </span>
            <span className="text-lg font-bold font-mono text-brand">
              {accepted?.result.views.forecast?.data?.first_shortfall_date
                || accepted?.result.views.forecast?.data?.conditional_first_shortfall_date
                || "ยังไม่มีข้อมูล"}
            </span>
            <span className="text-[10px] text-emerald-700 font-medium block mt-0.5">
              {accepted?.result.views.forecast?.data?.first_shortfall_date
                ? "วันที่เงินสดต่ำกว่าศูนย์จากตารางที่มีวันกำหนด"
                : accepted?.result.views.forecast?.data?.conditional_first_shortfall_date
                ? "เป็นค่าตามเงื่อนไข ยังไม่ยืนยันวันรับเงินจริง"
                : "ต้องมีตารางรับ-จ่ายตามวันที่ของกิจการนี้ก่อน"}
            </span>
          </div>
        </div>

        {/* 8 Action Buttons Strip (Part G8) */}
        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-100 rounded-xl text-xs">
          <button
            type="button"
            className="px-3 py-1 bg-white shadow-2xs font-semibold rounded-lg text-brand flex items-center gap-1"
          >
            <span>1. ค้นหาทางเลือกทุน</span>
          </button>
          <button
            type="button"
            onClick={() => setIsComparing(!isComparing)}
            className="px-3 py-1 text-ink-muted hover:text-ink font-medium rounded-lg"
          >
            <span>2. เปรียบเทียบ {isComparing ? "(ซ่อน)" : "(แสดง)"}</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage("unlock")}
            className="px-3 py-1 text-ink-muted hover:text-resource-dark font-medium rounded-lg"
          >
            <span>3. ลดทุนโดยใช้ของร่วม</span>
          </button>
          <button
            type="button"
            onClick={() => setIsApplying(true)}
            title={canApply ? undefined : applyBlockedReason}
            className="px-3 py-1 bg-brand text-white font-semibold rounded-lg ml-auto flex items-center gap-1"
          >
            <span>{canApply ? "4. เตรียมยื่นคำขอ" : "4. ดูเอกสารที่ต้องเตรียม"}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Side-by-Side Comparison View (When Active) */}
        {isComparing && (
          <div className="p-4 bg-white rounded-card border border-borderLine shadow-soft-sm space-y-3">
            <h3 className="text-xs font-display font-bold text-ink uppercase tracking-wider">
              ตารางเปรียบเทียบแหล่งเงินทุน (Comparison Matrix)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-ink-muted">
                    <th className="py-2">แหล่งเงินทุน</th>
                    <th className="py-2">ประเภท</th>
                    <th className="py-2">ดอกเบี้ยต่อปี</th>
                    <th className="py-2">วันรับเงิน</th>
                    <th className="py-2">ภาระผ่อน/คืน</th>
                    <th className="py-2">ความเหมาะสม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fundingOptions.map((opt) => (
                    <tr key={opt.id} className="hover:bg-slate-50">
                      <td className="py-2.5 font-bold text-ink">{opt.name}</td>
                      <td className="py-2.5 text-ink-muted">{opt.typeLabel}</td>
                      <td className="py-2.5 font-bold font-mono text-brand">
                        {opt.interestRateAnnual}%
                      </td>
                      <td className="py-2.5 font-bold font-mono text-emerald-700">
                        {opt.disbursementDays} วัน
                      </td>
                      <td className="py-2.5 font-mono">฿{opt.totalRepayment.toLocaleString()}</td>
                      <td className="py-2.5">
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                          {opt.matchScore}% ตรงเกณฑ์
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Funding Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fundingOptions.map((funding) => (
            <FundingChip
              key={funding.id}
              funding={funding}
              dataKind="forecast"
              isSelected={selectedFundingId === funding.id}
              onSelect={() => setSelectedFundingId(funding.id)}
              onSimulateInstallment={() => {
                setSelectedFundingId(funding.id);
                addToast({
                  type: "info",
                  title: `ค่างวดจาก backend · ${funding.name}`,
                  message: `ผ่อน ${amount(funding.monthlyPayment)}/เดือน ${funding.termMonths} เดือน · คืนรวม ${amount(funding.totalRepayment)}`
                    + (funding.postFundingDscr ? ` · DSCR หลังรับทุน ${funding.postFundingDscr}` : " · ยังไม่ทราบ DSCR หลังรับทุน"),
                  duration: 9000,
                });
              }}
              onApply={() => {
                setSelectedFundingId(funding.id);
                setIsApplying(true);
              }}
            />
          ))}
        </div>

        {/* Selected Funding Option Deep Dive */}
        <div className="p-5 rounded-card bg-white border border-borderLine space-y-4 shadow-soft-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-brand uppercase tracking-wider">
                รายละเอียดการอนุมัติและเอกสารที่ต้องใช้
              </span>
              <h3 className="text-sm font-display font-bold text-ink">
                {activeFunding.name}
              </h3>
            </div>
            <DataKindBadge kind="actual" size="sm" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <span className="font-bold text-ink block">เอกสารที่ต้องเตรียม:</span>
              <ul className="space-y-1 list-disc pl-4 text-ink-muted">
                {activeFunding.requiredDocs.map((doc, idx) => (
                  <li key={idx}>{doc}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-ink block">เงื่อนไขคุณสมบัติ:</span>
              <ul className="space-y-1 list-disc pl-4 text-ink-muted">
                {activeFunding.eligibilityConditions.map((cond, idx) => (
                  <li key={idx}>{cond}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="p-3 bg-brand/5 border border-brand/20 rounded-xl text-xs text-brand-dark flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-brand shrink-0 mt-0.5" />
            <div>
              <strong>เกณฑ์ที่ใช้จัดอันดับ ({activeFunding.policyVersion || "ยังไม่ทราบเวอร์ชันเกณฑ์"}):</strong>{" "}
              {activeFunding.matchReason}
              {activeFunding.notice ? ` · ${activeFunding.notice}` : " · การจัดอันดับนี้ไม่ใช่การอนุมัติสินเชื่อ"}
            </div>
          </div>
        </div>

        {/* Application Modal / Drawer */}
        {isApplying && (
          <div
            className="fixed inset-0 z-50 bg-navy-deep/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setIsApplying(false)}
          >
            <div
              className="w-full max-w-lg bg-white rounded-card shadow-soft-lg border border-borderLine p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-borderLine pb-3">
                <h3 className="font-display font-bold text-ink text-sm">
                  {canApply ? "ตรวจยืนยันคำขอเงินทุนหมุนเวียน (Verification Step)" : "สรุปทางเลือกที่เลือกไว้ (ยังไม่ยื่นคำขอ)"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsApplying(false)}
                  className="p-1 text-ink-muted hover:text-ink"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                  <div className="font-bold text-ink">
                    งบที่ใช้จัดอันดับ: {overview?.shopName || "ยังไม่ได้นำเข้างบ"}
                    {accepted?.context.smeId ? "" : " · ยังไม่ผูกกับกิจการในฐานข้อมูล"}
                  </div>
                  <div className="text-ink-muted">
                    ทางเลือกที่เลือก: {activeFunding.name} ({activeFunding.provider}) · {activeFunding.typeLabel}
                    {" · "}สถานะตามเกณฑ์: {activeFunding.status === "eligible" ? "ผ่านเกณฑ์ตัวเลข" : activeFunding.status === "requires_info" ? "ต้องข้อมูลเพิ่ม" : "ไม่ผ่านเกณฑ์"}
                  </div>
                  <div className="font-mono font-bold text-brand">
                    ส่วนที่ขาดตามงบชุดนี้: {evaluation ? amount(evaluation.requestedAmount) : "ยังไม่มีข้อมูล"}
                    {" · "}วงเงิน {amount(activeFunding.minAmount)}–{amount(activeFunding.maxAmount)}
                  </div>
                </div>

                <div className="p-3 border border-slate-200 rounded-xl space-y-1 text-ink-muted">
                  <span className="font-bold text-ink block">
                    {canApply ? "ข้อมูลที่จะเปิดเผยแก่ผู้ให้ทุน:" : "สถานะการยื่นคำขอในระบบนี้:"}
                  </span>
                  <p>
                    {canApply
                      ? "ระบบจะส่งงบชุดที่วิเคราะห์และผลการจัดอันดับให้ผู้ให้ทุนตรวจ"
                      : `ยังไม่มีการยื่นคำขอ ลงนาม หรือส่งเอกสารใด ๆ · เหตุผลจาก /capabilities: ${applyBlockedReason}`}
                  </p>
                  <p>เอกสารที่ผู้ให้ทุนระบุ: {activeFunding.requiredDocs.length} รายการ (ดูรายการด้านหลังหน้านี้)</p>
                  <p>
                    {activeFunding.missing?.length
                      ? `ข้อมูลที่ยังขาดสำหรับเกณฑ์นี้: ${activeFunding.missing.join(", ")}`
                      : "ไม่มีรายการข้อมูลที่ขาดสำหรับเกณฑ์ตัวเลขของทางเลือกนี้"}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-borderLine">
                <button
                  type="button"
                  onClick={() => setIsApplying(false)}
                  className="px-4 py-2 border border-slate-200 rounded-btn text-xs text-ink-muted hover:bg-slate-50"
                >
                  {canApply ? "ยกเลิก" : "ปิด"}
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!canApply}
                  title={canApply ? undefined : applyBlockedReason}
                  className="px-5 py-2 bg-brand text-white rounded-btn text-xs font-bold hover:bg-brand-dark transition-all shadow-sm"
                >
                  {canApply ? "ยืนยันและส่งคำขอ" : "ยังไม่รองรับการส่งคำขอ"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StateRenderer>
  );
};
