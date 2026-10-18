import { hasKey, tr } from "@/i18n";

/** Infrastructure failures differ from missing values in an imported workbook. */
export function databaseUnavailable(missing: string[], error = ""): boolean {
  return missing.includes("database_disabled") || /requires? DATABASE_URL/.test(error);
}

/**
 * Saved proposal or null. Without a database the backend still answers with an
 * empty placeholder (source "none", no orderId, all zeros). Those zeros are not
 * a real proposal, so they must read as "no data", never as ฿0.
 */
export function storedProposal<T extends { orderId?: string }>(
  envelope: { data: T | null; source?: string; missing?: string[] } | null,
): T | null {
  if (!envelope?.data) return null;
  if (envelope.source === "none" || (envelope.missing || []).includes("database_disabled")) return null;
  if (!envelope.data.orderId) return null;
  return envelope.data;
}

// รายการข้อมูลที่ขาด แปลตามภาษาที่เลือก (key อยู่ใน src/i18n: missing.<code>)

export function missingDataLabel(code: string): string {
  const key = `missing.${code}`;
  if (hasKey(key)) return tr(key);
  return code.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
