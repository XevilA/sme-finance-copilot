import React, { useCallback } from "react";
import { apiClient } from "@/api/client";
import { SwarmProposal } from "@/api/contracts/types";
import { useEnvelope } from "@/hooks/useEnvelope";
import { useAppStore, NavPage, UserRole } from "@/store/useAppStore";
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
  X,
  PlayCircle,
  Sparkles,
  Shield,
  Eye,
  ChevronRight,
} from "lucide-react";

type NavItem = {
  id: NavPage;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  group: "วิเคราะห์ธุรกิจ" | "ประกอบโอกาส & ทีม" | "แซนด์บ็อกซ์ & รายงาน";
};

const navItems: NavItem[] = [
  // Group 1: Business Diagnostics
  {
    id: "overview",
    label: "1. ภาพรวมธุรกิจ",
    icon: <LayoutDashboard className="w-4 h-4" />,
    group: "วิเคราะห์ธุรกิจ",
  },
  {
    id: "import",
    label: "2. ข้อมูลธุรกิจ & นำเข้าไฟล์",
    icon: <UploadCloud className="w-4 h-4" />,
    group: "วิเคราะห์ธุรกิจ",
  },
  {
    id: "cashflow",
    label: "3. เงินสดและกระแสเงินสด",
    icon: <TrendingUp className="w-4 h-4" />,
    badge: "Time Travel",
    badgeColor: "bg-brand/10 text-brand",
    group: "วิเคราะห์ธุรกิจ",
  },
  {
    id: "health",
    label: "4. สุขภาพการเงิน",
    icon: <HeartPulse className="w-4 h-4" />,
    group: "วิเคราะห์ธุรกิจ",
  },
  {
    id: "cost",
    label: "5. ต้นทุนและความคุ้มค่า",
    icon: <PieChart className="w-4 h-4" />,
    group: "วิเคราะห์ธุรกิจ",
  },
  {
    id: "sales",
    label: "6. ยอดขายและสินค้า",
    icon: <ShoppingBag className="w-4 h-4" />,
    group: "วิเคราะห์ธุรกิจ",
  },

  // Group 2: Opportunity & Swarm Assembly
  {
    id: "funding",
    label: "7. จับคู่แหล่งเงินทุน",
    icon: <Coins className="w-4 h-4" />,
    badgeColor: "bg-red-50 text-danger border border-red-200",
    group: "ประกอบโอกาส & ทีม",
  },
  {
    id: "swarm",
    label: "8. SME SWARM รวมทีม",
    icon: <Network className="w-4 h-4" />,
    badge: "★ เด่นสุด",
    badgeColor: "bg-brand text-white",
    group: "ประกอบโอกาส & ทีม",
  },
  {
    id: "shop-finance",
    label: "9. แผนเงินรายร้านในทีม",
    icon: <Users className="w-4 h-4" />,
    group: "ประกอบโอกาส & ทีม",
  },
  {
    id: "unlock",
    label: "10. SME UNLOCK ทรัพยากร",
    icon: <Wrench className="w-4 h-4" />,
    badge: "ถอดชิ้นส่วน",
    badgeColor: "bg-resource-light text-resource-dark",
    group: "ประกอบโอกาส & ทีม",
  },
  {
    id: "funder",
    label: "11. ฝั่งผู้ให้ทุน (Funder)",
    icon: <Building className="w-4 h-4" />,
    group: "ประกอบโอกาส & ทีม",
  },

  // Group 3: Sandbox & Reports
  {
    id: "simulator",
    label: "12. ห้องจำลอง & ซ้อมแผนพัง",
    icon: <Sliders className="w-4 h-4" />,
    badge: "Chaos",
    badgeColor: "bg-amber-100 text-amber-800",
    group: "แซนด์บ็อกซ์ & รายงาน",
  },
  {
    id: "projects",
    label: "13. โครงการ & รายงาน",
    icon: <FileCheck2 className="w-4 h-4" />,
    group: "แซนด์บ็อกซ์ & รายงาน",
  },
];

