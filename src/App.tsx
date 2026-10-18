import React from "react";
import { useAppStore } from "@/store/useAppStore";
import { AppHeader } from "@/components/ui/AppHeader";
import { AppSidebar } from "@/components/ui/AppSidebar";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { MobileDrawer } from "@/components/ui/MobileDrawer";

// Keep the first download small; Vite fetches each workspace only when opened.
const OverviewPage = React.lazy(() => import("@/features/overview/OverviewPage").then((page) => ({ default: page.OverviewPage })));
const ImportPage = React.lazy(() => import("@/features/import/ImportPage").then((page) => ({ default: page.ImportPage })));
const CashflowPage = React.lazy(() => import("@/features/cashflow/CashflowPage").then((page) => ({ default: page.CashflowPage })));
const HealthPage = React.lazy(() => import("@/features/health/HealthPage").then((page) => ({ default: page.HealthPage })));
const CostPage = React.lazy(() => import("@/features/cost/CostPage").then((page) => ({ default: page.CostPage })));
const SalesPage = React.lazy(() => import("@/features/sales/SalesPage").then((page) => ({ default: page.SalesPage })));
const FundingPage = React.lazy(() => import("@/features/funding/FundingPage").then((page) => ({ default: page.FundingPage })));
const SwarmPage = React.lazy(() => import("@/features/swarm/SwarmPage").then((page) => ({ default: page.SwarmPage })));
const ShopFinancePage = React.lazy(() => import("@/features/shop-finance/ShopFinancePage").then((page) => ({ default: page.ShopFinancePage })));
const UnlockPage = React.lazy(() => import("@/features/unlock/UnlockPage").then((page) => ({ default: page.UnlockPage })));
const FunderPage = React.lazy(() => import("@/features/funder/FunderPage").then((page) => ({ default: page.FunderPage })));
const SimulatorPage = React.lazy(() => import("@/features/simulator/SimulatorPage").then((page) => ({ default: page.SimulatorPage })));
const ProjectsPage = React.lazy(() => import("@/features/projects/ProjectsPage").then((page) => ({ default: page.ProjectsPage })));
const AIPanel = React.lazy(() => import("@/features/ai-panel/AIPanel").then((panel) => ({ default: panel.AIPanel })));
const StoryModeModal = React.lazy(() => import("@/features/reports/StoryModeModal").then((modal) => ({ default: modal.StoryModeModal })));

