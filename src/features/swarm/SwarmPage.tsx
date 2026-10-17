import React, { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient, OrderContext } from "@/api/client";
import { OrderConstraints, SwarmOrder, SwarmProposal, Shop, StuckReasonType } from "@/api/contracts/types";
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
  Radar,
  Radio,
  Layers,
  Zap,
} from "lucide-react";

export const SwarmPage: React.FC = () => {
  const {
    setCurrentPage,
    setSelectedShopId,
    setAIPanelOpen,
    isReducedMotion,
    addToast,
  } = useAppStore();

  const [order, setOrder] = useState<SwarmOrder | null>(null);
  const [proposal, setProposal] = useState<SwarmProposal | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [context, setContext] = useState<OrderContext | null>(null);
  const [catalogue, setCatalogue] = useState<Shop[]>([]);
  const [eligibility, setEligibility] = useState<Record<string, { eligible: boolean; reasons: string[] }>>({});
  // Stored order requirements. A null snapshot or a null field is unknown; an
  // explicit [] means no type restriction and explicit null max_distance_km
  // means no distance limit. Nothing here is back-filled by the client.
  const [constraints, setConstraints] = useState<OrderConstraints | null>(null);
  const [contextMissing, setContextMissing] = useState<string[]>([]);
  const [proposalMissing, setProposalMissing] = useState<string[]>([]);
  const busy = useRef(false);
  const sequence = useRef(0);
  const unknown = (name: string) => contextMissing.includes(name) || proposalMissing.includes(name);
  const requiredTypes = constraints?.required_business_types;
  const typeRequirementText = unknown("required_business_types") || requiredTypes == null
    ? "ยังไม่ได้บันทึกประเภทงานที่ต้องการ"
    : requiredTypes.length === 0
    ? "ไม่จำกัดประเภทธุรกิจ (บันทึกไว้ชัดเจน)"
    : `ต้องเป็นประเภท: ${requiredTypes.join(", ")}`;
  const distanceText = unknown("max_distance_km") || constraints?.max_distance_km === undefined
    ? "ยังไม่ได้บันทึกรัศมีที่ยอมรับ"
    : constraints?.max_distance_km === null
    ? "ไม่จำกัดระยะทาง (บันทึกไว้ชัดเจน)"
    : `รัศมีไม่เกิน ${constraints?.max_distance_km} กม.`;
  const collectionText = unknown("collection_schedule") || constraints?.collection_schedule == null
    ? "ยังไม่ได้บันทึกงวดรับเงิน"
    : `งวดรับเงิน ${constraints?.collection_schedule.length} งวด`;
  const amount = (value: number) => value.toLocaleString("th-TH", { maximumFractionDigits: 2 });
  const applyProposal = (result: Awaited<ReturnType<typeof apiClient.assembleSwarm>>, pool: Shop[]) => {
    setProposal(result.data); setEligibility(result.audit.eligibility);
    setProposalMissing(result.missing || []);
    setShops(pool.map((shop) => {
      const allocation = result.data.shops.find((item) => item.shopId === shop.id);
      const assessment = result.audit.eligibility[shop.id];
      return { ...shop, workingCapitalNeeded: allocation?.workingCapitalNeeded ?? 0,
        fundingGap: allocation?.fundingGap ?? 0,
        status: assessment?.eligible === false ? "blocked" : result.missing?.length && allocation?.status === "ready" ? "review" : allocation?.status || "review",
        statusNote: assessment?.reasons.join("; ") || (allocation ? "ข้อเสนอที่คำนวณใหม่ ยังไม่จองโควตา" : "ยังไม่ได้รับส่วนแบ่งออเดอร์นี้") };
    }));
  };

  // S2 Swarm Assembly Animation State
  const [isAssembling, setIsAssembling] = useState(false);
  const [scanPulse, setScanPulse] = useState(false);
  const [activeOrbitShopId, setActiveOrbitShopId] = useState<string | null>(null);

  // View Mode: 'cockpit' (Radar Orbit + Cards) or 'roster' (Expanded Cards)
  const [viewMode, setViewMode] = useState<"cockpit" | "roster">("cockpit");

  // S3 Project Stuck Spotlight State (3 buttons: capacity | funding | delivery)
  const [stuckFilter, setStuckFilter] = useState<StuckReasonType | "all">("all");

  // Shop Swap Modal State
  const [swappingShopId, setSwappingShopId] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true); setError("");
    if (apiClient.isDemoMode()) {
      Promise.all([apiClient.getOrder(), apiClient.getShops(), apiClient.getSwarmProposal()])
        .then(([orderRes, shopsRes, proposalRes]) => {
          setOrder(orderRes.data); setShops(shopsRes.data); setCatalogue(shopsRes.data); setProposal(proposalRes.data);
        }).catch((err) => setError(err.message)).finally(() => setLoading(false));
      return;
    }
    const id = ++sequence.current;
    Promise.all([apiClient.getOrder(), apiClient.getShops(), apiClient.getOrderContext()])
      .then(async ([orderRes, shopsRes, contextRes]) => {
        // The stored snapshot is authoritative. When the project carries no
        // snapshot the requirements stay unknown rather than being assumed.
        const snapshot = contextRes.projectId
          ? await apiClient.getProjectConstraints(contextRes.projectId).then((res) => res.data).catch(() => null)
          : null;
        const result = await apiClient.assembleSwarm(contextRes.data);
        if (sequence.current !== id) return; // A newer scan already answered.
        setOrder(orderRes.data); setContext(contextRes.data); setCatalogue(shopsRes.data);
        setConstraints(snapshot ?? contextRes.constraints ?? null);
        setContextMissing(contextRes.missing || []);
        applyProposal(result, shopsRes.data);
      }).catch((err) => { if (sequence.current === id) setError(err.message); })
      .finally(() => { if (sequence.current === id) setLoading(false); });
  };
  useEffect(loadData, []);
  const assemble = async (next: OrderContext, message: string) => {
    if (busy.current) return; // One scan at a time; a repeat click is ignored.
    busy.current = true; setIsAssembling(true); setScanPulse(true);
    const id = ++sequence.current;
    try {
      const result = await apiClient.assembleSwarm(next);
      if (sequence.current !== id) return; // Discard a superseded scan's answer.
      setContext(next); applyProposal(result, catalogue.filter((shop) => next.shops.some((row) => row.shop_id === shop.id)));
      setSwappingShopId(null);
      const gaps = result.missing || [];
      addToast({
        type: gaps.length ? "warning" : "success",
        title: message,
        message: `จัดสรร ${result.data.totalCapacityAssigned} ต่อวัน · ขาดกำลังผลิต ${result.data.deficitBoxesPerDay} · ทุนที่ขาด ฿${amount(result.data.totalFundingGap)}`
          + " · เป็นข้อเสนอแบบ preview (persist=false) ยังไม่จองโควตา ทรัพยากร หรือยืนยันทีม"
          + (gaps.length ? ` · ข้อมูลโครงการที่ยังขาด: ${gaps.join(", ")}` : ""),
        duration: gaps.length ? 11000 : undefined,
      });
    } catch (err) { if (sequence.current === id) addToast({ type: "error", title: "คำนวณไม่สำเร็จ", message: (err as Error).message }); }
    finally { busy.current = false; setIsAssembling(false); setScanPulse(false); }
  };
  const handleTriggerSwarmAssembly = () => {
    if (context) void assemble(context, "คำนวณข้อเสนอทีมแล้ว");
    else addToast({ type: "error", title: "ยังเป็นโหมดตัวอย่าง", message: "ตั้ง VITE_USE_MOCK=false และเชื่อมต่อ backend ก่อนคำนวณทีมจริง" });
  };
  const assignedIds = new Set(proposal?.shops.map((shop) => shop.shopId) || []);
  const replacement = catalogue.find((shop) => !assignedIds.has(shop.id) && shop.id !== swappingShopId && eligibility[shop.id]?.eligible && shop.capacityAvailable > 0);
  const handleConfirmSwap = (oldShopId: string) => {
    if (!context || !replacement || busy.current) return;
    // Recompute the existing team with exactly the named replacement, retaining
    // its real resource dependencies and capacity constraints.
    const ids = new Set([...assignedIds].filter((id) => id !== oldShopId));
    ids.add(replacement.id);
    void assemble({ ...context, shops: context.shops.filter((shop) => ids.has(shop.shop_id)) }, "คำนวณทีมหลังสลับร้านแล้ว");
  };
  if (!loading && error) return <StateRenderer currentMode="error" errorMessage={error} onRetry={loadData}>{null}</StateRenderer>;

  if (loading || !order || !proposal) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-44 bg-slate-800/40 rounded-3xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-96 bg-slate-800/40 rounded-3xl animate-pulse" />
          <div className="h-96 bg-slate-800/40 rounded-3xl animate-pulse" />
          <div className="h-96 bg-slate-800/40 rounded-3xl animate-pulse" />
        </div>
      </div>
    );
  }

  // Calculate if shops have funding gaps
  const shortageCount = proposal.shops.filter((s) => s.fundingGap > 0).length;
  const isDeficit = proposal.deficitBoxesPerDay > 0;
  const blockedResources = [...new Set(context?.shops.flatMap((shop) => (shop.resources || [])
    .filter((resource) => resource.required && (!resource.available || resource.status !== "confirmed"))
    .map((resource) => resource.title)) || [])];

  // Node angles around orbit (6 positions: 0, 60, 120, 180, 240, 300 deg)
  const nodePositions = [
    { x: 50, y: 14, angle: 0 },
    { x: 82, y: 30, angle: 60 },
    { x: 82, y: 70, angle: 120 },
    { x: 50, y: 86, angle: 180 },
    { x: 18, y: 70, angle: 240 },
    { x: 18, y: 30, angle: 300 },
  ];

  return (
    <StateRenderer onRetry={loadData}>
      {/* Studio Cockpit Container with Deep Navy Theme & Cosmic Grid */}
      <div className="min-h-[calc(100vh-5rem)] bg-[#070D24] text-slate-100 rounded-3xl p-4 lg:p-7 border border-[#1b2b60] shadow-2xl relative overflow-hidden bg-cosmic-grid animate-fade-in">
        {/* Soft Ambient Nebula Lighting in Background */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-brand/15 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-resource/15 blur-[120px] pointer-events-none" />

        {/* Top Title & S2 Assembly Action Bar */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/90 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand to-teal-400 text-white flex items-center justify-center font-bold shadow-glow-primary">
                <Network className="w-5 h-5" />
              </div>
              <h1 className="text-xl md:text-2xl font-display font-bold text-white tracking-tight">
                SME SWARM รวมทีมรับงานใหญ่
              </h1>
              <DataKindBadge kind="forecast" size="md" />
            </div>
            <p className="text-xs text-slate-400">
              ห้องควบคุมการจัดสรรคำสั่งซื้อขนาดใหญ่ ตรวจผู้สมัคร {shops.length} ร้าน · {typeRequirementText} · {distanceText}
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5">
            {/* View Mode Toggle */}
            <div className="bg-[#101b3b] border border-slate-700/70 p-1 rounded-xl flex items-center text-xs">
              <button
                type="button"
                onClick={() => setViewMode("cockpit")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === "cockpit"
                    ? "bg-brand text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Radar className="w-3.5 h-3.5" />
                <span>เรดาร์วงโคจร</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("roster")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === "roster"
                    ? "bg-brand text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>การ์ดผู้สมัคร {shops.length} ร้าน</span>
              </button>
            </div>

            {/* S2 Radar Scan Assembly Button */}
            <button
              type="button"
              onClick={handleTriggerSwarmAssembly}
              disabled={isAssembling}
              className="px-4 py-2 bg-gradient-to-r from-brand via-purple-500 to-teal-400 hover:opacity-95 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-glow-primary hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Sparkles className={`w-4 h-4 ${scanPulse ? "animate-spin" : ""}`} />
              <span>เสนอทีมให้ฉัน (Radar Scan)</span>
            </button>

            {/* S6 Chaos Rehearsal Button */}
            <button
              type="button"
              onClick={() => setCurrentPage("simulator")}
              className="px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>ซ้อมแผนพัง (Chaos)</span>
            </button>
          </div>
        </div>

        {/* S3 Project Stuck Spotlight Control Bar */}
        <div className="relative z-10 mt-4 p-3 bg-[#0d1633]/90 backdrop-blur-md rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-attention" />
              <span>จุดติดของโครงการ (S3 Spotlight):</span>
            </span>

            <div className="flex items-center gap-1 bg-[#152042] p-1 rounded-xl text-xs border border-slate-700/60">
              <button
                type="button"
                onClick={() => setStuckFilter("all")}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  stuckFilter === "all"
                    ? "bg-brand text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                ทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => setStuckFilter("capacity")}
                className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  stuckFilter === "capacity"
                    ? "bg-brand text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>กำลังผลิต</span>
                {isDeficit && <span className="w-2 h-2 rounded-full bg-danger animate-ping" />}
              </button>
              <button
                type="button"
                onClick={() => setStuckFilter("funding")}
                className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  stuckFilter === "funding"
                    ? "bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)] font-semibold"
                    : "text-rose-400 hover:text-rose-300"
                }`}
              >
                <span>เงินทุนหมุนเวียน</span>
                {shortageCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-white text-rose-600 rounded-full text-[10px] font-bold">
                    ติด {shortageCount} ร้าน
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setStuckFilter("delivery")}
                className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  stuckFilter === "delivery"
                    ? "bg-brand text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                ส่งมอบ
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>ฉบับแผนงาน: <strong className="text-white font-mono">{proposal.version}</strong></span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400 text-[11px]">
              {proposalMissing.length ? `ข้อมูลโครงการที่ยังขาด ${proposalMissing.length} รายการ` : "เงื่อนไขโครงการบันทึกครบแล้ว"}
            </span>
          </div>
        </div>

        {/* Spotlight Emergency Alert Strip if Funding is active */}
        {stuckFilter === "funding" && (
          <div className="relative z-10 mt-3 p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-rose-200 flex flex-wrap items-center justify-between gap-3 shadow-[0_0_30px_rgba(244,63,94,0.15)] animate-fade-in">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>ตรวจพบจุดติด: ขาดเงินทุน {shortageCount} ร้าน (รวม ฿{amount(proposal.totalFundingGap)})</span>
                  <span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-mono">
                    เฉพาะออเดอร์นี้
                  </span>
                </div>
                <p className="text-[11px] text-rose-300/90 mt-0.5">
                  <strong>{shortageCount} ร้านต้องเติมทุน</strong> {proposal.stuckReasons.map((reason) => reason.message).join(" · ")} · <strong>ขาดกำลังผลิต {proposal.deficitBoxesPerDay} ต่อวัน</strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage("funding")}
              className="px-4 py-2 bg-gradient-to-r from-rose-500 to-amber-500 hover:opacity-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>แก้ตรงนี้: จัดอันดับแหล่งทุนตามส่วนที่ขาด</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main 3-Column Studio Grid Layout */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5 items-start">
          {/* Column 1: Order Specifications (ซ้าย - 3 Cols) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="p-5 rounded-2xl bg-[#0E1838]/90 border border-slate-700/60 backdrop-blur-md shadow-xl space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-brand-glow uppercase tracking-wider">
                  คำสั่งซื้อต้นทาง (B2B Demand)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-brand/20 border border-brand/40 text-[10px] text-brand-glow font-bold">
                  B2B
                </span>
              </div>

              <h2 className="text-base font-display font-bold text-white leading-snug">
                {order.title}
              </h2>

              <div className="space-y-2.5 text-xs border-t border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">ผู้ว่าจ้าง:</span>
                  <span className="font-semibold text-white flex items-center gap-1 text-right">
                    <Building2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span>{order.buyerName}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">ความต้องการ:</span>
                  <span className="font-bold text-teal-300 font-mono text-sm">
                    {order.quantityPerDay} กล่อง/วัน
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">ระยะเวลา:</span>
                  <span className="font-medium text-white font-mono">{order.days} วัน (รวม {amount(order.quantityPerDay * order.days)} กล่อง)</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">ราคาเสนอซื้อ:</span>
                  <span className="font-bold text-white font-mono">฿{order.unitPrice} / กล่อง</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">งบประมาณรวม:</span>
                  <span className="font-extrabold text-teal-300 font-mono text-base">
                    ฿{order.budgetTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3 space-y-2 text-[11px] text-slate-300">
                <div className="flex items-start gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{order.targetDeliveryDate}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{order.deliveryLocation}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{order.paymentTerms}</span>
                </div>
              </div>
            </div>

            {/* Logistics Node Card */}
            <div className="p-4 rounded-2xl bg-[#0E1838]/90 border border-teal-500/30 backdrop-blur-md shadow-xl text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-base">
                    🚚
                  </div>
                  <div>
                    <span className="font-bold text-white">รถขนส่งควบคุมความเย็นรวม</span>
                    <div className="text-[11px] text-slate-400">{blockedResources.length ? `ยังไม่พร้อม: ${blockedResources.join(" · ")}` : "ยังไม่ยืนยันการจองรถ"}</div>
                  </div>
                </div>
                <span className="text-teal-400 font-bold font-mono text-[11px] bg-teal-950/80 px-2 py-0.5 rounded-full border border-teal-800">
                  {proposal.shops.length} ร้านรับงาน
                </span>
              </div>
              <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-2 flex items-center justify-between">
                <span>งวดรับเงิน: <strong>{collectionText}</strong></span>
                <span>พิกัดผู้ซื้อ: <strong>{constraints?.buyer_coordinates ? "บันทึกแล้ว" : "ยังไม่ได้บันทึก"}</strong></span>
              </div>
            </div>
          </div>

          {/* Column 2: Swarm Orbit Studio & Radar Cockpit (กลาง - 6 Cols) */}
          <div className="lg:col-span-6 space-y-4">
            {viewMode === "cockpit" ? (
              /* Orbital Radar Cockpit View */
              <div className="relative rounded-2xl bg-[#09122C]/95 border border-slate-700/70 p-5 shadow-2xl min-h-[580px] flex flex-col justify-between overflow-hidden">
                {/* Radar Grid Overlay */}
                <div className="absolute inset-0 pointer-events-none opacity-20">
                  <div className="w-full h-full bg-[radial-gradient(#6C4CF1_1px,transparent_1px)] [background-size:24px_24px]" />
                </div>

                {/* Radar Beam Sweep (S2 Animation) */}
                <div
                  className={`absolute inset-0 pointer-events-none flex items-center justify-center z-10 transition-opacity duration-500 ${
                    scanPulse ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <div className="w-[480px] h-[480px] rounded-full border border-teal-400/40 relative animate-radar-sweep">
                    <div className="w-1/2 h-1/2 absolute top-0 right-0 bg-gradient-to-br from-teal-400/30 via-brand/10 to-transparent rounded-tr-full" />
                  </div>
                </div>

                {/* Header in Cockpit */}
                <div className="relative z-20 flex items-center justify-between text-xs pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-teal-400 animate-pulse" />
                    <span className="font-bold text-white">
                      วงโคจรจัดสรรโควตา (Orbit Radar Hub)
                    </span>
                  </div>
                  <span className="text-slate-400 text-[11px] font-mono">
                    ยังไม่มีพิกัดผู้ว่าจ้างและเกณฑ์ระยะทาง
                  </span>
                </div>

                {/* SVG Visual Orbit Stage */}
                <div className="relative z-20 w-full h-[380px] my-auto flex items-center justify-center">
                  {/* Concentric Radar Distance Rings */}
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* Range Rings */}
                    <circle cx="50" cy="50" r="16" fill="none" stroke="rgba(108, 76, 241, 0.25)" strokeWidth="0.3" strokeDasharray="1,1" />
                    <circle cx="50" cy="50" r="28" fill="none" stroke="rgba(108, 76, 241, 0.2)" strokeWidth="0.3" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(22, 193, 176, 0.2)" strokeWidth="0.3" strokeDasharray="2,2" />

                    {/* Crosshair Axes */}
                    <line x1="50" y1="6" x2="50" y2="94" stroke="rgba(148, 163, 184, 0.12)" strokeWidth="0.3" />
                    <line x1="6" y1="50" x2="94" y2="50" stroke="rgba(148, 163, 184, 0.12)" strokeWidth="0.3" />

                    {/* Laser Link Paths from Center to Each Node */}
                    {shops.map((shop, idx) => {
                      const pos = nodePositions[idx] || { x: 50, y: 50 };
                      const isStuck = stuckFilter === "funding" && shop.fundingGap > 0;
                      const strokeColor = isStuck
                        ? "#F43F5E"
                        : idx % 2 === 0
                        ? "#16C1B0"
                        : "#9B82FF";

                      return (
                        <line
                          key={`link-${shop.id}`}
                          x1="50"
                          y1="50"
                          x2={pos.x}
                          y2={pos.y}
                          stroke={strokeColor}
                          strokeWidth="0.6"
                          strokeDasharray="2,2"
                          className="animate-laser-flow"
                          opacity={stuckFilter === "funding" && !isStuck ? 0.2 : 0.85}
                        />
                      );
                    })}
                  </svg>

                  {/* Central Demand Hub */}
                  <div className="absolute z-30 flex flex-col items-center justify-center text-center cursor-pointer group">
                    <div className="relative">
                      {/* Pulsing Beacon Ring */}
                      <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-brand to-teal-400 opacity-40 blur-md group-hover:opacity-75 transition-opacity animate-pulse" />
                      <div className="w-20 h-20 rounded-full bg-[#101C3E] border-2 border-teal-400/80 flex flex-col items-center justify-center p-1.5 shadow-2xl relative z-10">
                        <span className="text-[10px] text-teal-300 font-bold leading-none">ORDER</span>
                        <span className="font-mono font-extrabold text-white text-sm leading-tight">{order.quantityPerDay}</span>
                        <span className="text-[9px] text-slate-300 leading-none">กล่อง/วัน</span>
                      </div>
                    </div>
                    <span className="mt-1.5 px-2 py-0.5 rounded-full bg-teal-950/80 border border-teal-600/80 text-[10px] text-teal-300 font-bold">
                      {order.buyerName}
                    </span>
                  </div>

                  {/* 6 Orbiting Member Nodes */}
                  {shops.map((shop, idx) => {
                    const pos = nodePositions[idx] || { x: 50, y: 50 };
                    const isStuck = stuckFilter === "funding" && shop.fundingGap > 0;
                    const isDimmed = stuckFilter === "funding" && shop.fundingGap === 0;
                    const isSelected = activeOrbitShopId === shop.id;

                    return (
                      <div
                        key={`node-${shop.id}`}
                        onClick={() => {
                          setActiveOrbitShopId(shop.id);
                          setSelectedShopId(shop.id);
                        }}
                        style={{
                          left: `${pos.x}%`,
                          top: `${pos.y}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                        className={`absolute z-30 transition-all duration-300 cursor-pointer ${
                          isDimmed ? "opacity-30 filter grayscale" : "opacity-100"
                        }`}
                      >
                        <div
                          className={`relative rounded-xl p-2 flex items-center gap-2 backdrop-blur-md transition-transform hover:scale-110 ${
                            isStuck
                              ? "bg-rose-950/90 border-2 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)] animate-pulse"
                              : isSelected
                              ? "bg-[#1C2B5B] border-2 border-brand-glow shadow-glow-primary scale-105"
                              : "bg-[#101B3B]/90 border border-slate-700/80 hover:border-teal-400"
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                              isStuck
                                ? "bg-rose-500 text-white"
                                : "bg-brand/30 text-teal-300 border border-teal-500/30"
                            }`}
                          >
                            {shop.monogram}
                          </div>
                          <div className="text-left hidden sm:block">
                            <div className="font-semibold text-xs text-white leading-tight max-w-[100px] truncate">
                              {shop.name}
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="text-teal-400 font-mono font-bold">{proposal.shops.find((item) => item.shopId === shop.id)?.shareBoxesPerDay ?? 0} กล่อง</span>
                              {isStuck && (
                                <span className="text-rose-400 font-bold font-mono">
                                  ขาด ฿{(shop.fundingGap / 1000).toFixed(1)}k
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Quick Shop Carousel in Cockpit */}
                <div className="relative z-20 pt-3 border-t border-slate-800">
                  <div className="text-[11px] text-slate-400 mb-2 flex items-center justify-between">
                    <span>คลิกเพื่อดูรายละเอียดร้านค้าในทีม:</span>
                    <button
                      type="button"
                      onClick={() => setViewMode("roster")}
                      className="text-teal-300 hover:text-white flex items-center gap-0.5 text-xs font-semibold"
                    >
                      <span>ดูการ์ดทั้ง {shops.length} ร้าน</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {shops.map((shop) => {
                      const isStuck = stuckFilter === "funding" && shop.fundingGap > 0;
                      const isSelected = activeOrbitShopId === shop.id;

                      return (
                        <button
                          key={`chip-${shop.id}`}
                          type="button"
                          onClick={() => {
                            setActiveOrbitShopId(shop.id);
                            setSelectedShopId(shop.id);
                          }}
                          className={`p-2 rounded-xl text-left transition-all ${
                            isStuck
                              ? "bg-rose-950/80 border border-rose-500/80 text-rose-200"
                              : isSelected
                              ? "bg-brand/30 border border-brand-glow text-white"
                              : "bg-[#101B3B] hover:bg-[#15234A] border border-slate-700/60 text-slate-300"
                          }`}
                        >
                          <div className="font-bold text-xs truncate">{shop.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {isStuck ? (
                              <span className="text-rose-400 font-bold">ขาด ฿{shop.fundingGap.toLocaleString()}</span>
                            ) : (
                              <span>{proposal.shops.find((item) => item.shopId === shop.id)?.shareBoxesPerDay ?? 0} กล่อง/วัน</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* Expanded Cards Grid View */
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-teal-400" />
                    <span>รับงาน {proposal.shops.length} ร้าน จากผู้สมัคร {shops.length} ร้าน</span>
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    {distanceText}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {shops.map((shop) => {
                    const isStuck = stuckFilter === "funding" && shop.fundingGap > 0;
                    const isDimmed = stuckFilter === "funding" && shop.fundingGap === 0;

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
                          variant="dark"
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
              </div>
            )}
          </div>

          {/* Column 3: Totals & Financial Settlement Cockpit (ขวา - 3 Cols) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="p-5 rounded-2xl bg-[#0E1838]/90 border border-slate-700/60 backdrop-blur-md shadow-xl space-y-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                สรุปยอดรวมทั้งทีม (Swarm Tally)
              </span>

              {/* Capacity Progress Meter */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-400">กำลังผลิตรวม</span>
                  <span className="font-bold font-mono text-white">
                    {proposal.totalCapacityAssigned} / {order.quantityPerDay} กล่อง/วัน
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-teal-400 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-glow-resource"
                    style={{
                      width: `${(proposal.totalCapacityAssigned / order.quantityPerDay) * 100}%`,
                    }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>จัดสรร {amount(proposal.totalCapacityAssigned)} กล่อง</span>
                  </span>
                  <span className="text-slate-400 font-mono">ยังขาด {amount(proposal.deficitBoxesPerDay)} กล่อง/วัน</span>
                </div>
              </div>

              {/* Financial Settlement Breakdown */}
              <div className="space-y-2.5 border-t border-slate-800 pt-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">รายรับรวม ({proposal.shops.length} ร้าน):</span>
                  <span className="font-bold font-mono text-white">
                    ฿{proposal.totalRevenue.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">ต้นทุนรวม ({proposal.shops.length} ร้าน):</span>
                  <span className="font-medium font-mono text-slate-300">
                    ฿{proposal.totalCost.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-dashed border-slate-800 pt-2.5">
                  <span className="font-bold text-teal-300">กำไรออเดอร์ก่อนค่าใช้จ่ายอื่น:</span>
                  <span className="font-extrabold font-mono text-teal-300 text-sm">
                    ฿{proposal.totalProfit.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Funding Gap Card */}
              <div className="p-3.5 bg-rose-950/60 rounded-xl border border-rose-500/40 space-y-2 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-300">ทุนที่ยังขาดรวม:</span>
                  <span className="text-sm font-extrabold text-rose-400 font-mono tabular-nums">
                    ฿{proposal.totalFundingGap.toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] text-rose-300/80 leading-relaxed">
                  ร้านที่รับงานขาดทุนหมุนเวียน {shortageCount} ร้าน · ข้อเสนอคำนวณเฉพาะออเดอร์ ยังไม่รวมภาระอื่นของกิจการ
                </p>
                <button
                  type="button"
                  onClick={() => setCurrentPage("funding")}
                  className="w-full py-2 bg-gradient-to-r from-rose-500 to-amber-500 hover:opacity-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>จับคู่ทุนเฉพาะส่วนที่ขาด</span>
                </button>
              </div>

              {/* Team Readiness Status */}
              <div className="pt-2 border-t border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">สถานะความพร้อม:</span>
                  <span className="font-bold text-amber-300 bg-amber-950/70 px-2 py-0.5 rounded-full border border-amber-800/80">
                    {proposalMissing.length
                      ? `ยังรับรองความเหมาะสมไม่ได้ (ขาด ${proposalMissing.length} เงื่อนไข)`
                      : proposal.status === "ready"
                      ? "ผ่านเกณฑ์ตัวเลขของ engine"
                      : proposal.status}{" "}
                    · ต้องเติมทุน {shortageCount} ร้าน
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => { const id = proposal.shops[0]?.shopId; if (id) { setSelectedShopId(id); setCurrentPage("shop-finance", { shopId: id }); } }}
                  className="w-full py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-glow-primary cursor-pointer"
                >
                  <span>ดูข้อมูลการเงินรายร้านที่บันทึกไว้</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Shop Swap Modal (Part B Rule #5: เปลี่ยนคู่ค้าต้องผ่านขั้นตรวจยืนยัน) */}
        {swappingShopId && (
          <div
            className="fixed inset-0 z-50 bg-[#050B1E]/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setSwappingShopId(null)}
          >
            <div
              className="w-full max-w-md bg-[#101B3B] rounded-2xl shadow-2xl border border-slate-700 p-6 space-y-4 text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                <h3 className="font-display font-bold text-white text-base">
                  เลือกสลับร้านค้าในทีม
                </h3>
                <button
                  type="button"
                  onClick={() => setSwappingShopId(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                ผู้สมัครสำรองจากข้อมูลจริง ต้องคำนวณการจัดสรรใหม่ก่อนรับงาน:
              </p>

              <div className="p-4 rounded-xl border border-teal-500/40 bg-teal-950/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-white">{replacement?.name || "ไม่มีร้านสำรองที่ผ่านเงื่อนไขที่ทราบ"}</div>
                  <span className="text-[10px] text-teal-300 bg-teal-950 px-2 py-0.5 rounded-full border border-teal-800 font-bold">
                    {replacement ? "รอคำนวณ" : "ไม่มีผู้สมัคร"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {replacement ? `กำลังผลิตว่าง ${replacement.capacityAvailable} · ต้นทุน ฿${replacement.costPerUnit} · เงินสด ฿${amount(replacement.currentCash)}` : "กรุณาเพิ่มข้อมูลร้านที่มีคุณสมบัติเหมาะสมก่อน"}
                </div>
                <button
                  type="button"
                  onClick={() => handleConfirmSwap(swappingShopId)}
                  disabled={!replacement || isAssembling}
                  className="w-full py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-xs font-bold rounded-xl hover:opacity-95 transition-all mt-2 shadow-lg cursor-pointer"
                >
                  คำนวณทีมหลังสลับร้าน
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StateRenderer>
  );
};
