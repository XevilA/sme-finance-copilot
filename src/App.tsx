import React from "react";
import { useAppStore } from "@/store/useAppStore";
import { AppHeader } from "@/components/ui/AppHeader";
import { AppSidebar } from "@/components/ui/AppSidebar";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { AIPanel } from "@/features/ai-panel/AIPanel";
import { StoryModeModal } from "@/features/reports/StoryModeModal";
import { MobileDrawer } from "@/components/ui/MobileDrawer";

// Feature Pages
import { OverviewPage } from "@/features/overview/OverviewPage";
import { ImportPage } from "@/features/import/ImportPage";
import { CashflowPage } from "@/features/cashflow/CashflowPage";
import { HealthPage } from "@/features/health/HealthPage";
import { CostPage } from "@/features/cost/CostPage";
import { SalesPage } from "@/features/sales/SalesPage";
import { FundingPage } from "@/features/funding/FundingPage";
import { SwarmPage } from "@/features/swarm/SwarmPage";
import { ShopFinancePage } from "@/features/shop-finance/ShopFinancePage";
import { UnlockPage } from "@/features/unlock/UnlockPage";
import { FunderPage } from "@/features/funder/FunderPage";
import { SimulatorPage } from "@/features/simulator/SimulatorPage";
import { ProjectsPage } from "@/features/projects/ProjectsPage";

// Mobile Icons
import {
  LayoutDashboard,
  TrendingUp,
  Network,
  Wrench,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";

export const App: React.FC = () => {
  const { currentPage, setCurrentPage, isReducedMotion, toasts, removeToast } = useAppStore();

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
          {renderCurrentPage()}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Part F) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-borderLine z-30 px-2 py-1.5 flex items-center justify-around shadow-soft-lg">
        <button
          type="button"
          onClick={() => setCurrentPage("overview")}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] ${
            currentPage === "overview" ? "text-brand font-bold" : "text-ink-muted"
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>ภาพรวม</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentPage("cashflow")}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] ${
            currentPage === "cashflow" ? "text-brand font-bold" : "text-ink-muted"
          }`}
        >
          <TrendingUp className="w-5 h-5 mb-0.5" />
          <span>เงินสด</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentPage("swarm")}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] ${
            currentPage === "swarm" ? "text-brand font-bold" : "text-ink-muted"
          }`}
        >
          <Network className="w-5 h-5 mb-0.5" />
          <span>SWARM</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentPage("unlock")}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] ${
            currentPage === "unlock" ? "text-brand font-bold" : "text-ink-muted"
          }`}
        >
          <Wrench className="w-5 h-5 mb-0.5" />
          <span>ทรัพยากร</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentPage("projects")}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] ${
            currentPage === "projects" ? "text-brand font-bold" : "text-ink-muted"
          }`}
        >
          <FileCheck2 className="w-5 h-5 mb-0.5" />
          <span>โครงการ</span>
        </button>
      </div>

      {/* Global Modals & Side Panels */}
      <MobileDrawer />
      <CommandPalette />
      <AIPanel />
      <StoryModeModal />

      {/* Toast Notification Container */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none max-w-sm w-full">
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
              <AlertCircle className="w-4 h-4 text-brand shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="font-bold">{toast.title}</div>
              <div className="text-[11px] text-ink-muted mt-0.5">{toast.message}</div>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
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