export const MobileDrawer: React.FC = () => {
  const {
    currentPage,
    setCurrentPage,
    isMobileMenuOpen,
    setMobileMenuOpen,
    userRole,
    setUserRole,
    setStoryModeOpen,
    setAIPanelOpen,
    isReducedMotion,
    toggleReducedMotion,
  } = useAppStore();

  // The funding badge reports the stored proposal's own gap, not a fixed figure.
  const proposalState = useEnvelope<SwarmProposal>(useCallback(() => apiClient.getSwarmProposal(), []));
  const proposal = proposalState.envelope?.data || null;
  const fundingBadge = proposal && proposal.totalFundingGap > 0
    ? `ขาด ฿${proposal.totalFundingGap.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`
    : null;

  if (!isMobileMenuOpen) return null;

  const groups: Array<NavItem["group"]> = [
    "วิเคราะห์ธุรกิจ",
    "ประกอบโอกาส & ทีม",
    "แซนด์บ็อกซ์ & รายงาน",
  ];

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-navy-deep/60 backdrop-blur-sm transition-opacity"
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-[300px] max-w-[85vw] bg-white h-full shadow-2xl flex flex-col z-10 animate-slide-in">
        {/* Header */}
        <div className="p-4 border-b border-borderLine flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center text-white font-bold text-xs shadow-sm">
              SME
            </div>
            <div>
              <div className="text-xs font-bold text-ink leading-tight">SME Finance Copilot</div>
              <div className="text-[10px] text-ink-muted leading-none">ห้องประกอบโอกาสธุรกิจ</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 text-slate-400 hover:text-ink hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            aria-label="ปิดเมนู"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Selector Pill */}
        <div className="p-3 bg-slate-100/70 border-b border-borderLine">
          <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Shield className="w-3 h-3 text-brand" />
            <span>สวมบทบาท (Role View)</span>
          </div>
          <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
            {(["owner", "buyer", "funder"] as UserRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setUserRole(r)}
                className={`py-1 rounded-lg text-center font-medium capitalize transition-all ${
                  userRole === r
                    ? "bg-brand text-white font-semibold shadow-xs"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {r === "owner" ? "เจ้าของ" : r === "buyer" ? "ผู้ซื้อ" : "ผู้ให้ทุน"}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Navigation List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {groups.map((grp) => {
            const itemsInGroup = navItems.filter((item) => item.group === grp);
            return (
              <div key={grp} className="space-y-1">
                <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block px-2 mb-1">
                  {grp}
                </span>
                <div className="space-y-0.5">
                  {itemsInGroup.map((item) => {
                    const isActive = currentPage === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCurrentPage(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                          isActive
                            ? "bg-brand text-white font-semibold shadow-sm"
                            : "text-ink hover:bg-slate-100/80"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={isActive ? "text-white" : "text-brand"}>
                            {item.icon}
                          </span>
                          <span className="truncate">{item.label}</span>
                        </div>
                        {(item.id === "funding" ? fundingBadge : item.badge) && (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-chip font-bold shrink-0 ${
                              isActive
                                ? "bg-white/20 text-white"
                                : item.badgeColor || "bg-slate-100 text-ink-muted"
                            }`}
                          >
                            {item.id === "funding" ? fundingBadge : item.badge}
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

        {/* Bottom Drawer Actions */}
        <div className="p-3 border-t border-borderLine bg-slate-50/90 space-y-2">
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              setStoryModeOpen(true);
            }}
            className="w-full py-2 bg-gradient-to-r from-navy-deep to-brand text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm"
          >
            <PlayCircle className="w-4 h-4 text-brand-glow" />
            <span>โหมดเล่าโครงการ (Story Mode)</span>
          </button>

          <div className="flex items-center justify-between pt-1 text-[11px] text-ink-muted">
            <span>ลดภาพเคลื่อนไหว</span>
            <button
              type="button"
              onClick={toggleReducedMotion}
              className={`px-2 py-0.5 rounded-full font-bold border transition-colors ${
                isReducedMotion
                  ? "bg-amber-100 text-amber-900 border-amber-300"
                  : "bg-white text-slate-600 border-slate-200"
              }`}
            >
              {isReducedMotion ? "ON" : "OFF"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
