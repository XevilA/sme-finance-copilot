import React from "react";
import { DataKind } from "@/api/contracts/types";
import { useT } from "@/i18n";

interface DataKindBadgeProps {
  kind: DataKind;
  size?: "sm" | "md";
  className?: string;
}

export const DataKindBadge: React.FC<DataKindBadgeProps> = ({
  kind,
  size = "sm",
  className = "",
}) => {
  const configs = {
    actual: {
      symbol: "●",
      label: "kind.actual" as const,
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
      dotColor: "text-emerald-500",
    },
    forecast: {
      symbol: "◐",
      label: "kind.forecast" as const,
      bg: "bg-brand-light text-brand-dark border-brand/20",
      dotColor: "text-brand",
    },
    simulated: {
      symbol: "◇",
      label: "kind.simulated" as const,
      bg: "bg-attention-light text-amber-800 border-attention/30 border-dashed",
      dotColor: "text-attention",
    },
  };

  const t = useT();
  const config = configs[kind];

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-chip border select-none transition-colors ${
        size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1"
      } ${config.bg} ${className}`}
      title={t("kind.title", { label: t(config.label), kind })}
    >
      <span className={`font-mono text-[10px] ${config.dotColor}`}>{config.symbol}</span>
      <span>{t(config.label)}</span>
    </span>
  );
};
