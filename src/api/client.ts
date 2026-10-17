import {
  Envelope,
  AnalysisContext,
  AuthPrincipal,
  BusinessOverview,
  Capabilities,
  CashflowDay,
  Shop,
  SwarmOrder,
  SwarmProposal,
  ShopFinance,
  FundingOption,
  FundingEvaluation,
  ForecastPreview,
  OrderConstraints,
  SavedSimulation,
  SavedSimulationSummary,
  SimulationReplay,
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
  acceptAnalysis,
  AnalysisResult,
  AnalysisViews,
  contextEpoch,
  FinancialInput,
  getAcceptedAnalysis,
  isAcceptedStale,
  RequestContext,
  revisionFor,
} from "./activeAnalysis";

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

export type { FinancialInput, AnalysisResult, AnalysisViews, RequestContext };
export type { AnalysisContext };

// Re-exported so consumers and tests observe one shared data context instance
// rather than a second copy of the module's state.
export {
  acceptAnalysis,
  clearAcceptedAnalysis,
  contextEpoch,
  draftRevisionId,
  getAcceptedAnalysis,
  isAcceptedStale,
  noteDraftRevision,
  revisionFor,
  subscribeAnalysis,
} from "./activeAnalysis";

type Sourced<T> = Envelope<T> & { source: string };

export type OrderContext = {
  order_ref: string; buyer_name: string; target_capacity: string; unit: string;
  unit_price: string; duration_days: number; payment_terms_days: number; deposit_ratio: string;
  shops: { shop_id: string; name: string; cost_per_unit: string; capacity_total: string;
    capacity_used: string; cash_balance: string; minimum_cash_reserve: string;
    resources?: { resource_id?: string; title: string; status: string; available: boolean; required: boolean }[] | null; [key: string]: unknown }[];
  [key: string]: unknown;
};
// Four existing controls plus the two optional engine-backed exclusions.
// Only identifiers present in the baseline may be removed or disabled.
export type OrderScenario = {
  unit_price: string; cost_per_unit: string | null; deposit_ratio: string; payment_terms_days: number;
  remove_shops?: string[]; unavailable_resource_ids?: string[];
};
export type OrderComparison = Sourced<{ planA: SwarmProposal & { minimumShopCash: string | null };
  planB: SwarmProposal & { minimumShopCash: string | null }; scope: string }> & {
  persisted: boolean; simulationId: string | null; engine?: string };

// Order identity learned from GET /simulator/context, kept so preview, save and
// scoped reads all name the same project rather than a default active order.
export type OrderIdentity = { orderRef: string; projectId: string | null; missing: string[]; constraints: OrderConstraints | null };

const orderIdentities = new Map<string, OrderIdentity>();

// --- Token transport -------------------------------------------------------
// CORS accepts Authorization for configured origins. Enforcement is off in the
// demo configuration, so a token is attached only when one has been stored by
// a real sign-in. No credential is embedded here and the header role selector
// never authenticates anybody.

const TOKEN_KEY = "sme-finance-auth-token-v1";
let authToken: string | null = readStoredToken();

