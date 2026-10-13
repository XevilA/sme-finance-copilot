import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { ChaosScenario, Envelope } from "@/api/contracts/types";
import { ChaosPlayback } from "./ChaosPlayback";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { StateRenderer } from "@/components/ui/StateRenderer";
import {
  Sliders,
  RotateCcw,
  Save,
  Copy,
  TrendingDown,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

export const SimulatorPage: React.FC = () => {
  const {
    isSimulating,
    hasUnsavedChanges,
    resetSimulation,
    saveSimulationPlan,
    addToast,
    setCurrentPage,
  } = useAppStore();

  const [chaosEnvelope, setChaosEnvelope] = useState<Envelope<ChaosScenario[]> | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("chaos-shop-dropout");
  const [loading, setLoading] = useState(true);

  // Simulation Sandbox Inputs (Sliders + Numeric inputs)
  const [simSalesUnits, setSimSalesUnits] = useState(3000);
  const [simUnitPrice, setSimUnitPrice] = useState(80);
  const [simCostPerUnit, setSimCostPerUnit] = useState(56);
  const [simDepositPercent, setSimDepositPercent] = useState(20);
  const [simCreditTermDays, setSimCreditTermDays] = useState(15);

  const loadData = () => {
    setLoading(true);
    apiClient
      .getChaosScenarios()
      .then((res) => {
        setChaosEnvelope(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Baseline Plan A
  const baselineRevenue = 240000;
  const baselineCost = 171000;
  const baselineProfit = 69000;
  const baselineMinCash = -8000;
  const baselineFundingGap = 29500;

  // Calculated Plan B (Simulated)
  const simRevenue = (simSalesUnits / 6) * simUnitPrice; // for Shop 1 (500 units)
  const simCost = (simSalesUnits / 6) * simCostPerUnit;
  const simProfit = simRevenue - simCost;
  const simFundingGap = Math.max(0, simCost * 0.85 - 10000 - (simRevenue * simDepositPercent) / 100);
  const simMinCash = 10000 + (simRevenue * simDepositPercent) / 100 - simCost;

  const handleReset = () => {
    setSimSalesUnits(3000);
    setSimUnitPrice(80);
    setSimCostPerUnit(56);
    setSimDepositPercent(20);
    setSimCreditTermDays(15);
    resetSimulation();
    addToast({
      type: "info",
      title: "คืนค่าเดิมเรียบร้อย",
      message: "ข้อมูลถูกรีเซ็ตกลับเป็นค่ามาตรฐาน",
    });
  };

  if (loading || !chaosEnvelope) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-40 bg-slate-200 rounded-card animate-pulse" />
        <div className="h-96 bg-slate-200 rounded-card animate-pulse" />
      </div>
    );
  }

  return (
    <StateRenderer onRetry={loadData}>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 text-ink animate-fade-in">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borderLine pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-display font-bold text-ink">
                ห้องจำลองธุรกิจ & ซ้อมแผนพัง (Simulation Sandbox)
              </h1>
              <DataKindBadge kind="simulated" size="md" />
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              ทดลองเปลี่ยนสมมติฐานราคา มัดจำ ต้นทุน และซ้อมรับมือวิกฤติโดยไม่กระทบข้อมูลจริง
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 bg-white border border-borderLine hover:border-brand/40 text-xs font-semibold rounded-btn flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-ink-muted" />
              <span>คืนค่าเดิม</span>
            </button>

            <button
              type="button"
              onClick={() => saveSimulationPlan("แผน B (มัดจำ 35% ปิดช่องว่างเงินสด)")}
              className="px-4 py-1.5 bg-brand hover:bg-brand-dark text-white text-xs font-bold rounded-btn flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>บันทึกแผนจำลองฉบับใหม่</span>
            </button>
          </div>
        </div>

        {/* Signature S6: Chaos Rehearsal Playback Component */}
        <ChaosPlayback
          scenarios={chaosEnvelope.data}
          selectedScenarioId={selectedScenarioId}
          onSelectScenario={(id) => setSelectedScenarioId(id)}
        />

        {/* Side-by-Side Comparison: แผนเดิม (Plan A) vs แผนจำลอง (Plan B) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Simulation Controls (Left 6 Cols) */}
          <div className="lg:col-span-6 bg-white p-5 rounded-card border border-borderLine shadow-soft-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-ink flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-brand" />
                <span>ตัวปรับสมมติฐาน (คู่สไลเดอร์และช่องกรอก)</span>
              </h3>
              <DataKindBadge kind="simulated" size="sm" />
            </div>

            {/* 1. Deposit Percent */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink">เงินมัดจำล่วงหน้าจากผู้ว่าจ้าง (%)</span>
                <input
                  type="number"
                  min="10"
                  max="60"
                  value={simDepositPercent}
                  onChange={(e) => setSimDepositPercent(Number(e.target.value))}
                  className="w-20 px-2 py-0.5 border border-slate-200 rounded text-right font-mono text-xs font-bold"
                />
              </div>
              <input
                type="range"
                min="10"
                max="60"
                step="5"
                value={simDepositPercent}
                onChange={(e) => setSimDepositPercent(Number(e.target.value))}
                className="w-full accent-brand cursor-pointer"
              />
            </div>

            {/* 2. Selling Price per Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink">ราคาขายอาหารต่อกล่อง (฿)</span>
                <input
                  type="number"
                  min="60"
                  max="120"
                  value={simUnitPrice}
                  onChange={(e) => setSimUnitPrice(Number(e.target.value))}
                  className="w-20 px-2 py-0.5 border border-slate-200 rounded text-right font-mono text-xs font-bold"
                />
              </div>
              <input
                type="range"
                min="60"
                max="120"
                step="1"
                value={simUnitPrice}
                onChange={(e) => setSimUnitPrice(Number(e.target.value))}
                className="w-full accent-brand cursor-pointer"
              />
            </div>

            {/* 3. Cost per Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink">ต้นทุนวัตถุดิบและผลิตต่อกล่อง (฿)</span>
                <input
                  type="number"
                  min="40"
                  max="80"
                  value={simCostPerUnit}
                  onChange={(e) => setSimCostPerUnit(Number(e.target.value))}
                  className="w-20 px-2 py-0.5 border border-slate-200 rounded text-right font-mono text-xs font-bold"
                />
              </div>
              <input
                type="range"
                min="40"
                max="80"
                step="1"
                value={simCostPerUnit}
                onChange={(e) => setSimCostPerUnit(Number(e.target.value))}
                className="w-full accent-brand cursor-pointer"
              />
            </div>

            {/* 4. Payment Terms Days */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink">เครดิตเทอมชำระเงินงวดสุดท้าย (วัน)</span>
                <input
                  type="number"
                  min="0"
                  max="45"
                  value={simCreditTermDays}
                  onChange={(e) => setSimCreditTermDays(Number(e.target.value))}
                  className="w-20 px-2 py-0.5 border border-slate-200 rounded text-right font-mono text-xs font-bold"
                />
              </div>
              <input
                type="range"
                min="0"
                max="45"
                step="5"
                value={simCreditTermDays}
                onChange={(e) => setSimCreditTermDays(Number(e.target.value))}
                className="w-full accent-brand cursor-pointer"
              />
            </div>
          </div>

          {/* Before-After Results Comparison Table (Right 6 Cols) */}
          <div className="lg:col-span-6 bg-white p-5 rounded-card border border-borderLine shadow-soft-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-ink">
                เปรียบเทียบผลลัพธ์: แผน A (เดิม) vs แผน B (จำลอง)
              </h3>
              <span className="text-[11px] text-ink-muted">คำนวณรายร้าน (บ้านข้าวหอม)</span>
            </div>

            <div className="space-y-3 text-xs">
              {/* Row 1: Net Profit */}
              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-ink block">กำไรสุทธิโครงการ</span>
                  <span className="text-[10px] text-ink-muted">รายรับหักต้นทุนรวม</span>
                </div>
                <div className="flex items-center gap-4 font-mono text-right">
                  <div>
                    <span className="text-[10px] text-slate-400 block">แผนเดิม A</span>
                    <span className="font-bold text-ink">฿12,000</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-brand block">แผนจำลอง B</span>
                    <span className="font-extrabold text-brand">฿{Math.round(simProfit).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Row 2: Minimum Cash Balance */}
              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-ink block">เงินสดต่ำสุดในมือ</span>
                  <span className="text-[10px] text-ink-muted">จุดวิกฤติตอนซื้อของ</span>
                </div>
                <div className="flex items-center gap-4 font-mono text-right">
                  <div>
                    <span className="text-[10px] text-slate-400 block">แผนเดิม A</span>
                    <span className="font-bold text-danger">-฿8,000</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-brand block">แผนจำลอง B</span>
                    <span className={`font-extrabold ${simMinCash < 0 ? "text-danger" : "text-emerald-700"}`}>
                      ฿{Math.round(simMinCash).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 3: Funding Gap */}
              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-ink block">ทุนหมุนเวียนที่ยังขาด</span>
                  <span className="text-[10px] text-ink-muted">ต้องกู้หรือเติมเพิ่ม</span>
                </div>
                <div className="flex items-center gap-4 font-mono text-right">
                  <div>
                    <span className="text-[10px] text-slate-400 block">แผนเดิม A</span>
                    <span className="font-bold text-danger">฿14,000</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-brand block">แผนจำลอง B</span>
                    <span className="font-extrabold text-emerald-700">
                      ฿{Math.round(simFundingGap).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Insight Callout */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed">
              <strong>ข้อสรุปจากการจำลอง:</strong> หากเจรจาขอเพิ่มมัดจำเป็น {simDepositPercent}%{" "}
              {simFundingGap === 0 ? "เงินสดในมือจะเพียงพอตั้งแต่วันแรกโดยไม่ต้องกู้เงินภายนอกเลย!" : `จะช่วยลดเงินกู้ที่ต้องใช้ลงเหลือเพียง ฿${Math.round(simFundingGap).toLocaleString()}!`}
            </div>
          </div>
        </div>
      </div>
    </StateRenderer>
  );
};
