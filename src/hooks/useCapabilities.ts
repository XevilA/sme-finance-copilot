// อ่าน GET /capabilities ครั้งเดียวต่อหน้า แทนที่จะเขียน useEnvelope ซ้ำทุกหน้า
// ถ้าโหลดไม่ได้หรือเป็น demo mode ให้ถือว่า "ไม่รองรับ" ไว้ก่อน
// (ห้ามเดาว่าฟีเจอร์ใช้งานได้)

import { useCallback } from "react";
import { apiClient } from "@/api/client";
import { Capabilities, Capability } from "@/api/contracts/types";
import { useEnvelope } from "@/hooks/useEnvelope";
import { TranslationKey, tr } from "@/i18n";

export type CapabilityName = keyof Capabilities;

const fallbackReason: Record<string, TranslationKey> = {
  business_contract_required: "capReason.businessContract",
  export_contract_required: "capReason.exportContract",
  quantity_and_time_contract_required: "capReason.reservationContract",
};

export function capabilityReason(capability: Capability | undefined, unknownText: string): string {
  if (!capability) return unknownText;
  if (capability.available) return "";
  if (capability.reason) return fallbackReason[capability.reason] ? tr(fallbackReason[capability.reason]) : capability.reason;
  if (capability.requiresDatabase) return tr("capReason.needsDatabase");
  return unknownText;
}

export function useCapabilities() {
  const load = useCallback(
    () => (apiClient.isDemoMode()
      ? Promise.reject(new Error(tr("capReason.demo")))
      : apiClient.getCapabilities()),
    [],
  );
  const state = useEnvelope<Capabilities>(load);
  const data = state.envelope?.data ?? null;

  // available เป็น true ก็ต่อเมื่อ backend ตอบมาว่า true เท่านั้น
  const isAvailable = (name: CapabilityName) => data?.[name]?.available === true;
  const reasonFor = (name: CapabilityName, unknownText = tr("capReason.unknown")) =>
    capabilityReason(data?.[name], state.error ? `${unknownText} (${state.error})` : unknownText);

  return { ...state, capabilities: data, isAvailable, reasonFor };
}
