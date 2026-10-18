import React, { useCallback, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { SwarmOrder, SwarmProposal, UnlockResource } from "@/api/contracts/types";
import { useEnvelope } from "@/hooks/useEnvelope";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { LinkLine } from "@/components/signature/LinkLine";
import {
  Users,
  Store,
  ChefHat,
  Truck,
  Coins,
  ArrowRight,
  AlertTriangle,
  Play,
  RotateCcw,
} from "lucide-react";

export const HeroAssembly: React.FC = () => {
  const { setCurrentPage, isReducedMotion, setStoryModeOpen } = useAppStore();
  const [activeScenario, setActiveScenario] = useState<"normal" | "capacity_jam" | "funding_gap">("normal");

  // The diagram labels the stored active order and the stored proposal for it.
  // Nothing here is a fixed demo figure, and anything the backend has not
  // recorded reads as unknown rather than as a number.
  const orderState = useEnvelope<SwarmOrder>(useCallback(() => apiClient.getOrder(), []));
  const proposalState = useEnvelope<SwarmProposal>(useCallback(() => apiClient.getSwarmProposal(), []));
  const resourceState = useEnvelope<UnlockResource[]>(useCallback(() => apiClient.getUnlockResources(), []));
  const order = orderState.envelope?.data || null;
  const proposal = proposalState.envelope?.data || null;
  const resources = resourceState.envelope?.data || [];
  const amount = (value: number | null | undefined) =>
    value == null ? "No data" : `฿${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const leadShop = proposal?.shops[0] || null;
  const truck = resources.find((item) => item.category === "truck") || null;
  const sharedTruckShops = truck
    ? new Set(resources.filter((item) => item.category === "truck").map((item) => item.ownerShop)).size
    : 0;
  const hasDeficit = (proposal?.deficitBoxesPerDay ?? 0) > 0;
  const hasGap = (proposal?.totalFundingGap ?? 0) > 0;

  return (
    <div className="relative bg-navy-deep text-white rounded-card p-6 md:p-8 overflow-hidden shadow-soft-lg mb-8 border border-navy-border">
      {/* Background Soft Aurora Canvas / Gradient */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-brand/30 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-resource/30 blur-3xl" />
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Headline, Description & CTAs */}
        <div className="lg:col-span-5 space-y-4 text-left">
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-white leading-tight">
            Understand Your Finances. See the Opportunity. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-glow via-white to-resource">
              Take on Work You Can Deliver
            </span>
          </h1>

          <p className="text-xs md:text-sm text-slate-300 leading-relaxed max-w-md">
            Analyze imported statements, allocate orders across shops, and rank funders by the remaining gap ·
            Figures in this diagram come from orders and proposals saved in the database.
          </p>

          {/* Primary CTA Buttons (Part B Rule #9: กดได้ทันทีเสมอ ไม่ต้องรอ animation) */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCurrentPage("swarm")}
              className="px-5 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-btn text-xs md:text-sm font-bold flex items-center gap-2 shadow-glow-primary transition-all cursor-pointer"
            >
              <span>{order ? `View team assembly for order ${order.id}` : "Open SWARM team assembly"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage("import")}
              className="px-4 py-2.5 bg-navy-surface hover:bg-navy-card border border-navy-border text-slate-200 rounded-btn text-xs md:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              <span>Start with my business data</span>
            </button>
          </div>

          {/* 2 Interactive Problem Scenarios (Signature S1) */}
          <div className="pt-3 border-t border-navy-border/60">
            <span className="text-[11px] font-bold text-slate-400 block mb-2 uppercase tracking-wider">
              Click to highlight bottlenecks in the saved proposal:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveScenario("capacity_jam")}
                className={`px-3 py-1.5 rounded-chip text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeScenario === "capacity_jam"
                    ? "bg-attention/20 border-attention text-attention shadow-sm"
                    : "bg-navy-surface border-navy-border text-slate-300 hover:text-white"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Customer demand exceeds production capacity</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveScenario("funding_gap")}
                className={`px-3 py-1.5 rounded-chip text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeScenario === "funding_gap"
                    ? "bg-brand/20 border-brand-glow text-brand-glow shadow-sm"
                    : "bg-navy-surface border-navy-border text-slate-300 hover:text-white"
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Can fulfill the order, but cash is insufficient</span>
              </button>

              {activeScenario !== "normal" && (
                <button
                  type="button"
                  onClick={() => setActiveScenario("normal")}
                  className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  title="Restore the default view"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Visual Assembly Diagram (Customer → Shop → Kitchen → Truck → Funding) */}
        <div className="lg:col-span-7 relative min-h-[300px] flex items-center justify-center p-2">
          {/* SVG Connecting Bézier Links with Photons */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 540 300">
            {/* Customer to Shop */}
            <LinkLine
              startX={70}
              startY={150}
              endX={190}
              endY={150}
              styleType="normal"
              isActive={!isReducedMotion}
            />
            {/* Shop to Kitchen */}
            <LinkLine
              startX={270}
              startY={120}
              endX={360}
              endY={70}
              styleType={activeScenario === "capacity_jam" ? "bottleneck" : "resource"}
              isActive={!isReducedMotion}
            />
            {/* Shop to Truck */}
            <LinkLine
              startX={270}
              startY={180}
              endX={360}
              endY={230}
              styleType="resource"
              isActive={!isReducedMotion}
            />
            {/* Funding to Shop */}
            <LinkLine
              startX={450}
              startY={150}
              endX={270}
              endY={150}
              styleType={activeScenario === "funding_gap" ? "bottleneck" : "normal"}
              isActive={!isReducedMotion}
            />
          </svg>

          {/* Assembly Nodes */}
          <div className="relative w-full max-w-[520px] h-[280px]">
            {/* 1. Customer Order Node */}
            <div className="absolute left-2 top-[105px] w-28 p-2.5 rounded-xl bg-navy-surface border border-navy-border text-center shadow-soft-md">
              <div className="w-7 h-7 mx-auto rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center mb-1">
                <Users className="w-3.5 h-3.5" />
              </div>
              <div className="text-[10px] text-slate-400 font-medium">{order?.buyerName || "Corporate buyer"}</div>
              <div className="text-xs font-bold text-white">
                {order ? `${order.quantityPerDay} per day` : "No order"}
              </div>
            </div>

            {/* 2. Shop Hub Node (Center) */}
            <div
              className={`absolute left-[170px] top-[95px] w-32 p-3 rounded-2xl border text-center transition-all ${
                activeScenario === "capacity_jam"
                  ? "bg-amber-950/40 border-attention ring-2 ring-attention"
                  : activeScenario === "funding_gap"
                  ? "bg-purple-950/40 border-danger ring-2 ring-danger"
                  : "bg-navy-surface border-brand ring-2 ring-brand/40 shadow-glow-primary"
              }`}
            >
              <div className="w-8 h-8 mx-auto rounded-xl bg-brand text-white flex items-center justify-center mb-1">
                <Store className="w-4 h-4" />
              </div>
              <div className="text-[10px] text-slate-300 font-semibold">
                {proposal ? `${proposal.shops.length} participating shops` : "Main shop"}
              </div>
              <div className="text-xs font-bold text-white font-mono">
                {leadShop ? `${amount(leadShop.workingCapitalNeeded)} / lead shop` : "No proposal"}
              </div>
              <div className="text-[9px] text-slate-400 mt-1">
                {leadShop ? `${leadShop.shareBoxesPerDay} assigned per day` : "Not allocated"}
              </div>
            </div>

            {/* 3. Kitchen Node */}
            <div
              className={`absolute right-[110px] top-[30px] w-28 p-2 rounded-xl border text-center transition-all ${
                activeScenario === "capacity_jam"
                  ? "bg-amber-950/50 border-attention ring-2 ring-attention animate-pulse"
                  : "bg-navy-surface border-navy-border"
              }`}
            >
              <div className="w-6 h-6 mx-auto rounded-lg bg-resource/20 text-resource flex items-center justify-center mb-1">
                <ChefHat className="w-3.5 h-3.5" />
              </div>
              <div className="text-[10px] text-slate-300 font-medium">
                {resources.find((item) => item.category === "kitchen")?.title || "Shared kitchen"}
              </div>
              <div className="text-[11px] font-bold text-resource">
                {proposal ? `${proposal.totalCapacityAssigned} / ${proposal.targetCapacity} allocated` : "No data"}
              </div>
              {activeScenario === "capacity_jam" && (
                <div className="text-[9px] text-attention font-bold mt-0.5">
                  {hasDeficit ? `Short by ${proposal?.deficitBoxesPerDay} per day` : "No capacity shortfall in this proposal"}
                </div>
              )}
            </div>

            {/* 4. Truck Node */}
            <div className="absolute right-[110px] bottom-[25px] w-28 p-2 rounded-xl bg-navy-surface border border-navy-border text-center">
              <div className="w-6 h-6 mx-auto rounded-lg bg-resource/20 text-resource flex items-center justify-center mb-1">
                <Truck className="w-3.5 h-3.5" />
              </div>
              <div className="text-[10px] text-slate-300 font-medium">{truck?.title || "Delivery vehicle"}</div>
              <div className="text-[11px] font-bold text-resource">
                {!truck
                  ? "No data"
                  : truck.status === "confirmed"
                  ? `Confirmed · ${sharedTruckShops} owners`
                  : "Proposed · Not confirmed"}
              </div>
            </div>

            {/* 5. Funding Node */}
            <div
              className={`absolute right-1 top-[110px] w-28 p-2.5 rounded-xl border text-center transition-all ${
                activeScenario === "funding_gap"
                  ? "bg-purple-950/60 border-brand-glow ring-2 ring-brand-glow shadow-glow-primary animate-pulse"
                  : "bg-navy-surface border-navy-border"
              }`}
            >
              <div className="w-7 h-7 mx-auto rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center mb-1">
                <Coins className="w-3.5 h-3.5" />
              </div>
              <div className="text-[10px] text-slate-300 font-medium">Working capital needed</div>
              <div className="text-[11px] font-bold text-brand-glow">
                {proposal ? amount(proposal.totalFundingGap) : "No data"}
              </div>
              {activeScenario === "funding_gap" && (
                <div className="text-[9px] text-danger font-bold mt-0.5">
                  {hasGap ? `Shortfall: ${amount(proposal?.totalFundingGap)}` : "No funding gap in this proposal"}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
