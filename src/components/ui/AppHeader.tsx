import React, { useCallback } from "react";
import { useAppStore, UserRole, PageStateMode } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { SwarmOrder } from "@/api/contracts/types";
import { useEnvelope } from "@/hooks/useEnvelope";
import {
  Search,
  Sliders,
  PlayCircle,
  Eye,
  Bell,
  Sparkles,
  ChevronDown,
  User,
  Shield,
  Layers,
  Menu,
} from "lucide-react";

export const AppHeader: React.FC = () => {
  const {
    userRole,
    setUserRole,
    setCommandPaletteOpen,
    isReducedMotion,
    toggleReducedMotion,
    setStoryModeOpen,
    setAIPanelOpen,
    isAIPanelOpen,
    contextPill,
    pageStateMode,
    setPageStateMode,
    isMobileMenuOpen,
    setMobileMenuOpen,
  } = useAppStore();

  // The project line names the stored active order rather than a fixed demo
  // project and buyer. With no stored order it says so.
  const orderState = useEnvelope<SwarmOrder>(useCallback(() => apiClient.getOrder(), []));
  const order = orderState.envelope?.data || null;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-borderLine px-3 sm:px-4 lg:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
      {/* Left: Mobile Menu Trigger & Project Selector */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="lg:hidden p-2 text-ink hover:text-brand hover:bg-slate-100 rounded-xl transition-colors shrink-0 cursor-pointer"
          aria-label="Open navigation menu with 15 screens"
          title="Navigation menu"
        >
          <Menu className="w-5 h-5 text-ink" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand to-brand-dark flex items-center justify-center text-white shadow-sm font-display font-bold text-xs shrink-0">
            SME
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-ink leading-none flex items-center gap-1.5">
              <span className="truncate">SME Finance Copilot</span>
            </div>
            <div className="text-[11px] text-ink-muted leading-tight mt-0.5 truncate hidden sm:block">
              {order
                ? <>Project: <strong>{order.title}</strong> ({order.buyerName})</>
                : <>Project: <strong>No project selected</strong></>}
            </div>
          </div>
        </div>

        {/* Dynamic Context Pill (Preserved across page hops) */}
        {contextPill && (
          <div className="hidden xl:inline-flex items-center gap-1 text-[11px] font-medium text-brand bg-brand/10 border border-brand/30 px-2.5 py-0.5 rounded-chip animate-fade-in">
            <span>{contextPill}</span>
          </div>
        )}
      </div>

      {/* Center: Command Palette Trigger */}
      <div className="hidden md:flex flex-1 max-w-md">
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full h-9 bg-slate-100/80 hover:bg-slate-100 border border-slate-200/80 rounded-btn px-3 flex items-center justify-between text-xs text-ink-muted transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span>Search shops, available kitchens, funders, projects...</span>
          </div>
          <kbd className="font-mono text-[10px] bg-white border border-slate-300 px-1.5 py-0.5 rounded text-slate-500 shadow-2xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Controls: Story Mode, AI Assistant, Role, Reduced Motion, 9-State Tester */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Mobile Quick Search Button */}
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="md:hidden p-2 text-ink-muted hover:text-brand hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
          aria-label="Search"
          title="Search (⌘K)"
        >
          <Search className="w-4 h-4 text-ink-muted" />
        </button>

        {/* Story Mode Button (For Committee) */}
        <button
          type="button"
          onClick={() => setStoryModeOpen(true)}
          className="px-3 py-1.5 bg-gradient-to-r from-navy-deep to-brand hover:opacity-95 text-white rounded-btn text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          title="Start the committee presentation (Spacebar / arrow keys)"
        >
          <PlayCircle className="w-4 h-4 text-brand-glow animate-pulse" />
          <span className="hidden sm:inline">Story Mode</span>
        </button>

        {/* AI Assistant Button */}
        <button
          type="button"
          onClick={() => setAIPanelOpen(!isAIPanelOpen)}
          className={`px-3 py-1.5 rounded-btn text-xs font-semibold flex items-center gap-1.5 border transition-all ${
            isAIPanelOpen
              ? "bg-brand text-white border-brand shadow-glow-primary"
              : "bg-white text-ink border-borderLine hover:border-brand/40"
          }`}
          title="Ask AI to explain this page and highlight key data"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isAIPanelOpen ? "text-white" : "text-brand"}`} />
          <span className="hidden lg:inline">Explain This Page</span>
        </button>

        {/* Role Switcher */}
        <div className="relative group">
          <button
            type="button"
            title="Choose a display role. This is not a login; actual permissions come from your token and database."
            className="h-8 px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-btn text-xs font-medium text-ink flex items-center gap-1.5 transition-colors"
          >
            <User className="w-3.5 h-3.5 text-brand" />
            <span className="hidden sm:inline">
              {userRole === "owner" ? "Shop Owner" : userRole === "buyer" ? "Buyer" : "Funder"}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
          <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-white border border-borderLine rounded-xl shadow-soft-lg p-1.5 min-w-[150px] z-50 text-xs">
            <button
              type="button"
              onClick={() => setUserRole("owner")}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between ${
                userRole === "owner" ? "bg-brand/10 text-brand font-semibold" : "hover:bg-slate-50 text-ink"
              }`}
            >
              <span>Business Owner</span>
            </button>
            <button
              type="button"
              onClick={() => setUserRole("buyer")}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between ${
                userRole === "buyer" ? "bg-brand/10 text-brand font-semibold" : "hover:bg-slate-50 text-ink"
              }`}
            >
              <span>Buyer / Client</span>
            </button>
            <button
              type="button"
              onClick={() => setUserRole("funder")}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between ${
                userRole === "funder" ? "bg-brand/10 text-brand font-semibold" : "hover:bg-slate-50 text-ink"
              }`}
            >
              <span>Funder</span>
            </button>
          </div>
        </div>

        {/* 9-State Showcase Switcher (Part H Testing for Examiners) */}
        <div className="relative group">
          <button
            type="button"
            className="h-8 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-btn text-xs text-ink-muted flex items-center gap-1"
            title="Test the 9 system states (Part H)"
          >
            <Layers className="w-3.5 h-3.5 text-attention" />
            <span className="hidden xl:inline text-[11px]">Status: {pageStateMode}</span>
          </button>
          <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-white border border-borderLine rounded-xl shadow-soft-lg p-2 min-w-[190px] z-50 text-xs space-y-1">
            <span className="text-[10px] font-bold text-ink-muted uppercase block px-1">
              Test 9 States (Part H):
            </span>
            {(
              [
                ["normal", "Normal"],
                ["empty", "1. Empty"],
                ["loading", "2. Loading (Skeleton)"],
                ["insufficient_data", "3. Insufficient Data (Rule #3)"],
                ["error", "4. Error"],
                ["not_found", "5. Not Found"],
                ["no_permission", "6. No Permission"],
                ["stale", "7. Stale Data"],
                ["success", "8. Saved Successfully"],
                ["unsaved", "9. Unsaved Changes"],
              ] as [PageStateMode, string][]
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPageStateMode(mode)}
                className={`w-full text-left px-2 py-1 rounded-lg text-[11px] ${
                  pageStateMode === mode
                    ? "bg-brand text-white font-medium"
                    : "hover:bg-slate-50 text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Reduced Motion Toggle */}
        <button
          type="button"
          onClick={toggleReducedMotion}
          className={`p-2 rounded-btn text-xs border transition-colors ${
            isReducedMotion
              ? "bg-amber-50 text-attention border-amber-300"
              : "bg-white text-ink-muted border-borderLine hover:text-ink"
          }`}
          title={isReducedMotion ? "Disable reduced motion" : "Enable reduced motion"}
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
