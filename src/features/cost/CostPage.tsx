import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { CostBreakdown, Envelope } from "@/api/contracts/types";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { StateRenderer } from "@/components/ui/StateRenderer";
import {
  PieChart,
  Calculator,
  ArrowRight,
  Sparkles,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";

export const CostPage: React.FC = () => {
  const { setCurrentPage } = useAppStore();
  const [costEnvelope, setCostEnvelope] = useState<Envelope<CostBreakdown> | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("inv-share-hub");
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    apiClient
      .getCostBreakdown()
      .then((res) => {
        setCostEnvelope(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading || !costEnvelope) {
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

  const cost = costEnvelope.data;

  return (
    <StateRenderer onRetry={loadData}>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 text-ink animate-fade-in">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borderLine pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-brand text-white flex items-center justify-center font-bold">
                <PieChart className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-display font-bold text-ink">
                ต้นทุนและความคุ้มค่า (Cost Breakdown & Investment Appraisal)
              </h1>
              <DataKindBadge kind="actual" size="md" />
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              โครงสร้างต้นทุนต่อหน่วย จุดคุ้มทุน และเปรียบเทียบความคุ้มค่าแผนลงทุน A vs B
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage("unlock")}
              className="px-3.5 py-1.5 bg-resource-light hover:bg-resource/20 border border-resource/30 text-resource-dark text-xs font-semibold rounded-btn flex items-center gap-1 transition-colors"
            >
              <span>ลดต้นทุนผ่าน SME UNLOCK</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Section 1: Current Cost Breakdown & Breakeven */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-5 rounded-card border border-borderLine shadow-soft-sm">
          <div>
            <span className="text-[10px] text-ink-muted block uppercase tracking-wider">ต้นทุนต่อหน่วย</span>
            <span className="text-2xl font-bold font-mono text-ink">฿{cost.costPerUnit}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">ต่อกล่องอาหาร</span>
          </div>

          <div>
            <span className="text-[10px] text-ink-muted block uppercase tracking-wider">กำไรส่วนเกินต่อหน่วย</span>
            <span className="text-2xl font-bold font-mono text-brand">฿{cost.profitPerUnit}</span>
            <span className="text-[10px] text-brand/80 block mt-0.5">ราคาขาย 80 ฿/กล่อง</span>
          </div>

          <div>
            <span className="text-[10px] text-ink-muted block uppercase tracking-wider">จุดคุ้มทุน (Breakeven)</span>
            <span className="text-2xl font-bold font-mono text-emerald-700">{cost.breakevenUnits}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">กล่องต่อเดือน</span>
          </div>

          <div>
            <span className="text-[10px] text-ink-muted block uppercase tracking-wider">ต้นทุนคงที่รายเดือน</span>
            <span className="text-2xl font-bold font-mono text-ink">฿{cost.currentMonthlyFixedCost.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">ค่าเช่าร้าน/แก๊ส/เงินเดือน</span>
          </div>
        </div>

        {/* Section 2: Investment Appraisal Plans (A vs B in Single Screen) */}
        <div className="bg-white rounded-card p-5 border border-borderLine space-y-4 shadow-soft-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-ink">
                เปรียบเทียบแผนลงทุน: ซื้อเครื่องเอง (แผน A) vs เช่าแชร์ผ่าน UNLOCK (แผน B)
              </h3>
              <p className="text-[11px] text-ink-muted">
                คำนวณระยะเวลาคืนทุน (Payback Period), มูลค่าปัจจุบันสุทธิ (NPV), และผลตอบแทนภายใน (IRR)
              </p>
            </div>
            <DataKindBadge kind="forecast" size="sm" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cost.investmentPlans.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              const isPlanB = plan.id === "inv-share-hub";

              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                    isSelected
                      ? isPlanB
                        ? "bg-resource-light/40 border-resource ring-2 ring-resource/30 shadow-soft-md"
                        : "bg-brand/5 border-brand ring-2 ring-brand/30 shadow-soft-md"
                      : "bg-slate-50 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-chip ${isPlanB ? "bg-resource text-white" : "bg-slate-200 text-ink"}`}>
                        {isPlanB ? "★ แนะนำ (คุ้มค่าสูงสุด)" : "แนวทางดั้งเดิม"}
                      </span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    </div>

                    <h4 className="font-display font-bold text-sm text-ink mb-3 leading-snug">
                      {plan.name}
                    </h4>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 p-3 bg-white rounded-xl border border-slate-200 text-center text-xs mb-3">
                      <div>
                        <span className="text-[10px] text-ink-muted block">เงินลงทุนเริ่มแรก</span>
                        <span className="font-bold font-mono text-ink">฿{plan.initialInvestment.toLocaleString()}</span>
                      </div>
                      <div className="border-x border-slate-200">
                        <span className="text-[10px] text-ink-muted block">ระยะเวลาคืนทุน</span>
                        <span className="font-bold font-mono text-emerald-700">{plan.paybackMonths} เดือน</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-ink-muted block">ผลตอบแทน IRR</span>
                        <span className="font-bold font-mono text-brand">{plan.irr}%</span>
                      </div>
                    </div>

                    {/* Assumptions */}
                    <div className="space-y-1.5 text-[11px] text-ink-muted">
                      <span className="font-bold text-ink block text-[10px]">สมมติฐานที่ใช้:</span>
                      {plan.assumptions.map((asm, idx) => (
                        <div key={idx} className="flex justify-between border-b border-slate-100/60 pb-1">
                          <span>{asm.label}</span>
                          <span className="font-bold font-mono text-ink">
                            {asm.value.toLocaleString()} {asm.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-ink-muted">NPV: <strong>฿{plan.npv.toLocaleString()}</strong></span>
                    <span className="text-brand font-bold">
                      {isSelected ? "กำลังเลือกแผนนี้" : "คลิกเพื่อเลือกแผน"}
                    </span>
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
