import React, { useCallback } from "react";
import { useAppStore, NavPage } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { Shop, SwarmOrder, SwarmProposal } from "@/api/contracts/types";
import { useEnvelope } from "@/hooks/useEnvelope";
import {
  LayoutDashboard,
  UploadCloud,
  TrendingUp,
  HeartPulse,
  PieChart,
  ShoppingBag,
  Coins,
  Network,
  Users,
  Wrench,
  Building,
  Sliders,
  FileCheck2,
  Sparkles,
} from "lucide-react";

type NavItem = {
  id: NavPage;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  group: "Business Analysis" | "Build Opportunities & Teams" | "Sandbox & Reports";
};

const navItems: NavItem[] = [
  // Group 1: Business Diagnostics
  {
    id: "overview",
    label: "1. Business Overview",
    icon: <LayoutDashboard className="w-4 h-4" />,
    group: "Business Analysis",
  },
  {
    id: "import",
    label: "2. Business Data & Import",
    icon: <UploadCloud className="w-4 h-4" />,
    group: "Business Analysis",
  },
  {
    id: "cashflow",
    label: "3. Cash & Cash Flow",
    icon: <TrendingUp className="w-4 h-4" />,
    badge: "Time Travel",
    badgeColor: "bg-brand/10 text-brand",
    group: "Business Analysis",
  },
  {
    id: "health",
    label: "4. Financial Health",
    icon: <HeartPulse className="w-4 h-4" />,
    group: "Business Analysis",
  },
  {
    id: "cost",
    label: "5. Costs & Profitability",
    icon: <PieChart className="w-4 h-4" />,
    group: "Business Analysis",
  },
  {
    id: "sales",
    label: "6. Sales & Products",
    icon: <ShoppingBag className="w-4 h-4" />,
    group: "Business Analysis",
  },

  // Group 2: Opportunity & Swarm Assembly
  {
    id: "funding",
    label: "7. Funding Match",
    icon: <Coins className="w-4 h-4" />,
    badgeColor: "bg-red-50 text-danger border border-red-200",
    group: "Build Opportunities & Teams",
  },
  {
    id: "swarm",
    label: "8. SME SWARM Team Assembly",
    icon: <Network className="w-4 h-4" />,
    badge: "★ Featured",
    badgeColor: "bg-brand text-white shadow-xs",
    group: "Build Opportunities & Teams",
  },
  {
    id: "shop-finance",
    label: "9. Per-SME Cash Plan",
    icon: <Users className="w-4 h-4" />,
    group: "Build Opportunities & Teams",
  },
  {
    id: "unlock",
    label: "10. SME UNLOCK Resources",
    icon: <Wrench className="w-4 h-4" />,
    badge: "Disassemble",
    badgeColor: "bg-resource-light text-resource-dark",
    group: "Build Opportunities & Teams",
  },
  {
    id: "funder",
    label: "11. Funder Portal",
    icon: <Building className="w-4 h-4" />,
    group: "Build Opportunities & Teams",
  },

  // Group 3: Simulation & Reports
  {
    id: "simulator",
    label: "12. Simulation & Chaos Rehearsal",
    icon: <Sliders className="w-4 h-4" />,
    badge: "Chaos",
    badgeColor: "bg-amber-100 text-amber-800",
    group: "Sandbox & Reports",
  },
  {
    id: "projects",
    label: "13. Projects & Reports",
    icon: <FileCheck2 className="w-4 h-4" />,
    group: "Sandbox & Reports",
  },
];

export const AppSidebar: React.FC = () => {
  const { currentPage, setCurrentPage } = useAppStore();

  const groups: ("Business Analysis" | "Build Opportunities & Teams" | "Sandbox & Reports")[] = [
    "Business Analysis",
    "Build Opportunities & Teams",
    "Sandbox & Reports",
  ];

  // Footer and the funding badge describe the stored order, shops and proposal.
  const orderState = useEnvelope<SwarmOrder>(useCallback(() => apiClient.getOrder(), []));
  const shopState = useEnvelope<Shop[]>(useCallback(() => apiClient.getShops(), []));
  const proposalState = useEnvelope<SwarmProposal>(useCallback(() => apiClient.getSwarmProposal(), []));
  const order = orderState.envelope?.data || null;
  const shops = shopState.envelope?.data || [];
  const proposal = proposalState.envelope?.data || null;
  const shortfallShops = proposal ? proposal.shops.filter((shop) => shop.fundingGap > 0).length : 0;
  const fundingBadge = proposal && proposal.totalFundingGap > 0
    ? `Shortfall ฿${proposal.totalFundingGap.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : null;

  return (
    <aside className="w-64 bg-white border-r border-borderLine flex flex-col shrink-0 select-none">
      <div className="flex-1 overflow-y-auto p-3 space-y-5 text-xs">
        {groups.map((group) => {
          const items = navItems.filter((i) => i.group === group);
          return (
            <div key={group}>
              <div className="px-2.5 mb-1.5 text-[10px] font-bold text-ink-muted uppercase tracking-wider">
                {group}
              </div>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const isActive = currentPage === item.id;
                  const badge = item.id === "funding" ? fundingBadge : item.badge;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCurrentPage(item.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-all group ${
                        isActive
                          ? "bg-brand text-white font-medium shadow-sm"
                          : "text-ink hover:bg-slate-100 hover:text-brand"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className={isActive ? "text-white" : "text-ink-muted group-hover:text-brand"}>
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </div>
                      {badge && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-chip shrink-0 ${
                            isActive ? "bg-white/20 text-white" : item.badgeColor
                          }`}
                        >
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sidebar Footer: Scenario Badge */}
      <div className="p-3 border-t border-borderLine bg-slate-50 text-[11px] text-ink-muted">
        <div className="flex items-center gap-1.5 font-semibold text-ink">
          <Sparkles className="w-3.5 h-3.5 text-brand" />
          <span>
            {order ? `Project: ${order.id}` : "No project selected"}
          </span>
        </div>
        <p className="text-[10px] mt-0.5 leading-snug">
          {order
            ? `${shops.length} applicants · Target ${order.quantityPerDay} per day for ${order.days} days`
            : "No saved order"}
          {proposal
            ? ` · Saved proposal: ${proposal.shops.length} shops assigned, ${shortfallShops} with a working-capital shortfall (฿${proposal.totalFundingGap.toLocaleString("en-US", { maximumFractionDigits: 0 })})`
            : " · No saved proposal"}
        </p>
      </div>
    </aside>
  );
};
