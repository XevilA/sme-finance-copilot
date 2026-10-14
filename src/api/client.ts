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
import type { AnalysisEnvelope, FinancialInput } from "./contracts/analysis";

// Environment configuration
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";
const FINANCE_BASE_URL = (import.meta.env.VITE_FINANCE_API_BASE_URL || BASE_URL).replace(/\/$/, "");

async function financeRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${FINANCE_BASE_URL}${path}`, options);
  const payload = await response.json().catch(() => {
    throw new Error(`Finance API returned an unreadable response (${response.status}). Check the backend URL.`);
  });
  if (!response.ok) {
    const detail = payload.detail;
    const message = typeof detail === "string" ? detail : Array.isArray(detail)
      ? detail.map((item: { loc?: (string | number)[]; msg?: string }) => `${item.loc?.join(".") || "input"}: ${item.msg || "Invalid value"}`).join("; ")
      : `Finance API request failed (${response.status}).`;
    throw new Error(message);
  }
  return payload as T;
}

// Helper to wrap data into official API Envelope
function wrapEnvelope<T>(
  data: T,
  kind: "actual" | "forecast" | "simulated" = "actual",
  status: "ok" | "insufficient_data" | "stale" | "error" = "ok",
  missing?: string[],
  evidenceRefs?: { id: string; label: string; targetId: string }[]
): Envelope<T> {
  return {
    data,
    kind,
    status,
    missing,
    asOf: new Date().toISOString(),
    analyzedAt: new Date().toISOString(),
    evidenceRefs,
  };
}

// API Client implementation
export const apiClient = {
  getAnalysisTemplateUrl(): string {
    return `${FINANCE_BASE_URL}/analysis/template.xlsx`;
  },

  async getAnalysisExample(signal?: AbortSignal): Promise<Envelope<FinancialInput>> {
    return financeRequest("/analysis/example", { signal });
  },

  async analyzeFinancials(input: FinancialInput, useLlm = false, signal?: AbortSignal): Promise<AnalysisEnvelope> {
    return financeRequest("/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, use_llm: useLlm }), signal,
    });
  },

  async analyzeExcel(file: File, useLlm = false, signal?: AbortSignal): Promise<AnalysisEnvelope> {
    const body = new FormData();
    body.append("file", file);
    return financeRequest(`/analyze/excel?use_llm=${useLlm}`, { method: "POST", body, signal });
  },

  async getOverview(): Promise<Envelope<BusinessOverview>> {
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
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(
        mockHealthIndicators,
        "simulated",
        "ok",
        ["มูลค่าสินค้าคงเหลือของสด (ส่งผลต่อ DIO)"]
      );
    }
    const res = await fetch(`${BASE_URL}/health/indicators`);
    if (!res.ok) throw new Error(`Cannot load financial indicators (${res.status}). Use Calculate and analyze with the finance backend.`);
    return res.json();
  },

  async getCostBreakdown(): Promise<Envelope<CostBreakdown>> {
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
