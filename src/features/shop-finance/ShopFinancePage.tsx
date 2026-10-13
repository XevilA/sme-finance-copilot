import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { ShopFinance, Envelope } from "@/api/contracts/types";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { StateRenderer } from "@/components/ui/StateRenderer";
import {
  Users,
  Coins,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  FileCheck,
  ShieldCheck,
  Building,
} from "lucide-react";

export const ShopFinancePage: React.FC = () => {
  const { selectedShopId, setSelectedShopId, setCurrentPage, addToast } = useAppStore();
  const [finance, setFinance] = useState<ShopFinance | null>(null);
  const [loading, setLoading] = useState(true);

  // Signatures acceptance state
  const [isSigned, setIsSigned] = useState(false);

  const loadData = () => {
    setLoading(true);
    apiClient
      .getShopFinance(selectedShopId)
      .then((res) => {
        setFinance(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [selectedShopId]);

  const handleSignAgreement = () => {
    setIsSigned(true);
    addToast({
      type: "success",
      title: "ลงนามยอมรับแผนงานเรียบร้อย",
      message: `บันทึกข้อตกลงร่วมโครงการสำหรับ ${finance?.name || "ร้านค้า"} แล้ว`,
    });
  };

  if (loading || !finance) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-40 bg-slate-200 rounded-card animate-pulse" />
        <div className="h-96 bg-slate-200 rounded-card animate-pulse" />
      </div>
    );
  }

  const isShortage = finance.fundingGap > 0;

  return (
    <StateRenderer onRetry={loadData}>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 text-ink animate-fade-in">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borderLine pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-display font-bold text-ink">
                แผนการเงินรายร้านในทีม (Per-Shop Financial Model)
              </h1>
              <DataKindBadge kind="forecast" size="md" />
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              ตรวจกระแสเงินสด วันที่เงินติดลบ และลงนามรับทราบข้อตกลง 4 ฝ่าย
            </p>
          </div>

          {/* Shop Switcher Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {[
              { id: "shop-1", name: "บ้านข้าวหอม (ขาด ฿14k)" },
              { id: "shop-2", name: "ครัวป้าสมร" },
              { id: "shop-3", name: "เจ๊ดาวแกงใต้ (ขาด ฿15.5k)" },
              { id: "shop-4", name: "เฮียฮงหมูกรอบ" },
              { id: "shop-5", name: "ครัวสวนผัก" },
              { id: "shop-6", name: "ปิ่นโตแม่เพ็ญ" },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedShopId(s.id)}
                className={`px-3 py-1 rounded-chip text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedShopId === s.id
                    ? "bg-brand text-white shadow-xs"
                    : "bg-white border border-borderLine text-ink hover:border-brand/40"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Essential Headline Callout: 'รับงานเพิ่มแล้วเหลือเงินเพิ่มจริงไหม' (Rule D & G10) */}
        <div className="p-5 rounded-card bg-gradient-to-r from-brand/5 via-white to-emerald-50/50 border border-brand/20 space-y-2 shadow-soft-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-display font-bold text-ink flex items-center gap-2">
              <Coins className="w-4 h-4 text-brand" />
              <span>รับงานเพิ่มแล้วเหลือเงินเพิ่มจริงไหม? (แยกกำไร vs เงินสด)</span>
            </h2>
            <DataKindBadge kind="forecast" size="sm" />
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            สำหรับ <strong>{finance.name}</strong> โควตา 50 กล่อง/วัน (รวม 500 กล่อง): ได้รับรายได้รวม <strong>฿{finance.revenue.toLocaleString()}</strong>{" "}
            หักต้นทุนรวม <strong>฿{finance.totalCost.toLocaleString()}</strong> จะได้กำไรสุทธิทางบัญชี <strong>฿{finance.projectedProfit.toLocaleString()}</strong> ({finance.profitMarginPercent}% มาร์จิน){" "}
            แต่<strong>เงินสดจริงจะติดลบ ฿{Math.abs(finance.minCashBalance).toLocaleString()}</strong> ในสัปดาห์แรกหากไม่มีเงินทุนหมุนเวียนเสริม
          </p>
        </div>

        {/* Financial Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 bg-white rounded-card border border-borderLine">
            <span className="text-[10px] text-ink-muted block">โควตารับงาน</span>
            <span className="text-sm font-bold font-mono text-ink">
              {finance.boxesPerDay} กล่อง/วัน
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">รวม {finance.totalBoxes} กล่อง</span>
          </div>

          <div className="p-3 bg-white rounded-card border border-borderLine">
            <span className="text-[10px] text-ink-muted block">รายรับรวม</span>
            <span className="text-sm font-bold font-mono text-ink">
              ฿{finance.revenue.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">@ ฿{finance.sellingPricePerBox}/กล่อง</span>
          </div>

          <div className="p-3 bg-white rounded-card border border-borderLine">
            <span className="text-[10px] text-ink-muted block">ต้นทุนรวม</span>
            <span className="text-sm font-bold font-mono text-ink">
              ฿{finance.totalCost.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">วัตถุดิบ+ค่าแรง+ส่ง</span>
          </div>

          <div className="p-3 bg-white rounded-card border border-brand/30 bg-brand/5">
            <span className="text-[10px] font-bold text-brand block">กำไรสุทธิคาดการณ์</span>
            <span className="text-sm font-extrabold font-mono text-brand">
              ฿{finance.projectedProfit.toLocaleString()}
            </span>
            <span className="text-[10px] text-brand/80 block mt-0.5">มาร์จิน {finance.profitMarginPercent}%</span>
          </div>

          <div className="p-3 bg-white rounded-card border border-borderLine">
            <span className="text-[10px] text-ink-muted block">เงินสดต้องจ่ายก่อน</span>
            <span className="text-sm font-bold font-mono text-ink">
              ฿{finance.upfrontCashNeeded.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">มัดจำของสด Day 1</span>
          </div>

          <div className={`p-3 rounded-card border ${isShortage ? "bg-red-50 border-danger" : "bg-emerald-50 border-emerald-300"}`}>
            <span className={`text-[10px] font-bold block ${isShortage ? "text-danger" : "text-emerald-800"}`}>
              {isShortage ? "ทุนที่ยังขาด" : "สภาพคล่อง"}
            </span>
            <span className={`text-sm font-extrabold font-mono ${isShortage ? "text-danger" : "text-emerald-700"}`}>
              {isShortage ? `ขาด ฿${finance.fundingGap.toLocaleString()}` : "เพียงพอ"}
            </span>
            {isShortage && (
              <button
                type="button"
                onClick={() => setCurrentPage("funding", { shopId: finance.shopId })}
                className="text-[10px] font-bold text-danger underline block mt-0.5"
              >
                หาเงินสำหรับร้านนี้ →
              </button>
            )}
          </div>
        </div>

        {/* Cost Itemization Table */}
        <div className="bg-white rounded-card border border-borderLine p-4 space-y-3">
          <h3 className="text-xs font-display font-bold text-ink uppercase tracking-wider">
            แจกแจงโครงสร้างต้นทุน (Cost Breakdown per Shop)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <span className="text-ink-muted block text-[10px]">ค่าวัตถุดิบของสด</span>
              <span className="font-bold text-ink font-mono">฿{finance.rawMaterialCost.toLocaleString()}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <span className="text-ink-muted block text-[10px]">ค่าแรงงานเพิ่มเติม</span>
              <span className="font-bold text-ink font-mono">฿{finance.additionalLaborCost.toLocaleString()}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <span className="text-ink-muted block text-[10px]">ค่าขนส่งควบคุมอุณหภูมิ</span>
              <span className="font-bold text-ink font-mono">฿{finance.deliveryCost.toLocaleString()}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <span className="text-ink-muted block text-[10px]">ค่าบริการระบบ SWARM</span>
              <span className="font-bold text-ink font-mono">฿{finance.serviceFee.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Cashflow Timeline Events */}
        <div className="bg-white rounded-card border border-borderLine p-4 space-y-3">
          <h3 className="text-xs font-display font-bold text-ink uppercase tracking-wider flex items-center justify-between">
            <span>เส้นทางเงินสดของร้าน (Cash Timeline: ซื้อของ → ผลิต → ส่งงาน → รับเงิน)</span>
            <DataKindBadge kind="forecast" size="sm" />
          </h3>

          <div className="space-y-2">
            {finance.cashTimeline.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-brand bg-brand/10 px-2 py-0.5 rounded text-[11px]">
                    {item.date}
                  </span>
                  <div>
                    <div className="font-semibold text-ink">{item.title}</div>
                    <div className="text-[11px] text-ink-muted">{item.note}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`font-mono font-bold text-xs ${
                      item.amount > 0 ? "text-emerald-700" : item.amount < 0 ? "text-danger" : "text-slate-500"
                    }`}
                  >
                    {item.amount > 0 ? "+" : ""}{item.amount !== 0 ? `฿${item.amount.toLocaleString()}` : "ส่งมอบ"}
                  </div>
                  <div className="text-[10px] text-ink-muted font-mono">
                    เงินสดคงเหลือ: ฿{item.cashBalance.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4-Party Agreement Sign-off Box */}
        <div className="p-5 rounded-card bg-white border border-borderLine space-y-4 shadow-soft-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-display font-bold text-ink uppercase tracking-wider">
                การลงนามยอมรับเงื่อนไข 4 ฝ่ายก่อนเริ่มงานจริง
              </h3>
              <p className="text-[11px] text-ink-muted">
                ข้อตกลงราคา ส่วนแบ่ง มาตรฐาน วันส่ง และรอบจ่ายเงิน
              </p>
            </div>
            <DataKindBadge kind="actual" size="sm" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[10px] text-slate-400 block">1. ผู้ว่าจ้าง (Buyer)</span>
              <div className="font-bold text-ink">บจก.สยามเทคโนพาร์ค</div>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                <CheckCircle2 className="w-3 h-3" /> ลงนามแล้ว
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[10px] text-slate-400 block">2. โลจิสติกส์ (Fleet)</span>
              <div className="font-bold text-ink">รถเย็นรวม SWARM</div>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                <CheckCircle2 className="w-3 h-3" /> ลงนามแล้ว
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[10px] text-slate-400 block">3. ร้านค้า (Shop)</span>
              <div className="font-bold text-ink">{finance.name}</div>
              {isSigned || finance.partyAcceptance.shopSigned ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> ลงนามแล้ว
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-semibold">
                  <AlertTriangle className="w-3 h-3" /> รอยืนยันทุน
                </span>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[10px] text-slate-400 block">4. ผู้ให้ทุน (Funder)</span>
              <div className="font-bold text-ink">Siam Supply Chain Fintech</div>
              {isSigned || finance.partyAcceptance.funderSigned ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> ยืนยันปล่อยกู้
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                  รอจับคู่ทุน
                </span>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-ink-muted">
              การเปลี่ยนแปลงร้านหรือเงื่อนไขสำคัญ จะสร้างสัญญาฉบับใหม่ให้ตรวจยอมรับเสมอ
            </span>
            <button
              type="button"
              onClick={handleSignAgreement}
              disabled={isSigned}
              className="px-5 py-2 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-btn text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <FileCheck className="w-4 h-4" />
              <span>{isSigned ? "ลงนามยอมรับแล้ว" : "ลงนามยอมรับแผนฉบับนี้"}</span>
            </button>
          </div>
        </div>
      </div>
    </StateRenderer>
  );
};
