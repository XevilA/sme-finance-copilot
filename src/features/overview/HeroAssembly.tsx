import React, { useCallback, useState } from "react";
import { NavPage, useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { SwarmOrder, SwarmProposal, UnlockResource } from "@/api/contracts/types";
import { useEnvelope } from "@/hooks/useEnvelope";
import { useT } from "@/i18n";
import { storedProposal } from "@/api/dataAvailability";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import {
  Users,
  Store,
  ChefHat,
  Truck,
  Coins,
  ArrowRight,
  ChevronDown,
  AlertTriangle,
  Play,
  RotateCcw,
} from "lucide-react";

export const HeroAssembly: React.FC = () => {
  const { setCurrentPage, isReducedMotion, setStoryModeOpen } = useAppStore();
  const t = useT();
  const [activeScenario, setActiveScenario] = useState<"normal" | "capacity_jam" | "funding_gap">("normal");

  // The diagram labels the stored active order and the stored proposal for it.
  // Nothing here is a fixed demo figure, and anything the backend has not
  // recorded reads as unknown rather than as a number.
  const orderState = useEnvelope<SwarmOrder>(useCallback(() => apiClient.getOrder(), []));
  const proposalState = useEnvelope<SwarmProposal>(useCallback(() => apiClient.getSwarmProposal(), []));
  const resourceState = useEnvelope<UnlockResource[]>(useCallback(() => apiClient.getUnlockResources(), []));
  const order = orderState.envelope?.data || null;
  // ไม่มี database -> backend ส่ง proposal เปล่า (ค่า 0 ทั้งหมด) มา ถือว่าไม่มีข้อมูล
  const proposal = storedProposal(proposalState.envelope);
  const resources = resourceState.envelope?.data || [];
  const amount = (value: number | null | undefined) =>
    value == null ? t("common.noData") : `฿${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const leadShop = proposal?.shops[0] || null;
  const truck = resources.find((item) => item.category === "truck") || null;
  const sharedTruckShops = truck
    ? new Set(resources.filter((item) => item.category === "truck").map((item) => item.ownerShop)).size
    : 0;
  const hasDeficit = (proposal?.deficitBoxesPerDay ?? 0) > 0;
  const hasGap = (proposal?.totalFundingGap ?? 0) > 0;

  const kitchenTitle = resources.find((item) => item.category === "kitchen")?.title || t("hero.kitchen");
  const truckText = !truck
    ? t("common.noData")
    : truck.status === "confirmed"
    ? t("hero.truckConfirmed", { n: sharedTruckShops })
    : t("hero.truckProposed");
  // ข้อความเดียวกับ diagram ใหญ่ แค่จัดเรียงใหม่สำหรับจอมือถือ
  const mobileFlow: FlowNode[] = [
    { key: "buyer", label: order?.buyerName || t("hero.buyer"), value: order ? t("hero.perDay", { n: order.quantityPerDay }) : t("hero.noOrder"),
      known: Boolean(order), accent: "#60A5FA", target: "swarm", targetLabel: t("hero.openOrder"),
      explain: t("hero.explainBuyer"),
      icon: <Users className="w-4 h-4" />, iconClass: "bg-blue-500/20 text-blue-400", valueClass: "text-white", alert: false, note: "" },
    { key: "shops", label: proposal ? t("hero.shopsN", { n: proposal.shops.length }) : t("hero.mainShop"),
      known: Boolean(leadShop), accent: "#9B82FF", target: "swarm", targetLabel: t("hero.openTeam"),
      explain: t("hero.explainShops"),
      value: leadShop ? t("hero.leadShop", { amount: amount(leadShop.workingCapitalNeeded) }) : t("hero.noProposal"),
      sub: leadShop ? t("hero.assignedPerDay", { n: leadShop.shareBoxesPerDay }) : t("hero.notAllocated"),
      icon: <Store className="w-4 h-4" />, iconClass: "bg-brand text-white", valueClass: "text-white font-mono",
      alert: activeScenario !== "normal", note: "" },
    { key: "kitchen", label: kitchenTitle,
      known: Boolean(proposal), accent: "#16C1B0", target: "unlock", targetLabel: t("hero.openResources"),
      explain: t("hero.explainKitchen"),
      value: proposal ? t("hero.allocated", { a: proposal.totalCapacityAssigned, b: proposal.targetCapacity }) : t("common.noData"),
      icon: <ChefHat className="w-4 h-4" />, iconClass: "bg-resource/20 text-resource", valueClass: "text-resource",
      alert: activeScenario === "capacity_jam",
      note: activeScenario === "capacity_jam" ? (!proposal ? t("hero.noProposalCheck") : hasDeficit ? t("hero.shortPerDay", { n: proposal.deficitBoxesPerDay }) : t("hero.noCapacityShort")) : "" },
    { key: "truck", label: truck?.title || t("hero.truck"), value: truckText,
      known: Boolean(truck), accent: "#16C1B0", target: "unlock", targetLabel: t("hero.openResources"),
      explain: t("hero.explainTruck"),
      icon: <Truck className="w-4 h-4" />, iconClass: "bg-resource/20 text-resource", valueClass: "text-resource", alert: false, note: "" },
    { key: "funding", label: t("hero.capital"), value: proposal ? amount(proposal.totalFundingGap) : t("common.noData"),
      known: Boolean(proposal), accent: "#F59A23", target: "funding", targetLabel: t("hero.findFunding"),
      explain: t("hero.explainCapital"),
      icon: <Coins className="w-4 h-4" />, iconClass: "bg-amber-500/20 text-amber-400", valueClass: "text-brand-glow",
      alert: activeScenario === "funding_gap",
      note: activeScenario === "funding_gap" ? (!proposal ? t("hero.noProposalCheck") : hasGap ? t("hero.shortfall", { amount: amount(proposal.totalFundingGap) }) : t("hero.noGap")) : "" },
  ];

  const nodes = Object.fromEntries(mobileFlow.map((node) => [node.key, node])) as Record<string, FlowNode>;

  return (
    <div className="relative bg-navy-deep text-white rounded-card p-4 sm:p-6 md:p-8 overflow-hidden shadow-soft-lg mb-8 border border-navy-border">
      {/* Background Soft Aurora Canvas / Gradient */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-brand/30 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-resource/30 blur-3xl" />
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Headline, Description & CTAs */}
        <div className="lg:col-span-5 space-y-4 text-left">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-white leading-tight">
            {t("hero.headline1")} <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-glow via-white to-resource">
              {t("hero.headline2")}
            </span>
          </h1>

          <p className="text-xs md:text-sm text-slate-300 leading-relaxed max-w-md">
            {t("hero.intro")}
          </p>

          {/* Primary CTA Buttons (Part B Rule #9: กดได้ทันทีเสมอ ไม่ต้องรอ animation) */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCurrentPage("swarm")}
              className="px-5 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-btn text-xs md:text-sm font-bold flex items-center gap-2 shadow-glow-primary transition-all cursor-pointer"
            >
              <span>{order ? t("hero.viewTeam", { id: order.id }) : t("hero.openSwarm")}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage("import")}
              className="px-4 py-2.5 bg-navy-surface hover:bg-navy-card border border-navy-border text-slate-200 rounded-btn text-xs md:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              <span>{t("hero.startData")}</span>
            </button>
          </div>

          {/* 2 Interactive Problem Scenarios (Signature S1) */}
          <div className="pt-3 border-t border-navy-border/60">
            <span className="text-[11px] font-bold text-slate-400 block mb-2 uppercase tracking-wider">
              {t("hero.clickHighlight")}
            </span>
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveScenario("capacity_jam")}
                className={`press w-full sm:w-auto text-left px-3 py-2 sm:py-1.5 rounded-chip text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeScenario === "capacity_jam"
                    ? "bg-attention/20 border-attention text-attention shadow-sm"
                    : "bg-navy-surface border-navy-border text-slate-300 hover:text-white"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{t("hero.scenarioCapacity")}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveScenario("funding_gap")}
                className={`press w-full sm:w-auto text-left px-3 py-2 sm:py-1.5 rounded-chip text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeScenario === "funding_gap"
                    ? "bg-brand/20 border-brand-glow text-brand-glow shadow-sm"
                    : "bg-navy-surface border-navy-border text-slate-300 hover:text-white"
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>{t("hero.scenarioCash")}</span>
              </button>

              {activeScenario !== "normal" && (
                <button
                  type="button"
                  onClick={() => setActiveScenario("normal")}
                  className="self-start px-2.5 py-1.5 text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  title={t("hero.resetTitle")}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{t("hero.reset")}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* มือถือ: จอแคบเกินกว่าจะวาง diagram แบบเดิม เลยเรียงเป็น flow แนวตั้งแทน */}
        <MobileFlow nodes={mobileFlow} animate={!isReducedMotion} onOpen={setCurrentPage} />

        {/* แท็บเล็ต/คอม: diagram แบบ grid (ของเดิมใช้ตำแหน่ง absolute ทำให้การ์ดทับกัน) */}
        <div className="lg:col-span-7 hidden sm:block" aria-label={t("hero.diagramLabel")}>
          <div className="grid grid-cols-[minmax(0,1fr)_28px_minmax(0,1.15fr)_28px_minmax(0,1fr)_28px_minmax(0,1fr)] items-center">
            <FlowCard node={nodes.buyer} />
            <FlowLink active={!isReducedMotion} />
            <FlowCard node={nodes.shops} big />
            <div className="flex flex-col justify-around self-stretch py-6">
              <FlowLink active={!isReducedMotion} tone={activeScenario === "capacity_jam" ? "bottleneck" : "resource"} />
              <FlowLink active={!isReducedMotion} tone="resource" />
            </div>
            <div className="flex flex-col gap-3">
              <FlowCard node={nodes.kitchen} />
              <FlowCard node={nodes.truck} />
            </div>
            <FlowLink active={!isReducedMotion} tone={activeScenario === "funding_gap" ? "bottleneck" : "normal"} reverse />
            <FlowCard node={nodes.funding} />
          </div>
        </div>
      </div>
    </div>
  );
};

type FlowNode = {
  key: string;
  known: boolean;
  accent: string;
  explain: string;
  target: NavPage;
  targetLabel: string;
  label: string;
  value: string;
  sub?: string;
  note: string;
  alert: boolean;
  icon: React.ReactNode;
  iconClass: string;
  valueClass: string;
};

// การ์ด 1 ช่องใน diagram (row = แบบแนวนอนสำหรับมือถือ)
const FlowCard: React.FC<{ node: FlowNode; row?: boolean; big?: boolean }> = ({ node, row, big }) => (
  <div className={`rounded-xl border transition-all duration-300 ${
    node.alert ? "bg-amber-950/40 border-attention ring-2 ring-attention/70" : big ? "bg-navy-surface border-brand ring-2 ring-brand/40 shadow-glow-primary" : "bg-navy-surface border-navy-border"
  } ${row ? "flex items-center gap-3 p-3" : "p-3 text-center"}`}>
    <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${node.iconClass} ${row ? "" : "mx-auto mb-1.5"}`}>{node.icon}</div>
    <div className="min-w-0 flex-1">
      <div className="text-[10px] sm:text-[11px] text-slate-400 leading-tight break-words">{node.label}</div>
      <div className={`text-xs sm:text-sm font-bold leading-snug break-words ${node.valueClass}`}>{node.value}</div>
      {node.sub && <div className="text-[10px] text-slate-400 mt-0.5">{node.sub}</div>}
      {node.note && <div className="text-[10px] font-semibold text-attention mt-0.5 leading-tight">{node.note}</div>}
    </div>
  </div>
);

