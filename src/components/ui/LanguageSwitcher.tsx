import React from "react";
import { Languages } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { languageOptions, useT } from "@/i18n";

// ปุ่มเลือกภาษา ไทย / English: compact = แบบย่อ (TH / EN) ไว้ใช้บนแถบด้านบน
export const LanguageSwitcher: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const t = useT();

  return (
    <div role="radiogroup" aria-label={t("lang.label")}
      className={`flex items-center gap-0.5 rounded-btn border border-borderLine bg-white p-0.5 ${compact ? "h-8" : "w-full"}`}>
      {compact && <Languages aria-hidden="true" className="mx-1 h-3.5 w-3.5 text-ink-muted" />}
      {languageOptions.map((option) => {
        const active = option.value === language;
        return (
          <button key={option.value} type="button" role="radio" aria-checked={active} lang={option.value}
            onClick={() => setLanguage(option.value)}
            title={option.label}
            aria-label={option.label}
            className={`press rounded-lg font-semibold transition-colors ${compact ? "px-2 py-1 text-[11px]" : "flex-1 py-1.5 text-xs"} ${
              active ? "bg-brand text-white shadow-sm" : "text-ink-muted hover:text-ink hover:bg-slate-50"}`}>
            {compact ? option.short : option.label}
          </button>
        );
      })}
    </div>
  );
};
