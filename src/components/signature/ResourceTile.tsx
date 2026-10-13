import React from "react";
import { UnlockResource, DataKind } from "@/api/contracts/types";
import { DataKindBadge } from "./DataKindBadge";
import {
  ChefHat,
  Truck,
  Cog,
  Users,
  Building2,
  Trash2,
  RotateCcw,
  AlertCircle,
  MapPin,
  CheckCircle,
} from "lucide-react";

interface ResourceTileProps {
  resource: UnlockResource;
  dataKind?: DataKind;
  isDetached?: boolean;
  onToggleDetach?: () => void;
  className?: string;
}

export const ResourceTile: React.FC<ResourceTileProps> = ({
  resource,
  dataKind = "actual",
  isDetached = false,
  onToggleDetach,
  className = "",
}) => {
  const getIcon = () => {
    switch (resource.category) {
      case "kitchen":
        return <ChefHat className="w-4 h-4 text-resource-dark" />;
      case "truck":
        return <Truck className="w-4 h-4 text-resource-dark" />;
      case "machine":
        return <Cog className="w-4 h-4 text-resource-dark" />;
      case "team":
        return <Users className="w-4 h-4 text-resource-dark" />;
      default:
        return <Building2 className="w-4 h-4 text-resource-dark" />;
    }
  };

  return (
    <div
      className={`relative rounded-card p-4 transition-all duration-300 border select-none ${
        isDetached
          ? "bg-slate-50 border-dashed border-red-300 opacity-60 grayscale-[40%]"
          : "bg-white border-borderLine hover:border-resource hover:shadow-soft-md"
      } ${className}`}
    >
      {/* Cyan/Teal Connecting Terminal (Signature element D4: ขั้วต่อสีฟ้าอมเขียว) */}
      <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-resource border-2 border-white shadow-sm" />
      <span className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-resource border-2 border-white shadow-sm" />

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-resource-light border border-resource/30 flex items-center justify-center">
            {getIcon()}
          </div>
          <div>
            <span className="text-[11px] font-semibold text-resource-dark tracking-wide uppercase">
              {resource.categoryLabel}
            </span>
            <h4 className="text-xs font-display font-semibold text-ink leading-tight line-clamp-1">
              {resource.title}
            </h4>
          </div>
        </div>

        {/* Status Badge */}
        {resource.status === "confirmed" ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-resource-dark bg-resource-light px-2 py-0.5 rounded-chip border border-resource/20">
            <CheckCircle className="w-3 h-3" />
            ยืนยันแล้ว
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-chip border border-amber-200">
            เสนอให้ใช้
          </span>
        )}
      </div>

      {/* Details */}
      <div className="text-[11px] space-y-1 text-ink-muted mb-3 bg-slate-50 p-2 rounded-xl">
        <div className="flex items-center justify-between">
          <span>ความจุ / ข้อกำหนด:</span>
          <span className="font-medium text-ink">{resource.capacityText}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>อัตราค่าบริการ:</span>
          <span className="font-semibold text-resource-dark">{resource.priceText}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-ink-muted">
          <MapPin className="w-3 h-3 text-slate-400" />
          <span className="truncate">{resource.location}</span>
        </div>
      </div>

      {/* Detach Impact Alert (S5) */}
      {isDetached && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-xl text-[11px] text-danger flex items-start gap-1.5 animate-pulse">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <div className="font-bold">ถอดชิ้นส่วนนี้ออกแล้ว!</div>
            <div className="text-[10px] text-red-700 leading-tight">
              {resource.impactIfDetached.bottleneckMessage}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <DataKindBadge kind={isDetached ? "simulated" : dataKind} size="sm" />

        {onToggleDetach && (
          <button
            type="button"
            onClick={onToggleDetach}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
              isDetached
                ? "bg-resource text-white hover:bg-resource-dark shadow-sm"
                : "text-danger bg-danger-light hover:bg-danger/20 border border-danger/30"
            }`}
          >
            {isDetached ? (
              <>
                <RotateCcw className="w-3 h-3" />
                <span>คืนชิ้นส่วน</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3 h-3" />
                <span>ถอดชิ้นส่วน</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