// เส้นเชื่อมระหว่างการ์ด มีจุดวิ่ง (ปิดเมื่อเปิดลดการเคลื่อนไหว)
const FlowLink: React.FC<{ active: boolean; tone?: "normal" | "resource" | "bottleneck"; reverse?: boolean }> = ({ active, tone = "normal", reverse }) => (
  <div aria-hidden="true" className={`flow-link flow-link-${tone} ${active ? "is-active" : ""} ${reverse ? "is-reverse" : ""}`} />
);

// มือถือ: timeline แนวตั้ง มีรางด้านซ้าย + จุดแสงวิ่งลง แตะการ์ดเพื่อดูคำอธิบาย
const MobileFlow: React.FC<{ nodes: FlowNode[]; animate: boolean; onOpen: (page: NavPage) => void }> = ({ nodes, animate, onOpen }) => {
  const [open, setOpen] = useState<string | null>(null);
  const t = useT();
  const knownCount = nodes.filter((n) => n.known).length;

  return (
    <div className="sm:hidden space-y-3">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-bold uppercase tracking-wider text-slate-400">{t("hero.howTitle")}</span>
        <span className="rounded-chip border border-navy-border bg-navy-surface px-2 py-0.5 text-slate-300">
          {t("hero.withData", { a: knownCount, b: nodes.length })}
        </span>
      </div>

      <ol className="relative pl-9" aria-label={t("hero.flowLabel")}>
        {/* ราง + จุดแสง */}
        <span aria-hidden="true" className="absolute left-[13px] top-4 bottom-4 w-0.5 rounded-full bg-gradient-to-b from-blue-400/60 via-brand/60 to-amber-400/60" />
        {animate && <span aria-hidden="true" className="rail-dot absolute left-[10px] top-4 h-2 w-2 rounded-full bg-white" />}

        {nodes.map((node, index) => {
          const expanded = open === node.key;
          return (
            <li key={node.key} className="relative mb-2.5 last:mb-0 animate-rise" style={{ animationDelay: `${index * 70}ms` }}>
              {/* เลขขั้นบนราง */}
              <span aria-hidden="true"
                className={`absolute -left-9 top-3 flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-all duration-300 ${
                  node.alert ? "border-attention bg-attention text-navy-deep scale-110 shadow-[0_0_12px_rgba(245,154,35,0.7)]"
                  : node.known ? "border-transparent text-navy-deep" : "border-navy-border bg-navy-deep text-slate-400"}`}
                style={node.known && !node.alert ? { background: node.accent } : undefined}>
                {index + 1}
              </span>

              <div
                className={`rounded-2xl border transition-all duration-300 ${
                  node.alert ? "bg-amber-950/40 border-attention ring-2 ring-attention/60"
                  : expanded ? "bg-navy-card border-brand/60" : "bg-navy-surface/90 border-navy-border"}`}
                style={{ boxShadow: `inset 3px 0 0 ${node.accent}` }}>
                <button type="button" aria-expanded={expanded} aria-controls={`flow-${node.key}`}
                  onClick={() => setOpen(expanded ? null : node.key)}
                  className="press w-full text-left rounded-2xl p-3 flex items-center gap-3">
                  <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${node.iconClass}`}>{node.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-slate-400 leading-tight line-clamp-2">{node.label}</div>
                    {node.known ? (
                      <div className={`text-sm font-bold leading-snug ${node.valueClass}`}>{node.value}</div>
                    ) : (
                      <span className="mt-0.5 inline-block rounded-chip border border-dashed border-slate-500/70 px-2 py-0.5 text-[11px] font-semibold text-slate-400">
                        {t("hero.noDataYet")}
                      </span>
                    )}
                    {node.sub && node.known && <div className="text-[10px] text-slate-400 mt-0.5">{node.sub}</div>}
                    {node.note && <div className="text-[11px] font-semibold text-attention mt-1 leading-tight">{node.note}</div>}
                  </div>
                  <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
                </button>

                {/* ส่วนที่ขยายเมื่อแตะ (ใช้ grid-rows ให้ความสูงเลื่อนได้นุ่ม ๆ) */}
                <div id={`flow-${node.key}`} className={`grid transition-[grid-template-rows] duration-300 ease-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="overflow-hidden">
                    <div className="mx-3 mb-3 border-t border-navy-border pt-2">
                      <p className="text-[11px] leading-relaxed text-slate-300">{node.explain}</p>
                      <button type="button" tabIndex={expanded ? 0 : -1} onClick={() => onOpen(node.target)}
                        className="press mt-2 inline-flex items-center gap-1 rounded-btn bg-brand px-3 py-1.5 text-[11px] font-bold text-white">
                        {node.targetLabel} <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
