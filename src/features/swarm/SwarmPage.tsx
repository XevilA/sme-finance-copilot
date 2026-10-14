import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { SwarmOrder, SwarmProposal, Shop, StuckReasonType } from "@/api/contracts/types";
import { ShopCard } from "@/components/signature/ShopCard";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { StateRenderer } from "@/components/ui/StateRenderer";
import {
  Network,
  Sparkles,
  AlertTriangle,
  Coins,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sliders,
  ArrowRight,
  ShieldAlert,
  Building2,
  Calendar,
  MapPin,
  FileCheck,
  ChevronRight,
  Users,
} from "lucide-react";

export const SwarmPage: React.FC = () => {
  const {
    setCurrentPage,
    setSelectedShopId,
    setAIPanelOpen,
    isReducedMotion,
    swappedShops,
    swapShop,
    addToast,
  } = useAppStore();

  const [order, setOrder] = useState<SwarmOrder | null>(null);
  const [proposal, setProposal] = useState<SwarmProposal | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

  // S2 Swarm Assembly Animation State
  const [isAssembling, setIsAssembling] = useState(false);
  const [scanPulse, setScanPulse] = useState(false);

  // S3 Project Stuck Spotlight State (3 buttons: capacity | funding | delivery)
  const [stuckFilter, setStuckFilter] = useState<StuckReasonType | "all">("all");

  // Shop Swap Modal State
  const [swappingShopId, setSwappingShopId] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([apiClient.getOrder(), apiClient.getSwarmProposal(), apiClient.getShops()])
      .then(([orderRes, propRes, shopsRes]) => {
        setOrder(orderRes.data);
        setProposal(propRes.data);
        setShops(shopsRes.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Trigger S2 Radar Scan & Orbit Assembly
  const handleTriggerSwarmAssembly = () => {
    setIsAssembling(true);
    setScanPulse(true);
    setTimeout(() => setScanPulse(false), 800);
    setTimeout(() => {
      setIsAssembling(false);
      addToast({
        type: "success",
        title: "เสนอทีม 6 ร้านสำเร็จ",
        message: "ระบบจัดสรรโควตาร้านละ 50 กล่อง รวม 300 กล่อง/วัน ครบถ้วน",
      });
    }, 1200);
  };

  // Perform Swap with Fallback Shop
  const handleConfirmSwap = (oldShopId: string, newShopName: string) => {
    swapShop(oldShopId, "shop-backup-1");
    setSwappingShopId(null);
    addToast({
      type: "success",
      title: "สลับร้านค้าสำเร็จ",
      message: `เปลี่ยนเป็น '${newShopName}' เรียบร้อยแล้ว แผนเงินถูกคำนวณใหม่`,
    });
  };

  if (loading || !order || !proposal) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-40 bg-slate-200 rounded-card animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-96 bg-slate-200 rounded-card animate-pulse" />
          <div className="h-96 bg-slate-200 rounded-card animate-pulse" />
          <div className="h-96 bg-slate-200 rounded-card animate-pulse" />
        </div>
      </div>
    );
  }

  // Calculate if shops have funding gaps
  const shortageCount = proposal.shops.filter((s) => s.fundingGap > 0).length;
  const isDeficit = proposal.deficitBoxesPerDay > 0;

  return (
    <StateRenderer onRetry={loadData}>
      <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6 text-ink animate-fade-in">
        {/* Top Title & S2 Assembly Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borderLine pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-brand text-white flex items-center justify-center font-bold text-sm">
                <Network className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-display font-bold text-ink">
                SME SWARM รวมทีมรับงานใหญ่
              </h1>
              <DataKindBadge kind="forecast" size="md" />
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              ระบบจัดสรรคำสั่งซื้อขนาดใหญ่ กระจายโควตาสู่ร้านค้ารายย่อย พร้อมตรวจความพร้อมเงินทุนหมุนเวียน
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* S2 Assembly Button: 'เสนอทีมให้ฉัน' */}
            <button
              type="button"
              onClick={handleTriggerSwarmAssembly}
              className="px-4 py-2 bg-gradient-to-r from-brand to-brand-dark hover:opacity-95 text-white rounded-btn text-xs font-bold flex items-center gap-1.5 shadow-glow-primary transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-glow animate-spin" />
              <span>เสนอทีมให้ฉัน (Radar Scan)</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage("simulator")}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-btn text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-attention" />
              <span>ซ้อมแผนพัง (Chaos)</span>
            </button>
          </div>
        </div>

        {/* S3 Project Stuck Spotlight Selector (Part E4) */}
        <div className="p-3 bg-white rounded-xl border border-borderLine flex flex-wrap items-center justify-between gap-3 shadow-soft-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert className="w-4 h-4 text-attention" />
              <span>จุดติดของโครงการ (S3 Spotlight):</span>
            </span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setStuckFilter("all")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  stuckFilter === "all" ? "bg-white text-ink shadow-2xs font-semibold" : "text-ink-muted"
                }`}
              >
                ทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => setStuckFilter("capacity")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                  stuckFilter === "capacity" ? "bg-white text-ink shadow-2xs font-semibold" : "text-ink-muted"
                }`}
              >
                <span>กำลังผลิต</span>
                {isDeficit && <span className="w-1.5 h-1.5 rounded-full bg-danger" />}
              </button>
              <button
                type="button"
                onClick={() => setStuckFilter("funding")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                  stuckFilter === "funding" ? "bg-red-50 text-danger shadow-2xs font-semibold" : "text-ink-muted"
                }`}
              >
                <span>เงินทุนหมุนเวียน (ติด 2 ร้าน)</span>
                {shortageCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-danger text-white rounded-full text-[9px] font-bold">
                    {shortageCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setStuckFilter("delivery")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  stuckFilter === "delivery" ? "bg-white text-ink shadow-2xs font-semibold" : "text-ink-muted"
                }`}
              >
                ส่งมอบ
              </button>
            </div>
          </div>

          <div className="text-xs text-ink-muted flex items-center gap-1.5">
            <span>ฉบับแผนงาน: <strong>{proposal.version}</strong></span>
          </div>
        </div>

        {/* 3 Columns Layout (ซ้าย = ข้อกำหนดงาน / กลาง = แผนผังทีมและการ์ดร้าน / ขวา = สรุปงบและทุนที่ขาด) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Column 1: Order Specifications (ซ้าย) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="p-4 rounded-card bg-white border border-borderLine shadow-soft-sm">
              <span className="text-[10px] font-bold text-brand uppercase tracking-wider block mb-1">
                คำสั่งซื้อต้นทาง (B2B Demand)
              </span>
              <h3 className="text-sm font-display font-bold text-ink leading-snug mb-2">
                {order.title}
              </h3>

              <div className="space-y-2.5 text-xs border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">ผู้ว่าจ้าง:</span>
                  <span className="font-semibold text-ink flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-brand" />
                    {order.buyerName}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">ความต้องการ:</span>
                  <span className="font-bold text-brand font-mono text-sm">
                    {order.quantityPerDay} กล่อง/วัน
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">ระยะเวลา:</span>
                  <span className="font-medium text-ink font-mono">{order.days} วัน (รวม 3,000 กล่อง)</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">ราคาเสนอซื้อ:</span>
                  <span className="font-bold text-ink font-mono">฿{order.unitPrice} / กล่อง</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">งบประมาณรวม:</span>
                  <span className="font-bold text-emerald-700 font-mono text-sm">
                    ฿{order.budgetTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Delivery Terms */}
              <div className="mt-3 p-2.5 bg-slate-50 rounded-xl text-[11px] text-ink-muted space-y-1.5 border border-slate-100">
                <div className="flex items-start gap-1.5">
                  <Calendar className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                  <span>{order.targetDeliveryDate}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{order.deliveryLocation}</span>
                </div>
                <div className="flex items-start gap-1.5 text-brand-dark font-medium">
                  <FileCheck className="w-3 h-3 text-brand mt-0.5 shrink-0" />
                  <span>{order.paymentTerms}</span>
                </div>
              </div>
            </div>

            {/* Stuck Spotlight Alert Banner if Funding is filtered */}
            {stuckFilter === "funding" && (
              <div className="p-4 rounded-card bg-red-50 border-2 border-danger text-danger space-y-2 shadow-soft-md animate-fade-in">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>ติดปัญหา: เงินหมุนเวียนไม่พอ 2 ร้าน</span>
                </div>
                <p className="text-[11px] text-red-800 leading-relaxed">
                  ร้านบ้านข้าวหอม (ขาด ฿14,000) และ เจ๊ดาวแกงปักษ์ใต้ (ขาด ฿15,500) มีเงินสดไม่พอช่วงมัดจำวัตถุดิบ 1 พ.ย.
                </p>
                <button
                  type="button"
                  onClick={() => setCurrentPage("funding")}
                  className="w-full py-1.5 bg-danger text-white rounded-btn text-xs font-bold hover:bg-danger-dark transition-colors flex items-center justify-center gap-1"
                >
                  <span>แก้ตรงนี้: จับคู่ทุนด่วน 24 ชม.</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Column 2: Swarm Orbit Studio (กลาง - 6 ร้านค้า) */}
          <div className="lg:col-span-6 space-y-4">
            {/* Visual Orbit Canvas Container */}
            <div className="relative p-4 rounded-card bg-slate-50 border border-borderLine min-h-[580px] flex flex-col justify-between overflow-hidden">
              {/* Radar Scan Wave Pulse (S2) */}
              {scanPulse && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
                  <div className="w-96 h-96 rounded-full border-4 border-brand-glow animate-ping opacity-75" />
                </div>
              )}

              {/* Top Bar of Studio */}
              <div className="flex items-center justify-between text-xs mb-3">
                <span className="font-bold text-ink flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-brand" />
                  <span>ทีมผู้ผลิต 6 ร้านค้า (โควตาร้านละ 50 กล่อง)</span>
                </span>
                <span className="text-ink-muted text-[11px]">
                  รัศมีเฉลี่ย 3.8 กม. จากศูนย์กระจายสินค้า
                </span>
              </div>

              {/* Grid of 6 Shops */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {shops.map((shop) => {
                  const isStuck =
                    stuckFilter === "funding" && shop.fundingGap > 0;
                  const isDimmed =
                    stuckFilter === "funding" && shop.fundingGap === 0;

                  return (
                    <div
                      key={shop.id}
                      className={`transition-all duration-300 ${
                        isDimmed ? "opacity-30 filter grayscale" : "opacity-100"
                      }`}
                    >
                      <ShopCard
                        shop={shop}
                        dataKind="forecast"
                        isStuckHighlighted={isStuck}
                        onSelect={() => {
                          setSelectedShopId(shop.id);
                        }}
                        onViewFinance={() => {
                          setSelectedShopId(shop.id);
                          setCurrentPage("shop-finance", { shopId: shop.id });
                        }}
                        onSwapShop={() => setSwappingShopId(shop.id)}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Shared Logistics Node */}
              <div className="mt-4 p-3 rounded-xl bg-white border border-resource/40 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-resource-light text-resource-dark flex items-center justify-center font-bold">
                    🚚
                  </div>
                  <div>
                    <span className="font-bold text-ink">รถขนส่งควบคุมความเย็นรวม (Chilled Van)</span>
                    <div className="text-[11px] text-ink-muted">รับของ 10:00 น. · ส่งถึงศูนย์ประชุม 11:00 น.</div>
                  </div>
                </div>
                <span className="text-resource-dark font-bold font-mono">แชร์ร่วม 6 ร้าน</span>
              </div>
            </div>
          </div>

          {/* Column 3: Totals, Financial Settlement & Constraints (ขวา) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="p-4 rounded-card bg-white border border-borderLine shadow-soft-sm space-y-4">
              <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">
                สรุปยอดรวมทั้งทีม (Swarm Tally)
              </span>

              {/* Total Capacity Meter */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-ink-muted">กำลังผลิตรวม</span>
                  <span className="font-bold font-mono text-ink">
                    {proposal.totalCapacityAssigned} / {order.quantityPerDay} กล่อง/วัน
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(proposal.totalCapacityAssigned / order.quantityPerDay) * 100}%`,
                    }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-700 font-semibold">✓ ครบ 100% (300 กล่อง)</span>
                  <span className="text-slate-400">ร้านละ 50 กล่อง</span>
                </div>
              </div>

              {/* Financial Rollup */}
              <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">รายรับรวม (6 ร้าน):</span>
                  <span className="font-bold font-mono text-ink">
                    ฿{proposal.totalRevenue.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">ต้นทุนรวม (6 ร้าน):</span>
                  <span className="font-medium font-mono text-ink">
                    ฿{proposal.totalCost.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-2">
                  <span className="font-bold text-brand">กำไรสุทธิรวมของทีม:</span>
                  <span className="font-extrabold font-mono text-brand text-sm">
                    ฿{proposal.totalProfit.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Funding Gap Card */}
              <div className="p-3 bg-red-50 rounded-xl border border-danger/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-danger">ทุนที่ยังขาดรวม:</span>
                  <span className="text-sm font-extrabold text-danger font-mono tabular-nums">
                    ฿{proposal.totalFundingGap.toLocaleString()}
                  </span>
                </div>
                <p className="text-[10px] text-red-700 leading-tight">
                  ขาดเงินหมุนเวียน 2 ร้าน (บ้านข้าวหอม ฿14k + เจ๊ดาว ฿15.5k) สำหรับซื้อวัตถุดิบช่วง Day 1–3
                </p>
                <button
                  type="button"
                  onClick={() => setCurrentPage("funding")}
                  className="w-full py-1.5 bg-danger text-white rounded-lg text-xs font-bold hover:bg-danger-dark flex items-center justify-center gap-1 transition-colors"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>จับคู่ทุนเฉพาะส่วนที่ขาด</span>
                </button>
              </div>

              {/* Project Readiness Status Banner */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-2 text-xs">
                  <span className="text-ink-muted">สถานะความพร้อม:</span>
                  <span className="font-bold text-attention bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    รอเติมทุน 2 ร้าน
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage("shop-finance")}
                  className="w-full py-2 bg-brand text-white rounded-btn text-xs font-semibold hover:bg-brand-dark flex items-center justify-center gap-1 transition-all shadow-sm"
                >
                  <span>ดูแผนเงินและลงนามรายร้าน</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Shop Swap Modal (Fallback Selection) */}
        {swappingShopId && (
          <div
            className="fixed inset-0 z-50 bg-navy-deep/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setSwappingShopId(null)}
          >
            <div
              className="w-full max-w-md bg-white rounded-card shadow-soft-lg border border-borderLine p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-borderLine pb-3">
                <h3 className="font-display font-bold text-ink text-sm">
                  เลือกสลับร้านค้าในทีม
                </h3>
                <button
                  type="button"
                  onClick={() => setSwappingShopId(null)}
                  className="p-1 text-ink-muted hover:text-ink"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-ink-muted leading-relaxed">
                ร้านสำรองที่ผ่านเกณฑ์สุขอนามัยและพร้อมเข้าแทนที่โควตา 50 กล่อง/วัน ทันที:
              </p>

              <div className="p-3 rounded-xl border border-brand/30 bg-brand/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-ink">ครัวร่มไทร ข้าวราดแกง (ร้านสำรองอันดับ 1)</div>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">
                    สภาพคล่องพร้อม
                  </span>
                </div>
                <div className="text-[11px] text-ink-muted">
                  กำลังผลิตว่าง 60 กล่อง/วัน · ต้นทุน 55 ฿/กล่อง · เงินสดสำรอง ฿40,000
                </div>
                <button
                  type="button"
                  onClick={() => handleConfirmSwap(swappingShopId, "ครัวร่มไทร ข้าวราดแกง")}
                  className="w-full py-2 bg-brand text-white text-xs font-bold rounded-btn hover:bg-brand-dark transition-all mt-2"
                >
                  ยืนยันสลับเข้าร่วมทีม
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StateRenderer>
  );
};
