import {
  Envelope,
  BusinessOverview,
  CashflowDay,
  Shop,
  SwarmOrder,
  SwarmProposal,
  ShopFinance,
  FundingOption,
  UnlockResource,
  ChaosScenario,
  HealthIndicator,
  CostBreakdown,
  ProductSales,
  ChannelSales,
  FunderProject,
  ProjectRecord,
  AIResponse,
} from "./contracts/types";

import {
  mockBusinessOverview,
  mockCashflowTimeline,
  mockShops,
  mockOrder,
  mockSwarmProposal,
  mockShopFinances,
  mockFundingOptions,
  mockUnlockResources,
  mockChaosScenarios,
  mockHealthIndicators,
  mockCostBreakdown,
  mockProductSales,
  mockChannelSales,
  mockFunderProjects,
  mockProjectRecords,
  mockAIExplanations,
} from "./mock/seedData";

// Environment configuration
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export type FinancialInput = {
  currency: "THB";
  kind: "actual" | "forecast" | "simulated";
  period_start: string;
  period_end: string;
  assets: string;
  liabilities: string;
  equity: string;
  units_sold?: number;
  loan?: Record<string, string | number>;
  [field: string]: unknown;
};

type Sourced<T> = Envelope<T> & { source: string };
export type AnalysisResult = Sourced<{
  input: FinancialInput;
  metrics: Record<string, { value: string | null }>;
  grading: { grade: string | null; score: string | null };
  [field: string]: unknown;
}> & {
  views: {
    overview: Sourced<BusinessOverview>;
    indicators: Sourced<HealthIndicator[]>;
    cost: Sourced<CostBreakdown>;
    explanation: Sourced<AIResponse>;
  };
};

// Accepted results belong to this browser tab, never to a server-global SME.
let acceptedAnalysis: AnalysisResult | null = null;
const orderContextMissing = new Map<string, string[]>();

export type OrderContext = {
  order_ref: string; buyer_name: string; target_capacity: string; unit: string;
  unit_price: string; duration_days: number; payment_terms_days: number; deposit_ratio: string;
  shops: { shop_id: string; name: string; cost_per_unit: string; capacity_total: string;
    capacity_used: string; cash_balance: string; minimum_cash_reserve: string;
    resources?: { title: string; status: string; available: boolean; required: boolean }[] | null; [key: string]: unknown }[];
  [key: string]: unknown;
};
export type OrderScenario = { unit_price: string; cost_per_unit: string | null; deposit_ratio: string; payment_terms_days: number };
export type OrderComparison = Sourced<{ planA: SwarmProposal & { minimumShopCash: string | null };
  planB: SwarmProposal & { minimumShopCash: string | null }; scope: string }> & { persisted: boolean; simulationId: string | null };

