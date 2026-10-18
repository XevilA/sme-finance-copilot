// ระบบเปลี่ยนภาษา (ไทย / English)
// en คือต้นฉบับ ส่วน th ต้องมีครบทุก key (ถ้าขาด TypeScript จะ error ตอน build)
// แปลเฉพาะข้อความบนหน้าจอเท่านั้น ข้อความที่ backend ส่งมา (เช่น คำอธิบาย AI) ยังเป็นภาษาเดิม

import { useCallback } from "react";
import { Language, useAppStore } from "@/store/useAppStore";
import { en } from "./en";
import { th } from "./th";

export type TranslationKey = keyof typeof en;
export type Dictionary = Record<TranslationKey, string>;
type Vars = Record<string, string | number>;

const dictionaries: Record<Language, Dictionary> = { en, th };

export const languageOptions: { value: Language; label: string; short: string }[] = [
  { value: "th", label: "ไทย", short: "TH" },
  { value: "en", label: "English", short: "EN" },
];

// แทน {name} ในข้อความด้วยค่าที่ส่งมา
function fill(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

export function translate(language: Language, key: TranslationKey, vars?: Vars): string {
  return fill(dictionaries[language][key] ?? en[key] ?? key, vars);
}

/** ใช้นอก React component (เช่นใน helper) อ่านภาษาปัจจุบันจาก store */
export function tr(key: TranslationKey, vars?: Vars): string {
  return translate(useAppStore.getState().language, key, vars);
}

/** ใช้ใน component: re-render เมื่อเปลี่ยนภาษา */
export function useT() {
  const language = useAppStore((s) => s.language);
  return useCallback((key: TranslationKey, vars?: Vars) => translate(language, key, vars), [language]);
}

/** แปลง key แบบ dynamic เช่น `nav.${id}` (ถ้าไม่มี key นี้ก็คืนค่า fallback) */
export function hasKey(key: string): key is TranslationKey {
  return key in en;
}
