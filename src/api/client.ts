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
        : typeof detail === "string" ? detail : `HTTP ${response.status}`;
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
    const res = await fetch(`${BASE_URL}/overview`);
    return res.json();
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
    const res = await fetch(`${BASE_URL}/cashflow/timeline`);
    return res.json();
  },

  async getShops(): Promise<Envelope<Shop[]>> {
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockShops, "actual", "ok");
    }
    const res = await fetch(`${BASE_URL}/shops`);
    return res.json();
  },

  async getOrder(): Promise<Envelope<SwarmOrder>> {
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockOrder, "actual", "ok");
    }
    const res = await fetch(`${BASE_URL}/order`);
    return res.json();
  },

  async getSwarmProposal(): Promise<Envelope<SwarmProposal>> {
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockSwarmProposal, "forecast", "ok");
    }
    const res = await fetch(`${BASE_URL}/swarm/proposal`);
    return res.json();
  },

  async getShopFinance(shopId: string): Promise<Envelope<ShopFinance | null>> {
    if (USE_MOCK) {
      await simulateLatency();
      const shop = mockShopFinances[shopId] || null;
      return wrapEnvelope(shop, "forecast", shop ? "ok" : "insufficient_data");
    }
    const res = await fetch(`${BASE_URL}/shops/${shopId}/finance`);
    return res.json();
  },

  async getFundingOptions(): Promise<Envelope<FundingOption[]>> {
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockFundingOptions, "forecast", "ok");
    }
    const res = await fetch(`${BASE_URL}/funding/options`);
    return res.json();
  },

  async getUnlockResources(): Promise<Envelope<UnlockResource[]>> {
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockUnlockResources, "actual", "ok");
    }
    const res = await fetch(`${BASE_URL}/unlock/resources`);
    return res.json();
  },

  async getChaosScenarios(): Promise<Envelope<ChaosScenario[]>> {
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockChaosScenarios, "simulated", "ok");
    }
    const res = await fetch(`${BASE_URL}/simulator/chaos`);
    return res.json();
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
    const res = await fetch(`${BASE_URL}/health/indicators`);
    return res.json();
  },

  async getCostBreakdown(): Promise<Envelope<CostBreakdown>> {
    if (!USE_MOCK && acceptedAnalysis) return structuredClone(acceptedAnalysis.views.cost);
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockCostBreakdown, "actual", "ok");
    }
    const res = await fetch(`${BASE_URL}/cost/breakdown`);
    return res.json();
  },

  async getProductSales(): Promise<Envelope<ProductSales[]>> {
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockProductSales, "actual", "ok");
    }
    const res = await fetch(`${BASE_URL}/sales/products`);
    return res.json();
  },

  async getChannelSales(): Promise<Envelope<ChannelSales[]>> {
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockChannelSales, "actual", "ok");
    }
    const res = await fetch(`${BASE_URL}/sales/channels`);
    return res.json();
  },

  async getFunderProjects(): Promise<Envelope<FunderProject[]>> {
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockFunderProjects, "forecast", "ok");
    }
    const res = await fetch(`${BASE_URL}/funder/projects`);
    return res.json();
  },

  async getProjectRecords(): Promise<Envelope<ProjectRecord[]>> {
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockProjectRecords, "actual", "ok");
    }
    const res = await fetch(`${BASE_URL}/projects`);
    return res.json();
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
    const res = await fetch(`${BASE_URL}/ai/explain?page=${pageId}`);
    return res.json();
  },
};

// Realistic micro-latency for smooth UI transition testing
function simulateLatency(ms: number = 80): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
