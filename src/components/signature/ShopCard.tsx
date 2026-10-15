import React from "react";
import { Shop, DataKind } from "@/api/contracts/types";
import { DataKindBadge } from "./DataKindBadge";
import {
  Utensils,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Coins,
  ChevronRight,
  RefreshCw,
  MapPin,
} from "lucide-react";

interface ShopCardProps {
  shop: Shop;
  dataKind?: DataKind;
  isSelected?: boolean;
  isStuckHighlighted?: boolean;
  variant?: "light" | "dark";
  onSelect?: () => void;
  onViewFinance?: () => void;
  onSwapShop?: () => void;
  className?: string;
}

export const ShopCard: React.FC<ShopCardProps> = ({
  shop,
  dataKind = "forecast",
  isSelected = false,
  isStuckHighlighted = false,
  variant = "light",
  onSelect,
  onViewFinance,
  onSwapShop,
  className = "",
}) => {
  const isShortage = shop.fundingGap > 0;
  const usedPercent = Math.min(100, Math.round((shop.capacityUsed / shop.capacityTotal) * 100));
  const isDark = variant === "dark";

  return (
    <div
      onClick={onSelect}
      className={`relative group rounded-2xl p-4 transition-all duration-200 border cursor-pointer select-none ${
        isDark
          ? isSelected
            ? "bg-[#182654] border-brand-glow ring-2 ring-brand-glow/40 shadow-glow-primary translate-y-[-2px]"
            : isStuckHighlighted
            ? "bg-[#2A1525] border-rose-500 ring-2 ring-rose-500/50 shadow-[0_0_24px_rgba(244,63,94,0.35)] animate-pulse"
            : "bg-[#121E42]/90 hover:bg-[#182654] border-slate-700/70 hover:border-brand/60 shadow-lg hover:translate-y-[-2px]"
          : isSelected
          ? "bg-white border-brand ring-2 ring-brand/30 shadow-soft-lg translate-y-[-2px]"
          : isStuckHighlighted
          ? "bg-rose-50/90 border-danger ring-2 ring-danger/40 shadow-glow-danger animate-pulse"
          : "bg-white hover:bg-slate-50/50 border-slate-200/90 hover:border-brand/40 shadow-xs hover:shadow-soft-md hover:translate-y-[-2px]"
      } ${className}`}
    >
      {/* Sleek Integrated Magnetic Docking Ports (Clean inset ports, no protruding nubs) */}
      <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-slate-300/60 dark:bg-slate-600/60 group-hover:bg-brand transition-colors" />
      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-slate-300/60 dark:bg-slate-600/60 group-hover:bg-brand transition-colors" />

      {/* Header: Monogram, Title, Status */}
      <div className="flex items-start justify-between gap-2.5 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center font-display font-bold text-sm shadow-sm transition-transform group-hover:scale-105 ${
              isDark
                ? "bg-brand/25 border border-brand/40 text-brand-glow"
                : "bg-brand/10 border border-brand/20 text-brand"
            }`}
          >
            {shop.monogram}
          </div>
          <div className="min-w-0">
            <h3
              className={`font-display font-semibold text-sm leading-snug group-hover:text-brand transition-colors ${
                isDark ? "text-white" : "text-ink"
              }`}
            >
              {shop.name}
            </h3>
            <p className={`text-xs flex items-center gap-1 mt-0.5 ${isDark ? "text-slate-400" : "text-ink-muted"}`}>
              <Utensils className="w-3 h-3 shrink-0" />
              <span className="truncate">{shop.category}</span>
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="shrink-0">
          {shop.status === "ready" && (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-chip border ${
                isDark
                  ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/80"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              พร้อม
            </span>
          )}
          {shop.status === "review" && (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-chip border ${
                isDark
                  ? "bg-amber-950/60 text-amber-300 border-amber-800/80"
                  : "bg-amber-50 text-amber-800 border-amber-300"
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              ต้องตรวจ
            </span>
          )}
          {shop.status === "blocked" && (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-chip border ${
                isDark
                  ? "bg-rose-950/60 text-rose-300 border-rose-800/80"
                  : "bg-danger-light text-danger border-danger/30"
              }`}
            >
              <XCircle className="w-3 h-3 text-danger" />
              ติดปัญหา
            </span>
          )}
        </div>
      </div>

      {/* Capacity Bar */}
      <div
        className={`mb-3 p-2.5 rounded-xl border ${
          isDark
            ? "bg-[#0c1530]/80 border-slate-800/80"
            : "bg-slate-50/90 border-slate-100"
        }`}
      >
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className={isDark ? "text-slate-400" : "text-ink-muted"}>กำลังผลิตใช้งาน</span>
          <span className={`font-mono font-medium ${isDark ? "text-slate-200" : "text-ink"}`}>
            {shop.capacityUsed} / {shop.capacityTotal} {shop.unit}
          </span>
        </div>
        <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
          <div
            className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-teal-400 to-emerald-500"
            style={{ width: `${usedPercent}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span
            className={`inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-md ${
              isDark
                ? "bg-teal-950/70 text-teal-300 border border-teal-800/50"
                : "bg-resource-light text-resource-dark border border-resource/20"
            }`}
          >
            ว่าง {shop.capacityAvailable} {shop.unit}
          </span>
          <span className={`flex items-center gap-0.5 text-[11px] ${isDark ? "text-slate-400" : "text-ink-muted"}`}>
            <MapPin className="w-3 h-3" />
            <span>{shop.location}</span>
          </span>
        </div>
      </div>

      {/* Financial Status & Shortage Chip */}
      <div
        className={`pt-2.5 border-t flex items-center justify-between ${
          isDark ? "border-slate-800" : "border-slate-100"
        }`}
      >
        <div className="flex flex-col">
          <span className={`text-[11px] ${isDark ? "text-slate-400" : "text-ink-muted"}`}>เงินหมุนเวียนที่ต้องใช้</span>
          <div className="flex items-center gap-1 mt-0.5">
            <Coins className={`w-3.5 h-3.5 ${isDark ? "text-slate-400" : "text-ink-muted"}`} />
            <span className={`text-xs font-semibold font-mono tabular-nums ${isDark ? "text-white" : "text-ink"}`}>
              ฿{shop.workingCapitalNeeded.toLocaleString()}
            </span>
          </div>
        </div>

        {isShortage ? (
          <div className="flex flex-col items-end">
            <span className="text-[11px] text-danger font-medium">ทุนที่ยังขาด</span>
            <span className="text-xs font-bold text-danger bg-danger-light px-2 py-0.5 rounded-chip border border-danger/20 font-mono tabular-nums mt-0.5 shadow-2xs">
              ขาด ฿{shop.fundingGap.toLocaleString()}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-end">
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">สภาพคล่อง</span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-chip border mt-0.5 ${
                isDark
                  ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/60"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              ครอบคลุม
            </span>
          </div>
        )}
      </div>

      {/* Card Actions */}
      <div
        className={`mt-3 pt-2.5 border-t flex items-center justify-between gap-2 ${
          isDark ? "border-slate-800" : "border-slate-100"
        }`}
      >
        <DataKindBadge kind={dataKind} size="sm" />
        <div className="flex items-center gap-1.5">
          {onSwapShop && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSwapShop();
              }}
              title="สลับร้านคู่นี้กับร้านสำรอง"
              className={`px-2 py-1 rounded-lg transition-colors text-xs flex items-center gap-1 font-medium ${
                isDark
                  ? "text-slate-300 hover:text-white hover:bg-slate-700/60"
                  : "text-ink-muted hover:text-brand hover:bg-brand/10"
              }`}
            >
              <RefreshCw className="w-3 h-3" />
              <span>สลับ</span>
            </button>
          )}
          {onViewFinance && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewFinance();
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-0.5 ${
                isDark
                  ? "text-brand-glow hover:text-white hover:bg-brand/20"
                  : "text-brand hover:bg-brand/10"
              }`}
            >
              <span>ดูเงินร้านนี้</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
