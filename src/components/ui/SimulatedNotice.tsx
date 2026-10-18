import React from "react";
import { FlaskConical } from "lucide-react";
import { DataKind } from "@/api/contracts/types";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { useT } from "@/i18n";

type Props = {
  kind: DataKind;
  persisted?: boolean;
  source?: string;
  asOf?: string;
  // true = ฟอร์มถูกแก้หลังจากคำนวณ ผลที่แสดงอยู่ไม่ตรงกับฟอร์มแล้ว
  outdated?: boolean;
};

// ป้ายบอกว่าผลนี้เป็นข้อมูลจำลอง ไม่ได้บันทึก ใช้ร่วมกันใน Cash และ Sales preview
export const SimulatedNotice: React.FC<Props> = ({ kind, persisted, source, asOf, outdated }) => {
  const t = useT();
  return (
  <div role="status" className="rounded-xl border border-dashed border-attention/50 bg-attention-light/60 p-3 text-xs text-amber-950 space-y-1">
    <div className="flex flex-wrap items-center gap-2">
      <FlaskConical className="w-4 h-4 text-attention shrink-0" />
      <strong>{t("sim.title")}</strong>
      <DataKindBadge kind={kind} />
      <span className="rounded border border-amber-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold">
        {persisted === false ? t("sim.notSaved") : persisted ? t("sim.saved") : t("sim.saveUnknown")}
      </span>
    </div>
    <p className="text-[11px] leading-relaxed">
      {t("sim.body")}
      {source ? ` ${t("sim.source", { source })}` : ""}
      {asOf ? ` ${t("sim.asOf", { date: asOf })}` : ""}
    </p>
    {outdated && (
      <p className="animate-rise text-[11px] font-semibold text-danger">
        {t("sim.outdated")}
      </p>
    )}
  </div>
  );
};
