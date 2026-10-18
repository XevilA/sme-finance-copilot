import React from "react";
import { FinancialEvent, FinancialEventType } from "@/api/contracts/types";
import {
  ShoppingCart,
  ChefHat,
  Truck,
  Coins,
  Receipt,
} from "lucide-react";

interface EventPinProps {
  event: FinancialEvent;
  isActive?: boolean;
  isBouncing?: boolean;
  onClick?: () => void;
  className?: string;
}

export const EventPin: React.FC<EventPinProps> = ({
  event,
  isActive = false,
  isBouncing = false,
  onClick,
  className = "",
}) => {
  const getPinConfig = (type: FinancialEventType) => {
    switch (type) {
      case "buy_materials":
        return {
          icon: <ShoppingCart className="w-3.5 h-3.5" />,
          label: "Buy ingredients",
          bg: "bg-amber-500 text-white",
          ring: "ring-amber-300",
          border: "border-amber-600",
        };
      case "produce":
        return {
          icon: <ChefHat className="w-3.5 h-3.5" />,
          label: "Production",
          bg: "bg-brand text-white",
          ring: "ring-brand-glow",
          border: "border-brand-dark",
        };
      case "deliver":
        return {
          icon: <Truck className="w-3.5 h-3.5" />,
          label: "Delivery",
          bg: "bg-blue-500 text-white",
          ring: "ring-blue-300",
          border: "border-blue-600",
        };
      case "receive_payment":
        return {
          icon: <Coins className="w-3.5 h-3.5" />,
          label: "Payment received",
          bg: "bg-emerald-500 text-white",
          ring: "ring-emerald-300",
          border: "border-emerald-600",
        };
      case "pay_obligations":
        return {
          icon: <Receipt className="w-3.5 h-3.5" />,
          label: "Obligation payment",
          bg: "bg-rose-500 text-white",
          ring: "ring-rose-300",
          border: "border-rose-600",
        };
    }
  };

  const config = getPinConfig(event.type);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      title={`${event.date}: ${event.title} (${event.isInflow ? "+" : "-"}฿${event.amount.toLocaleString("en-US")})`}
      className={`group relative flex flex-col items-center cursor-pointer outline-none transition-transform select-none ${
        isActive ? "scale-125 z-30" : "hover:scale-110 z-10"
      } ${isBouncing ? "animate-bounce" : ""} ${className}`}
    >
      {/* Water-drop Pin Shape (Signature element D4: หมุดทรงหยดน้ำ 5 แบบ) */}
      <div
        className={`w-7 h-7 rounded-full rounded-br-none -rotate-45 flex items-center justify-center shadow-md border ${
          config.bg
        } ${config.border} ${
          isActive ? `ring-4 ${config.ring} shadow-lg` : "group-hover:ring-2"
        }`}
      >
        <div className="rotate-45">{config.icon}</div>
      </div>

      {/* Mini stem */}
      <div className="w-1 h-1.5 bg-slate-400 rounded-full mt-[-1px]" />

      {/* Tooltip on hover/active */}
      <div
        className={`absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-50 min-w-[140px] text-center ${
          isActive ? "!flex" : ""
        }`}
      >
        <div className="bg-ink text-white text-[10px] p-2 rounded-xl shadow-soft-lg border border-slate-700">
          <div className="font-semibold text-brand-glow">{event.date} · {config.label}</div>
          <div className="text-slate-200 text-[11px] leading-tight my-0.5 line-clamp-2">
            {event.title}
          </div>
          <div
            className={`font-mono font-bold text-xs ${
              event.isInflow ? "text-emerald-300" : "text-amber-300"
            }`}
          >
            {event.isInflow ? "+" : "-"}฿{event.amount.toLocaleString("en-US")}
          </div>
        </div>
        <div className="w-2 h-2 bg-ink rotate-45 -mt-1" />
      </div>
    </div>
  );
};
