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
} from "lucide-react";

interface ShopCardProps {
  shop: Shop;
  dataKind?: DataKind;
  isSelected?: boolean;
  isStuckHighlighted?: boolean;
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
  onSelect,
  onViewFinance,
  onSwapShop,
  className = "",
}) => {
  const isShortage = shop.fundingGap > 0;
  const usedPercent = Math.min(100, Math.round((shop.capacityUsed / shop.capacityTotal) * 100));

  return (
    <div
      onClick={onSelect}
      className={`relative group bg-white rounded-card p-4 transition-all duration-200 border cursor-pointer select-none ${
        isSelected
          ? "border-brand ring-2 ring-brand/30 shadow-soft-lg translate-y-[-2px]"
          : isStuckHighlighted
          ? "border-danger ring-4 ring-danger/25 shadow-glow-danger animate-pulse"
          : "border-borderLine hover:border-brand/40 hover:shadow-soft-md hover:translate-y-[-2px]"
      } ${className}`}
    >
      {/* 4 Connecting Terminals (Signature element D4: ขั้วต่อ 4 จุด) */}
      <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-slate-200 border-2 border-white group-hover:bg-brand transition-colors" />
      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-slate-200 border-2 border-white group-hover:bg-brand transition-colors" />
      <span className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 rounded-full bg-slate-200 border-2 border-white group-hover:bg-brand transition-colors" />
      <span className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 rounded-full bg-slate-200 border-2 border-white group-hover:bg-brand transition-colors" />

      {/* Header: Monogram, Title, Status */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center font-display font-bold text-brand text-base shadow-sm">
            {shop.monogram}
          </div>
          <div>
            <h3 className="font-display font-semibold text-ink text-sm leading-snug line-clamp-1 group-hover:text-brand transition-colors">
              {shop.name}
            </h3>
            <p className="text-[12px] text-ink-muted flex items-center gap-1">
              <Utensils className="w-3 h-3" />
              <span>{shop.category}</span>
            </p>
          </div>
        </div>

        {/* Status Badge */}
        {shop.status === "ready" && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-chip border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            พร้อม
          </span>
        )}
        {shop.status === "review" && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-chip border border-amber-300">
            <AlertTriangle className="w-3 h-3 text-attention" />
            ต้องตรวจ
          </span>
        )}
        {shop.status === "blocked" && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-danger bg-danger-light px-2 py-0.5 rounded-chip border border-danger/30">
            <XCircle className="w-3 h-3 text-danger" />
            ติดปัญหา
          </span>
        )}
      </div>

      {/* Capacity Bar */}
      <div className="mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-ink-muted">กำลังผลิตใช้งาน</span>
          <span className="font-medium text-ink tabular-nums">
            {shop.capacityUsed} / {shop.capacityTotal} {shop.unit}
          </span>
        </div>
        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div
            className="bg-brand h-full rounded-full transition-all duration-300"
            style={{ width: `${usedPercent}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px]">
          <span className="inline-flex items-center gap-1 text-resource-dark font-medium bg-resource-light px-1.5 py-0.5 rounded">
            ว่าง {shop.capacityAvailable} {shop.unit}
          </span>
          <span className="text-ink-muted text-[10px]">{shop.location}</span>
        </div>
      </div>

      {/* Financial Status & Shortage Chip */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] text-ink-muted">เงินหมุนเวียนที่ต้องใช้</span>
          <div className="flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-ink-muted" />
            <span className="text-xs font-semibold text-ink tabular-nums">
              ฿{shop.workingCapitalNeeded.toLocaleString()}
            </span>
          </div>
        </div>

        {isShortage ? (
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-danger font-medium">ทุนที่ยังขาด</span>
            <span className="text-xs font-bold text-danger bg-danger-light px-2 py-0.5 rounded-chip border border-danger/20 tabular-nums">
              ขาด ฿{shop.fundingGap.toLocaleString()}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-emerald-600 font-medium">สภาพคล่อง</span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-chip border border-emerald-200">
              ครอบคลุม
            </span>
          </div>
        )}
      </div>

      {/* Card Actions */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
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
              className="p-1 text-ink-muted hover:text-brand hover:bg-brand/10 rounded-lg transition-colors text-xs flex items-center gap-1"
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
              className="px-2 py-1 text-xs font-medium text-brand hover:bg-brand/10 rounded-lg transition-colors flex items-center gap-0.5"
            >
              <span>ดูเงินร้านนี้</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