function readStoredToken(): string | null {
  try {
    const stored = sessionStorage.getItem(TOKEN_KEY);
    return stored && stored.trim() ? stored : null;
  } catch {
    return null; // A blocked session store must not break anonymous reads.
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly missing: string[];
  constructor(message: string, status: number, missing: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.missing = missing;
  }
}

function requireBackend() {
  if (USE_MOCK) {
    throw new Error("โหมดตัวอย่างยังไม่คำนวณข้อมูลจริง กรุณาตั้ง VITE_USE_MOCK=false และ VITE_API_BASE_URL ก่อนใช้งาน");
  }
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const headers = new Headers(init.headers || {});
    if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
    const response = await fetch(`${BASE_URL.replace(/\/$/, "")}${path}`, { ...init, headers, signal: controller.signal });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = (body as { detail?: unknown } | null)?.detail;
      const message = Array.isArray(detail)
        ? detail.map((item: { loc?: string[]; msg?: string }) => `${item.loc?.join(".") || "input"}: ${item.msg || "Invalid input"}`).join("; ")
        : typeof detail === "string" ? detail : (detail as { message?: string } | undefined)?.message || `HTTP ${response.status}`;
      if (response.status === 401) throw new ApiError("ต้องเข้าสู่ระบบก่อนเรียกข้อมูลนี้ (HTTP 401)", 401);
      if (response.status === 403) throw new ApiError("บัญชีนี้ไม่มีสิทธิ์เรียกข้อมูลนี้ (HTTP 403)", 403);
      throw new ApiError(message, response.status);
    }
    if (!body || typeof body !== "object") throw new ApiError("Backend ไม่ได้ส่ง JSON ที่ถูกต้อง", response.status);
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw new ApiError("หมดเวลารอ backend กรุณาลองใหม่", 0);
    if (error instanceof TypeError) throw new ApiError("เชื่อมต่อ backend ไม่ได้ กรุณาตรวจ API URL และ CORS", 0);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  requireBackend();
  return requestJson<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

// Drop keys the caller does not know. An omitted optional field means unknown;
// sending null or 0 in its place would assert something the user never entered.
function withContext(body: Record<string, unknown>, context?: RequestContext): Record<string, unknown> {
  const merged = { ...body };
  for (const [key, value] of Object.entries(context || {})) {
    if (value !== undefined && value !== null && value !== "") merged[key] = value;
  }
  return merged;
}

// Helper to wrap data into official API Envelope
function wrapEnvelope<T>(
  data: T,
  kind: "actual" | "forecast" | "simulated" = "actual",
  status: Envelope<T>["status"] = "ok",
  missing?: string[],
  evidenceRefs?: { id: string; label: string; targetId: string }[]
): Sourced<T> {
  return {
    data,
    kind,
    status: missing?.length && status === "ok" ? "insufficient_data" : status,
    source: "demo_dataset",
    missing: missing || [],
    asOf: new Date().toISOString(),
    analyzedAt: new Date().toISOString(),
    evidenceRefs,
  };
}

/**
 * Explicit "no evidence for this view" envelope.
 *
 * Used when an imported statement is active but the view needs evidence a
 * financial aggregate cannot produce — dated cash events, product mix, channel
 * mix. Reading the stored default SME instead would silently swap the user's
 * imported statement for seed data, so the view reports what is missing.
 */
function unavailableEnvelope<T>(data: T, missing: string[], kind: Envelope<T>["kind"] = "actual"): Sourced<T> {
  return { data, kind, status: "unavailable", source: "none", missing, asOf: "", analyzedAt: new Date().toISOString() };
}

function acceptedView<K extends keyof AnalysisViews>(view: K): AnalysisViews[K] | null {
  const accepted = getAcceptedAnalysis();
  if (USE_MOCK || !accepted) return null;
  const copy = structuredClone(accepted.result.views[view]) as Envelope<unknown>;
  if (!copy) return null;
  // An accepted result computed from a superseded draft stays readable with its
  // own evidence, but it is reported as stale rather than as the current answer.
  if (isAcceptedStale()) {
    copy.status = "stale";
    copy.missing = [...new Set([...(copy.missing || []), "input_revision_superseded_by_draft"])];
  }
  return copy as AnalysisViews[K];
}

// API Client implementation
export const apiClient = {
  isDemoMode: () => USE_MOCK,
  /** Epoch of the data context a result was requested under. */
  contextEpoch,
  authToken: () => authToken,
  setAuthToken(token: string | null) {
    authToken = token && token.trim() ? token : null;
    try {
      if (authToken) sessionStorage.setItem(TOKEN_KEY, authToken);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch { /* Token transport still works for this page without a store. */ }
  },
  async login(email: string, password: string): Promise<AuthPrincipal> {
    const result = await postJson<{ data: AuthPrincipal & { token?: string } }>("/auth/login", { email, password });
    if (result.data?.token) apiClient.setAuthToken(result.data.token);
    return result.data;
  },
  async logout(): Promise<void> {
    try { await postJson("/auth/logout", {}); } finally { apiClient.setAuthToken(null); }
  },
  async getPrincipal(): Promise<AuthPrincipal> {
    requireBackend();
    return (await requestJson<{ data: AuthPrincipal }>("/auth/me")).data;
  },

  /** Business transactions the backend declares available or unavailable. */
  async getCapabilities(): Promise<Sourced<Capabilities>> {
    requireBackend();
    return requestJson<Sourced<Capabilities>>("/capabilities");
  },

  async getOrderContext(): Promise<Sourced<OrderContext> & OrderIdentity> {
    requireBackend();
    const result = await requestJson<Sourced<OrderContext> & { projectId?: string | null; constraints?: OrderConstraints | null }>("/simulator/context");
    const identity: OrderIdentity = {
      orderRef: result.data.order_ref,
      projectId: result.projectId ?? null,
      missing: result.missing || [],
      constraints: result.constraints ?? null,
    };
    orderIdentities.set(identity.orderRef, identity);
    return { ...result, ...identity };
  },

  /** Stored constraint snapshot. data null means no snapshot was recorded. */
  async getProjectConstraints(projectId: string): Promise<Sourced<OrderConstraints | null>> {
    requireBackend();
    return requestJson<Sourced<OrderConstraints | null>>(`/projects/${projectId}/constraints`);
  },

  async simulateOrder(baseline: OrderContext, scenario: OrderScenario, persist = false): Promise<OrderComparison> {
    const identity = orderIdentities.get(baseline.order_ref);
    const body: Record<string, unknown> = {
      baseline, scenario, persist, context_missing: identity?.missing || [],
    };
    if (identity?.projectId) body.project_id = identity.projectId;
    const accepted = getAcceptedAnalysis();
    // A linked revision is a reference to the imported analysis, not a claim
    // that the order baseline equals that financial statement.
    if (accepted) body.input_revision = accepted.revision;
    return postJson<OrderComparison>("/simulate/order", body);
  },

  /** Saved plans are scoped. An unscoped list is refused with HTTP 422. */
  async listSimulations(scope: { projectId?: string | null; smeId?: string | null; orderRef?: string | null }, limit = 30): Promise<Sourced<SavedSimulationSummary[]>> {
    requireBackend();
    const query = new URLSearchParams();
    if (scope.projectId) query.set("project_id", scope.projectId);
    if (scope.smeId) query.set("sme_id", scope.smeId);
    if (scope.orderRef) query.set("order_ref", scope.orderRef);
    if (!query.toString()) throw new ApiError("ต้องระบุ project, SME หรือเลขออเดอร์ก่อนอ่านแผนที่บันทึกไว้", 422);
    query.set("limit", String(limit));
    return requestJson<Sourced<SavedSimulationSummary[]>>(`/simulations?${query.toString()}`);
  },

  async readSimulation(simulationId: string, scope: { projectId?: string | null; smeId?: string | null; orderRef?: string | null }): Promise<Sourced<SavedSimulation>> {
    requireBackend();
    const query = new URLSearchParams();
    if (scope.projectId) query.set("project_id", scope.projectId);
    if (scope.smeId) query.set("sme_id", scope.smeId);
    if (scope.orderRef) query.set("order_ref", scope.orderRef);
    if (!query.toString()) throw new ApiError("ต้องระบุ project, SME หรือเลขออเดอร์ก่อนอ่านแผนที่บันทึกไว้", 422);
    return requestJson<Sourced<SavedSimulation>>(`/simulations/${simulationId}?${query.toString()}`);
  },

  /** Replays the saved snapshot. No JSON body; scope and revision are query. */
  async replaySimulation(simulationId: string, scope: { projectId?: string | null; smeId?: string | null; orderRef?: string | null; inputRevision?: string | null }): Promise<Sourced<SimulationReplay>> {
    requireBackend();
    const query = new URLSearchParams();
    if (scope.projectId) query.set("project_id", scope.projectId);
    if (scope.smeId) query.set("sme_id", scope.smeId);
    if (scope.orderRef) query.set("order_ref", scope.orderRef);
    if (!query.toString()) throw new ApiError("ต้องระบุ project, SME หรือเลขออเดอร์ก่อน replay แผนที่บันทึกไว้", 422);
    if (scope.inputRevision) query.set("input_revision", scope.inputRevision);
    return requestJson<Sourced<SimulationReplay>>(`/simulations/${simulationId}/replay?${query.toString()}`, { method: "POST" });
  },

  async assembleSwarm(context: OrderContext): Promise<Sourced<SwarmProposal> & { audit: { eligibility: Record<string, { eligible: boolean; reasons: string[] }> }; persisted: boolean }> {
    const identity = orderIdentities.get(context.order_ref);
    const body = withContext({ ...context, persist: false }, identity?.projectId ? { project_id: identity.projectId } : undefined);
    const result = await postJson<Sourced<SwarmProposal> & { audit: { eligibility: Record<string, { eligible: boolean; reasons: string[] }> }; persisted: boolean }>("/swarm", body);
    result.missing = [...new Set([...(result.missing || []), ...(identity?.missing || [])])];
    if (result.missing.length) result.status = "insufficient_data";
    return result;
  },

  async validateManual(input: FinancialInput): Promise<{ data: FinancialInput; balanceSheetValid: boolean; source: string }> {
    return postJson("/inputs/manual", input);
  },

  async calculate(input: FinancialInput, context?: RequestContext): Promise<Sourced<unknown>> {
    return postJson("/calculate", withContext({ input, persist: false }, context));
  },

  async uploadStatement(file: File): Promise<{ input: FinancialInput; source: string; persisted: boolean }> {
    requireBackend();
    if (!/\.xlsx$/i.test(file.name)) throw new Error("Backend รองรับเฉพาะ .xlsx ตาม Template กรุณาแปลง .xls/.csv ก่อน");
    if (!file.size || file.size > 5 * 1024 * 1024) throw new Error("ไฟล์ต้องไม่ว่างและมีขนาดไม่เกิน 5 MiB ตามข้อจำกัด backend");
    const body = new FormData();
    body.append("file", file);
    return requestJson("/upload?persist=false", { method: "POST", body });
  },

  /**
   * Accepts one analysis for this tab. The supplied revision identifies the
   * draft it was computed from, so a later edit marks the result stale instead
   * of letting it be presented as the current answer.
   */
  async analyze(input: FinancialInput, shopName?: string, context?: RequestContext): Promise<AnalysisResult> {
    const revision = context?.input_revision || revisionFor(input);
    const result = await postJson<AnalysisResult>("/analyze", withContext(
      { input, shop_name: shopName || null, use_llm: false },
      { ...context, input_revision: revision },
    ));
    if (!result.views || !result.data?.metrics || !result.source) throw new Error("Backend ยังไม่รองรับผลวิเคราะห์สำหรับ dashboard กรุณาอัปเดต server");
    acceptAnalysis({
      result,
      // Identity comes from the response, never from the free-text shop name.
      context: result.context || {
        smeId: null, projectId: null, inputRevision: revision, inputHash: result.inputHash || null,
        periodStart: null, periodEnd: null, scheduleCompleteThrough: null,
      },
      input: result.data.input || input,
      revision,
      inputHash: result.inputHash || "",
      acceptedAt: new Date().toISOString(),
    });
    return result;
  },

  /**
   * Ranks funding against the supplied statement. The amount defaults to this
   * input's own computed funding gap; an unknown gap returns requestedAmount
   * null with requested_amount in missing and no candidates.
   */
  async evaluateFunding(input: FinancialInput, options: RequestContext & { amount?: string | null; sector?: string | null } = {}): Promise<Sourced<FundingEvaluation> & { persisted: boolean }> {
    const { amount, sector, ...context } = options;
    const body: Record<string, unknown> = { input };
    if (amount !== undefined && amount !== null) body.amount = amount;
    if (sector) body.sector = sector;
    return postJson<Sourced<FundingEvaluation> & { persisted: boolean }>("/funding/evaluate", withContext(body, context));
  },

  /** Dated forecast continued from the supplied statement's closing cash. */
  async previewForecast(input: FinancialInput, context?: RequestContext): Promise<Sourced<ForecastPreview | null>> {
    return postJson<Sourced<ForecastPreview | null>>("/forecast/preview", withContext({ input }, context));
  },

  async downloadTemplate(): Promise<void> {
    requireBackend();
    const headers = new Headers();
    if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
    const response = await fetch(`${BASE_URL.replace(/\/$/, "")}/analysis/template.xlsx`, { headers });
    if (!response.ok) throw new Error(`ดาวน์โหลด Template ไม่สำเร็จ: HTTP ${response.status}`);
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "financial-template.xlsx";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  async getOverview(): Promise<Envelope<BusinessOverview>> {
    const accepted = acceptedView("overview");
    if (accepted) return accepted;
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
    if (!USE_MOCK && getAcceptedAnalysis()) {
      // A statement total carries no dated cash events, and the stored default
      // SME belongs to a different statement. Report the gap instead.
      return unavailableEnvelope<CashflowDay[]>([], ["dated_cash_events_for_imported_statement", "sme_identity_for_imported_statement"], "forecast");
    }
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
    const accepted = acceptedView("indicators");
    if (accepted) return accepted;
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
    const accepted = acceptedView("cost");
    if (accepted) return accepted;
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockCostBreakdown, "actual", "ok");
    }
    return requestJson(`/cost/breakdown`);
  },

  async getProductSales(): Promise<Envelope<ProductSales[]>> {
    if (!USE_MOCK && getAcceptedAnalysis()) {
      // Financial totals do not contain a per-product breakdown.
      return unavailableEnvelope<ProductSales[]>([], ["product_sales_for_imported_statement"]);
    }
    if (USE_MOCK) {
      await simulateLatency();
      return wrapEnvelope(mockProductSales, "actual", "ok");
    }
    return requestJson(`/sales/products`);
  },

  async getChannelSales(): Promise<Envelope<ChannelSales[]>> {
    if (!USE_MOCK && getAcceptedAnalysis()) {
      // Financial totals do not contain a per-channel split either.
      return unavailableEnvelope<ChannelSales[]>([], ["channel_sales_for_imported_statement"]);
    }
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
    const accepted = acceptedView("explanation");
    if (accepted) {
      accepted.data.pageId = pageId;
      return accepted;
    }
    if (USE_MOCK) {
      await simulateLatency();
      const explanation = mockAIExplanations[pageId] || mockAIExplanations.overview;
      return wrapEnvelope(explanation, "forecast", "ok");
    }
    return requestJson(`/ai/explain?page=${encodeURIComponent(pageId)}`);
  },
};

// Realistic micro-latency for smooth UI transition testing
function simulateLatency(ms: number = 80): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
