import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { FundingOption, Envelope } from "@/api/contracts/types";
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
  const [fundingEnvelope, setFundingEnvelope] = useState<Envelope<FundingOption[]> | null>(null);
  const [selectedFundingId, setSelectedFundingId] = useState<string>("fund-factoring");
  const [isComparing, setIsComparing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Application Drawer
  const [isApplying, setIsApplying] = useState(false);

  const loadData = () => {
    setLoading(true);
    apiClient
      .getFundingOptions()
      .then((res) => {
        setFundingEnvelope(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApply = () => {
    setIsApplying(false);
    addToast({
      type: "success",
      title: "ส่งคำขอสินเชื่อเบื้องต้นสำเร็จ",
      message: "เอกสาร PO ถูกส่งต่อไปยังผู้ให้ทุนเพื่อตรวจสอบความถูกต้องแล้ว",
    });
  };

  if (loading || !fundingEnvelope) {
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

  const fundingOptions = fundingEnvelope.data;
  const activeFunding =
    fundingOptions.find((f) => f.id === selectedFundingId) || fundingOptions[0];

  return (
    <StateRenderer onRetry={loadData}>
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
            <span className="text-lg font-bold font-mono text-ink">฿47,500</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">ค่าของสด 2 ร้านแรก</span>
          </div>

          <div>
            <span className="text-[10px] text-ink-muted block uppercase tracking-wider">
              เงินสดในมือปัจจุบัน
            </span>
            <span className="text-lg font-bold font-mono text-ink">฿18,000</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">รวม 2 ร้านที่ติดขัด</span>
          </div>

          <div className="border-x border-slate-100 px-3">
            <span className="text-[10px] font-bold text-danger block uppercase tracking-wider">
              ทุนที่ยังขาด (Funding Gap)
            </span>
            <span className="text-lg font-extrabold font-mono text-danger tabular-nums">
              ฿29,500
            </span>
            <span className="text-[10px] text-danger font-medium block mt-0.5">
              ร้านบ้านข้าวหอม ฿14k · เจ๊ดาว ฿15.5k
            </span>
          </div>

          <div>
            <span className="text-[10px] text-brand block uppercase tracking-wider font-semibold">
              วันที่ต้องมีเงินสดพร้อม
            </span>
            <span className="text-lg font-bold font-mono text-brand">1 พ.ย. 2026</span>
            <span className="text-[10px] text-emerald-700 font-medium block mt-0.5">
              ต้องการเงินด่วนใน 24 ชม.
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
            className="px-3 py-1 bg-brand text-white font-semibold rounded-lg ml-auto flex items-center gap-1"
          >
            <span>4. เตรียมยื่นคำขอ</span>
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
                  title: "จำลองค่างวด",
                  message: `คำนวณค่างวดสำหรับ ${funding.name} เรียบร้อย`,
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
              <strong>เหตุผลที่แนะนำทางเลือกนี้:</strong> {activeFunding.matchReason}
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
                  ตรวจยืนยันคำขอเงินทุนหมุนเวียน (Verification Step)
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
                  <div className="font-bold text-ink">ผู้ยื่นคำขอ: ร้านบ้านข้าวหอม & เจ๊ดาวแกงปักษ์ใต้</div>
                  <div className="text-ink-muted">วัตถุประสงค์: ซื้อวัตถุดิบอาหาร 300 กล่อง/วัน</div>
                  <div className="font-mono font-bold text-brand">วงเงินที่ขอเบิก: ฿29,500</div>
                </div>

                <div className="p-3 border border-slate-200 rounded-xl space-y-1 text-ink-muted">
                  <span className="font-bold text-ink block">ข้อมูลที่จะเปิดเผยแก่ผู้ให้ทุน:</span>
                  <p>✓ ใบสั่งซื้อยืนยัน (PO #STP-2026-091) จาก บจก.สยามเทคโนพาร์ค</p>
                  <p>✓ สัญญาบันทึกข้อตกลงร่วมกลุ่ม 6 ร้านค้า</p>
                  <p>✕ ข้อมูลสูตรอาหารและบัญชีส่วนตัวจะถูกปิดเป็นความลับ</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-borderLine">
                <button
                  type="button"
                  onClick={() => setIsApplying(false)}
                  className="px-4 py-2 border border-slate-200 rounded-btn text-xs text-ink-muted hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="px-5 py-2 bg-brand text-white rounded-btn text-xs font-bold hover:bg-brand-dark transition-all shadow-sm"
                >
                  ยืนยันและส่งคำขอ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StateRenderer>
  );
};
