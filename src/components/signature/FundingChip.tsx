import React from "react";
import { FundingOption, DataKind } from "@/api/contracts/types";
import { DataKindBadge } from "./DataKindBadge";
import {
  Coins,
  ShieldCheck,
  Clock,
  Sparkles,
  ChevronRight,
  Calculator,
} from "lucide-react";

interface FundingChipProps {
  funding: FundingOption;
  dataKind?: DataKind;
  isSelected?: boolean;
  onSelect?: () => void;
  onSimulateInstallment?: () => void;
  onApply?: () => void;
  className?: string;
}

export const FundingChip: React.FC<FundingChipProps> = ({
  funding,
  dataKind = "forecast",
  isSelected = false,
  onSelect,
  onSimulateInstallment,
  onApply,
  className = "",
}) => {
  return (
    <div
      onClick={onSelect}
      className={`relative bg-white rounded-card p-4 border transition-all duration-200 select-none cursor-pointer ${
        isSelected
          ? "border-brand ring-2 ring-brand/30 shadow-soft-lg"
          : "border-borderLine hover:border-brand/40 hover:shadow-soft-md"
      } ${className}`}
    >
      {/* Top Banner: Provider & Matching Score */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <span className="text-[10px] font-semibold text-brand tracking-wider uppercase bg-brand/10 px-2 py-0.5 rounded-chip">
            {funding.typeLabel}
          </span>
          <h4 className="text-sm font-display font-semibold text-ink mt-1 leading-snug">
            {funding.name}
          </h4>
          <p className="text-[11px] text-ink-muted">{funding.provider}</p>
        </div>

        {/* Match Score */}
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-chip border border-emerald-200 text-xs font-bold tabular-nums">
            <Sparkles className="w-3 h-3 text-emerald-500" />
            <span>{funding.matchScore}% ตรงเกณฑ์</span>
          </div>
        </div>
      </div>

      {/* Financial Details Grid */}
      <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl text-center my-3 border border-slate-100">
        <div>
          <span className="text-[10px] text-ink-muted block">วงเงินสูงสุด</span>
          <span className="text-xs font-bold text-ink tabular-nums">
            ฿{funding.maxAmount.toLocaleString()}
          </span>
        </div>
        <div className="border-x border-slate-200">
          <span className="text-[10px] text-ink-muted block">ดอกเบี้ย</span>
          <span className="text-xs font-bold text-brand tabular-nums">
            {(funding.interestRateAnnual * 100).toLocaleString("th-TH", { maximumFractionDigits: 2 })}% ต่อปี
          </span>
        </div>
        <div>
          <span className="text-[10px] text-ink-muted block">รับเงินใน</span>
          <span className="text-xs font-bold text-emerald-700 tabular-nums flex items-center justify-center gap-0.5">
            <Clock className="w-3 h-3" />
            {funding.disbursementDays} วัน
          </span>
        </div>
      </div>

      {/* Impact Explanation */}
      <p className="text-[11px] text-ink-muted leading-relaxed mb-3 line-clamp-2">
        {funding.impactOnCash}
      </p>

      {/* Footer & Actions */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        <DataKindBadge kind={dataKind} size="sm" />

        <div className="flex items-center gap-1.5">
          {onSimulateInstallment && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSimulateInstallment();
              }}
              className="px-2 py-1 text-xs font-medium text-ink-muted hover:text-brand hover:bg-brand/10 rounded-lg flex items-center gap-1 transition-colors"
            >
              <Calculator className="w-3 h-3" />
              <span>จำลองงวด</span>
            </button>
          )}
          {onApply && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onApply();
              }}
              className="px-2.5 py-1 text-xs font-semibold text-white bg-brand hover:bg-brand-dark rounded-btn flex items-center gap-1 transition-all shadow-sm"
            >
              <span>เตรียมคำขอ</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
