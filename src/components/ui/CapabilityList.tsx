import React from "react";
import { CheckCircle2, CircleSlash, RefreshCw } from "lucide-react";
import { CapabilityName, useCapabilities } from "@/hooks/useCapabilities";
import { TranslationKey, useT } from "@/i18n";

// ชื่อที่อ่านง่ายของแต่ละ capability ใน GET /capabilities
const labels: Record<CapabilityName, TranslationKey> = {
  deterministicAnalysis: "cap.deterministicAnalysis",
  orderPreview: "cap.orderPreview",
  orderResourceOutage: "cap.orderResourceOutage",
  savedSimulationReplay: "cap.savedSimulationReplay",
  fundingApplication: "cap.fundingApplication",
  agreementSignature: "cap.agreementSignature",
  funderInfoRequest: "cap.funderInfoRequest",
  reportExport: "cap.reportExport",
  resourceReservation: "cap.resourceReservation",
  arbitraryChaosEffects: "cap.arbitraryChaosEffects",
};

// แสดงว่าฟีเจอร์ไหน backend รองรับจริง อันไหนยังไม่รองรับ (ตามที่ server ตอบ)
export const CapabilityList: React.FC = () => {
  const { capabilities, loading, error, reload, reasonFor } = useCapabilities();
  const t = useT();

  return (
    <section className="rounded-card border border-borderLine bg-white p-4 space-y-3" aria-labelledby="capability-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="capability-title" className="font-display font-bold text-sm text-ink">{t("cap.title")}</h2>
          <p className="text-[11px] text-ink-muted">{t("cap.subtitle")}</p>
        </div>
        <button type="button" onClick={reload} className="text-[11px] font-semibold text-brand flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> {t("common.checkAgain")}
        </button>
      </div>

      {loading && <p role="status" className="text-xs text-ink-muted">{t("cap.loading")}</p>}
      {!loading && !capabilities && (
        <p role="alert" className="text-xs text-ink-muted">
          {t("cap.error", { error: error ? `: ${error}` : "" })}
        </p>
      )}
      {capabilities && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.keys(labels) as CapabilityName[]).map((name, index) => {
            const available = capabilities[name]?.available === true;
            return (
              <li key={name} style={{ animationDelay: `${index * 40}ms` }} className={`animate-rise flex items-start gap-2 rounded-lg border p-2 text-xs ${available ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-slate-50"}`}>
                {available
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  : <CircleSlash className="w-4 h-4 text-ink-muted shrink-0 mt-0.5" />}
                <div>
                  <div className="font-semibold text-ink">{t(labels[name])}</div>
                  <div className="text-[11px] text-ink-muted">
                    {available ? t("cap.available") : `${t("cap.unavailable")} · ${reasonFor(name, t("cap.noReason"))}`}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
