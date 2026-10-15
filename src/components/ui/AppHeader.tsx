import React from "react";
import { useAppStore, UserRole, PageStateMode } from "@/store/useAppStore";
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

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-borderLine px-3 sm:px-4 lg:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
      {/* Left: Mobile Menu Trigger & Project Selector */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="lg:hidden p-2 text-ink hover:text-brand hover:bg-slate-100 rounded-xl transition-colors shrink-0 cursor-pointer"
          aria-label="เปิดเมนูนำทาง 15 หน้าจอ"
          title="เมนูนำทาง"
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
              <span className="hidden sm:inline-block text-[10px] font-normal text-brand-dark bg-brand-light px-1.5 py-0.5 rounded-chip border border-brand/20 whitespace-nowrap">
                ห้องประกอบโอกาสธุรกิจ
              </span>
            </div>
            <div className="text-[11px] text-ink-muted leading-tight mt-0.5 truncate hidden sm:block">
              โครงการ: <strong>อาหารกล่อง 300 กล่อง/วัน</strong> (บจก.สยามเทคโนพาร์ค)
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
            <span>ค้นหาร้านค้า, ครัวว่าง, แหล่งทุน, โครงการ...</span>
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
          aria-label="ค้นหา"
          title="ค้นหา (⌘K)"
        >
          <Search className="w-4 h-4 text-ink-muted" />
        </button>

        {/* Story Mode Button (For Committee) */}
        <button
          type="button"
          onClick={() => setStoryModeOpen(true)}
          className="px-3 py-1.5 bg-gradient-to-r from-navy-deep to-brand hover:opacity-95 text-white rounded-btn text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          title="เริ่มโหมดนำเสนอสำหรับกรรมการ (Spacebar / ลูกศร)"
        >
          <PlayCircle className="w-4 h-4 text-brand-glow animate-pulse" />
          <span className="hidden sm:inline">โหมดเล่าโครงการ</span>
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
          title="ให้ AI อธิบายหน้านี้และส่องแสงข้อมูล"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isAIPanelOpen ? "text-white" : "text-brand"}`} />
          <span className="hidden lg:inline">AI อธิบายหน้านี้</span>
        </button>

        {/* Role Switcher */}
        <div className="relative group">
          <button
            type="button"
            className="h-8 px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-btn text-xs font-medium text-ink flex items-center gap-1.5 transition-colors"
          >
            <User className="w-3.5 h-3.5 text-brand" />
            <span className="hidden sm:inline">
              {userRole === "owner" ? "เจ้าของร้าน" : userRole === "buyer" ? "ผู้ว่าจ้าง" : "ผู้ให้ทุน"}
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
              <span>เจ้าของธุรกิจ (Owner)</span>
            </button>
            <button
              type="button"
              onClick={() => setUserRole("buyer")}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between ${
                userRole === "buyer" ? "bg-brand/10 text-brand font-semibold" : "hover:bg-slate-50 text-ink"
              }`}
            >
              <span>ผู้ซื้อ/ผู้ว่าจ้าง (Buyer)</span>
            </button>
            <button
              type="button"
              onClick={() => setUserRole("funder")}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between ${
                userRole === "funder" ? "bg-brand/10 text-brand font-semibold" : "hover:bg-slate-50 text-ink"
              }`}
            >
              <span>ผู้ให้ทุน (Funder)</span>
            </button>
          </div>
        </div>

        {/* 9-State Showcase Switcher (Part H Testing for Examiners) */}
        <div className="relative group">
          <button
            type="button"
            className="h-8 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-btn text-xs text-ink-muted flex items-center gap-1"
            title="ทดสอบสถานะ 9 แบบของระบบ (Part H)"
          >
            <Layers className="w-3.5 h-3.5 text-attention" />
            <span className="hidden xl:inline text-[11px]">สถานะ: {pageStateMode}</span>
          </button>
          <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-white border border-borderLine rounded-xl shadow-soft-lg p-2 min-w-[190px] z-50 text-xs space-y-1">
            <span className="text-[10px] font-bold text-ink-muted uppercase block px-1">
              ทดสอบ 9 สถานะ (Part H):
            </span>
            {(
              [
                ["normal", "ปกติ (Normal)"],
                ["empty", "1. ยังไม่มีข้อมูล (Empty)"],
                ["loading", "2. กำลังโหลด (Skeleton)"],
                ["insufficient_data", "3. ข้อมูลไม่พอ (Rule #3)"],
                ["error", "4. เกิดข้อผิดพลาด (Error)"],
                ["not_found", "5. ค้นหาไม่พบ (Not Found)"],
                ["no_permission", "6. ไม่มีสิทธิ์ (No Perm)"],
                ["stale", "7. ผลล้าสมัย (Stale)"],
                ["success", "8. บันทึกสำเร็จ (Success)"],
                ["unsaved", "9. มีการแก้ค้าง (Unsaved)"],
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
          title={isReducedMotion ? "ปิดโหมดลดภาพเคลื่อนไหว" : "เปิดโหมดลดภาพเคลื่อนไหว (Reduced Motion)"}
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