// Mobile Icons
import {
  LayoutDashboard,
  TrendingUp,
  UploadCloud,
  ShoppingBag,
  Menu,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import type { NavPage } from "@/store/useAppStore";
import { TranslationKey, useT } from "@/i18n";

const mobileTabs: { id: NavPage; label: TranslationKey; icon: React.ReactNode }[] = [
  { id: "overview", label: "tab.overview", icon: <LayoutDashboard className="w-5 h-5 mb-0.5" /> },
  { id: "import", label: "tab.import", icon: <UploadCloud className="w-5 h-5 mb-0.5" /> },
  { id: "cashflow", label: "tab.cash", icon: <TrendingUp className="w-5 h-5 mb-0.5" /> },
  { id: "sales", label: "tab.sales", icon: <ShoppingBag className="w-5 h-5 mb-0.5" /> },
];

export const App: React.FC = () => {
  const { currentPage, setCurrentPage, setMobileMenuOpen, isReducedMotion, toasts, removeToast, isAIPanelOpen, isStoryModeOpen } = useAppStore();

  const t = useT();
  const language = useAppStore((st) => st.language);
  // ให้ <html lang> ตรงกับภาษาที่เลือก (screen reader / ฟอนต์ไทย-จีน จะได้ถูก)
  React.useEffect(() => { document.documentElement.lang = language; }, [language]);

  const tabIndex = mobileTabs.findIndex((tab) => tab.id === currentPage);
  const activeTabIndex = tabIndex === -1 ? mobileTabs.length : tabIndex;

  const renderCurrentPage = () => {
    switch (currentPage) {
      case "overview":
        return <OverviewPage />;
      case "import":
        return <ImportPage />;
      case "cashflow":
        return <CashflowPage />;
      case "health":
        return <HealthPage />;
      case "cost":
        return <CostPage />;
      case "sales":
        return <SalesPage />;
      case "funding":
        return <FundingPage />;
      case "swarm":
        return <SwarmPage />;
      case "shop-finance":
        return <ShopFinancePage />;
      case "unlock":
        return <UnlockPage />;
      case "funder":
        return <FunderPage />;
      case "simulator":
        return <SimulatorPage />;
      case "projects":
      case "reports":
        return <ProjectsPage />;
      default:
        return <OverviewPage />;
    }
  };

  return (
    <div className={`min-h-screen flex flex-col bg-[#FAF7F0] ${isReducedMotion ? "reduce-motion" : ""}`}>
      {/* Top Application Header */}
      <AppHeader />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Desktop Sidebar */}
        <div className="hidden lg:flex">
          <AppSidebar />
        </div>

        {/* Dynamic Screen Viewport */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-8">
          <React.Suspense fallback={(
            <div role="status" className="m-4 lg:m-6 rounded-card border border-borderLine bg-white p-6 text-sm text-ink-muted">
              {t("common.loadingPage")}
            </div>
          )}>
            {/* key ตามหน้า เพื่อให้ animation เข้าหน้าเล่นใหม่ทุกครั้งที่เปลี่ยนเมนู */}
            <div key={currentPage} className="animate-page-in">
              {renderCurrentPage()}
            </div>
          </React.Suspense>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Part F) */}
      {/* มือถือ/แท็บเล็ต: 4 หน้าหลัก + ปุ่ม More เปิดเมนูครบทั้ง 13 หน้า */}
      <nav aria-label={t("tab.navLabel")} className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-borderLine z-30 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] grid grid-cols-5 items-center shadow-soft-lg">
        {/* แถบเล็ก ๆ ที่เลื่อนตามแท็บที่เลือก (ช่องที่ 5 = More) */}
        <span
          aria-hidden="true"
          className="absolute top-0 left-2 h-[3px] rounded-b-full bg-brand transition-transform duration-300 ease-out"
          style={{ width: "calc((100% - 1rem) / 5)", transform: `translateX(${activeTabIndex * 100}%)` }}
        />
        {mobileTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setCurrentPage(tab.id)}
            aria-current={currentPage === tab.id ? "page" : undefined}
            className={`press flex flex-col items-center py-1 px-2 rounded-lg text-[10px] transition-colors ${
              currentPage === tab.id ? "text-brand font-bold" : "text-ink-muted"
            }`}
          >
            <span className={`transition-transform duration-300 ${currentPage === tab.id ? "-translate-y-0.5 scale-110" : ""}`}>{tab.icon}</span>
            <span>{t(tab.label)}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label={t("tab.moreLabel")}
          className={`press flex flex-col items-center py-1 px-2 rounded-lg text-[10px] transition-colors ${
            mobileTabs.some((tab) => tab.id === currentPage) ? "text-ink-muted" : "text-brand font-bold"
          }`}
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span>{t("tab.more")}</span>
        </button>
      </nav>

      {/* Global Modals & Side Panels */}
      <MobileDrawer />
      <CommandPalette />
      {isAIPanelOpen && <React.Suspense fallback={null}><AIPanel /></React.Suspense>}
      {isStoryModeOpen && <React.Suspense fallback={null}><StoryModeModal /></React.Suspense>}

      {/* Toast Notification Container */}
      <div aria-live="polite" className="fixed bottom-20 lg:bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 z-50 space-y-2 pointer-events-none sm:max-w-sm sm:w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-card shadow-soft-lg border flex items-start gap-2.5 text-xs animate-slide-in ${
              toast.type === "success"
                ? "bg-white border-emerald-300 text-emerald-950"
                : toast.type === "warning"
                ? "bg-white border-amber-300 text-amber-950"
                : toast.type === "error"
                ? "bg-white border-red-300 text-red-950"
                : "bg-white border-brand/30 text-ink"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${toast.type === "error" ? "text-danger" : toast.type === "warning" ? "text-attention" : "text-brand"}`} />
            )}
            <div className="flex-1">
              <div className="font-bold">{toast.title}</div>
              <div className="text-[11px] text-ink-muted mt-0.5">{toast.message}</div>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label={t("common.dismiss")}
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