function requireBackend() {
  if (USE_MOCK) {
    throw new Error("โหมดตัวอย่างยังไม่คำนวณข้อมูลจริง กรุณาตั้ง VITE_USE_MOCK=false และ VITE_API_BASE_URL ก่อนใช้งาน");
  }
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${BASE_URL.replace(/\/$/, "")}${path}`, { ...init, signal: controller.signal });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = body?.detail;
      const message = Array.isArray(detail)
        ? detail.map((item: { loc?: string[]; msg?: string }) => `${item.loc?.join(".") || "input"}: ${item.msg || "Invalid input"}`).join("; ")
        : typeof detail === "string" ? detail : detail?.message || `HTTP ${response.status}`;
      throw new Error(message);
    }
    if (!body || typeof body !== "object") throw new Error("Backend ไม่ได้ส่ง JSON ที่ถูกต้อง");
    return body as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("หมดเวลารอ backend กรุณาลองใหม่");
    if (error instanceof TypeError) throw new Error("เชื่อมต่อ backend ไม่ได้ กรุณาตรวจ API URL และ CORS");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  requireBackend();
  return requestJson<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

// Helper to wrap data into official API Envelope
function wrapEnvelope<T>(
  data: T,
  kind: "actual" | "forecast" | "simulated" = "actual",
  status: "ok" | "insufficient_data" | "stale" | "error" = "ok",
  missing?: string[],
  evidenceRefs?: { id: string; label: string; targetId: string }[]
): Sourced<T> {
  return {
    data,
    kind,
    status: missing?.length && status === "ok" ? "insufficient_data" : status,
    source: "demo_dataset",
    missing,
    asOf: new Date().toISOString(),
    analyzedAt: new Date().toISOString(),
    evidenceRefs,
  };
}

// API Client implementation
export const apiClient = {
  isDemoMode: () => USE_MOCK,
  async getOrderContext(): Promise<Sourced<OrderContext>> {
    requireBackend();
    const result = await requestJson<Sourced<OrderContext>>("/simulator/context");
    orderContextMissing.set(result.data.order_ref, result.missing || []);
    return result;
  },

  async simulateOrder(baseline: OrderContext, scenario: OrderScenario, persist = false): Promise<OrderComparison> {
    return postJson("/simulate/order", { baseline, scenario, persist, context_missing: orderContextMissing.get(baseline.order_ref) || [] });
  },

  async assembleSwarm(context: OrderContext): Promise<Sourced<SwarmProposal> & { audit: { eligibility: Record<string, { eligible: boolean; reasons: string[] }> } }> {
    const result = await postJson<Sourced<SwarmProposal> & { audit: { eligibility: Record<string, { eligible: boolean; reasons: string[] }> } }>("/swarm", { ...context, persist: false });
    result.missing = [...new Set([...(result.missing || []), ...(orderContextMissing.get(context.order_ref) || [])])];
    if (result.missing.length) result.status = "insufficient_data";
    return result;
  },
  async validateManual(input: FinancialInput): Promise<{ data: FinancialInput; balanceSheetValid: boolean; source: string }> {
    return postJson("/inputs/manual", input);
  },

  async calculate(input: FinancialInput): Promise<Sourced<unknown>> {
    return postJson("/calculate", { input, persist: false });
  },

  async uploadStatement(file: File): Promise<{ input: FinancialInput; source: string; persisted: boolean }> {
    requireBackend();
    if (!/\.xlsx$/i.test(file.name)) throw new Error("Backend รองรับเฉพาะ .xlsx ตาม Template กรุณาแปลง .xls/.csv ก่อน");
    if (!file.size || file.size > 5 * 1024 * 1024) throw new Error("ไฟล์ต้องไม่ว่างและมีขนาดไม่เกิน 5 MiB ตามข้อจำกัด backend");
    const body = new FormData();
    body.append("file", file);
    return requestJson("/upload?persist=false", { method: "POST", body });
  },

  async analyze(input: FinancialInput, shopName?: string): Promise<AnalysisResult> {
    const result = await postJson<AnalysisResult>("/analyze", { input, shop_name: shopName || null, use_llm: false });
    if (!result.views || !result.data?.metrics || !result.source) throw new Error("Backend ยังไม่รองรับผลวิเคราะห์สำหรับ dashboard กรุณาอัปเดต server");
    acceptedAnalysis = result;
    return result;
  },

  async downloadTemplate(): Promise<void> {
    requireBackend();
    const response = await fetch(`${BASE_URL.replace(/\/$/, "")}/analysis/template.xlsx`);
    if (!response.ok) throw new Error(`ดาวน์โหลด Template ไม่สำเร็จ: HTTP ${response.status}`);
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "financial-template.xlsx";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  async getOverview(): Promise<Envelope<BusinessOverview>> {
    if (!USE_MOCK && acceptedAnalysis) return structuredClone(acceptedAnalysis.views.overview);
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(
        mockBusinessOverview,
        "actual",
        "ok",
        undefined,
        [
          { id: "ev-ov1", label: "สมุดบัญชีเงินฝากกระแสรายวัน กสิกรไทย", targetId: "stat-cash-balance" },
          { id: "ev-ov2", label: "รายงานภาษี ภ.พ.30 เดือน ก.ย.–ต.ค.", targetId: "stat-net-profit" },
        ]
      );
    }
    return requestJson(`/overview`);
  },

  async getCashflowTimeline(): Promise<Envelope<CashflowDay[]>> {
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(
        mockCashflowTimeline,
        "forecast",
        "ok",
        undefined,
        [
          { id: "ev-cf1", label: "กำหนดการชำระเงินตามสัญญา PO #STP-2026-091", targetId: "time-travel-scrubber" },
        ]
      );
    }
    return requestJson(`/cashflow/timeline`);
  },

  async getShops(): Promise<Envelope<Shop[]>> {
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockShops, "actual", "ok");
    }
    return requestJson(`/shops`);
  },

  async getOrder(): Promise<Envelope<SwarmOrder>> {
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockOrder, "actual", "ok");
    }
    return requestJson(`/order`);
  },

  async getSwarmProposal(): Promise<Envelope<SwarmProposal>> {
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockSwarmProposal, "forecast", "ok");
    }
    return requestJson(`/swarm/proposal`);
  },

  async getShopFinance(shopId: string): Promise<Envelope<ShopFinance | null>> {
    if (USE_MOCK) {
      await simulateLatency();
      const shop = mockShopFinances[shopId] || null;
      return wrapEnvelope(shop, "forecast", shop ? "ok" : "insufficient_data");
    }
    return requestJson(`/shops/${shopId}/finance`);
  },

  async getFundingOptions(): Promise<Envelope<FundingOption[]>> {
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockFundingOptions, "forecast", "ok");
    }
    return requestJson(`/funding/options`);
  },

  async getUnlockResources(): Promise<Envelope<UnlockResource[]>> {
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockUnlockResources, "actual", "ok");
    }
    return requestJson(`/unlock/resources`);
  },

  async getChaosScenarios(): Promise<Envelope<ChaosScenario[]>> {
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockChaosScenarios, "simulated", "ok");
    }
    return requestJson(`/simulator/chaos`);
  },

  async getHealthIndicators(): Promise<Envelope<HealthIndicator[]>> {
    if (!USE_MOCK && acceptedAnalysis) return structuredClone(acceptedAnalysis.views.indicators);
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(
        mockHealthIndicators,
        "actual",
        "ok",
        ["มูลค่าสินค้าคงเหลือของสด (ส่งผลต่อ DIO)"]
      );
    }
    return requestJson(`/health/indicators`);
  },

  async getCostBreakdown(): Promise<Envelope<CostBreakdown>> {
    if (!USE_MOCK && acceptedAnalysis) return structuredClone(acceptedAnalysis.views.cost);
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockCostBreakdown, "actual", "ok");
    }
    return requestJson(`/cost/breakdown`);
  },

  async getProductSales(): Promise<Envelope<ProductSales[]>> {
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockProductSales, "actual", "ok");
    }
    return requestJson(`/sales/products`);
  },

  async getChannelSales(): Promise<Envelope<ChannelSales[]>> {
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockChannelSales, "actual", "ok");
    }
    return requestJson(`/sales/channels`);
  },

  async getFunderProjects(): Promise<Envelope<FunderProject[]>> {
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockFunderProjects, "forecast", "ok");
    }
    return requestJson(`/funder/projects`);
  },

  async getProjectRecords(): Promise<Envelope<ProjectRecord[]>> {
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockProjectRecords, "actual", "ok");
    }
    return requestJson(`/projects`);
  },

  async getAIExplanation(pageId: string): Promise<Envelope<AIResponse>> {
    if (!USE_MOCK && acceptedAnalysis) {
      const view = structuredClone(acceptedAnalysis.views.explanation);
      view.data.pageId = pageId;
      return view;
    }
    if (USE_MOCK) {
      await simulateLatency();
      const explanation = mockAIExplanations[pageId] || mockAIExplanations.overview;
      return wrapEnvelope(explanation, "forecast", "ok");
    }
    return requestJson(`/ai/explain?page=${pageId}`);
  },
};

// Realistic micro-latency for smooth UI transition testing
function simulateLatency(ms: number = 80): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
