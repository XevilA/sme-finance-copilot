/**
 * Backend service layer for the SME SWARM Finance Engine.
 *
 * This file is additive and non-intrusive: it renders nothing, imports no
 * component, and touches no CSS, Tailwind class or layout. Pages opt in by
 * calling a function or hook from here and feeding the result into their own
 * existing state - the UI built by the frontend owner stays untouched.
 *
 * The mock-backed client in src/api/client.ts is left exactly as it is. Use
 * this module when you want the real FastAPI backend instead.
 *
 * Point it at the server with VITE_BACKEND_URL (defaults to the local uvicorn
 * address). Every call returns the backend envelope as-is, so `kind`, `status`
 * and `missing` stay available to the caller.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export const BACKEND_URL: string =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "http://127.0.0.1:8000";

/** Envelope every backend route returns. */
export type Envelope<T> = {
  data: T;
  kind: "actual" | "forecast" | "simulated";
  status: "ok" | "insufficient_data" | "stale" | "error";
  missing?: string[];
  asOf?: string;
  analyzedAt?: string;
  unit?: string;
  persisted?: boolean;
};

/** One financial metric, carrying its own formula and availability. */
export type Metric = {
  value: string | null;
  unit: string;
  formula: string;
  status: "ok" | "insufficient_data" | "undefined";
  missingFields: string[];
  reason: string | null;
};

export type MetricSet = Record<string, Metric>;

export type Grading = {
  score: string | null;
  grade: "A" | "B" | "C" | "D" | null;
  status: "ok" | "insufficient_data";
  missingFields: string[];
  components: Record<string, unknown>;
  policyVersion: string;
  formula: string;
  thresholds: Record<string, number>;
  notice: string;
};

export type CalculateResponse = Envelope<MetricSet> & {
  businessMetrics?: MetricSet;
  grading?: Grading;
  recordId: string | null;
};

export type UploadResponse = CalculateResponse & {
  input: Record<string, unknown>;
  upload: {
    filename: string;
    byteSize: number;
    contentSha256: string;
    uploadId: string | null;
    fileStored: false;
  };
};

export type SwarmProposalShop = {
  shopId: string;
  shareBoxesPerDay: number;
  workingCapitalNeeded: number;
  currentCash: number;
  fundingGap: number;
  status: "ready" | "review" | "blocked";
  assignedRole: string;
};

export type SwarmProposal = {
  orderId: string;
  shops: SwarmProposalShop[];
  totalCapacityAssigned: number;
  targetCapacity: number;
  deficitBoxesPerDay: number;
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  totalFundingGap: number;
  status: "ready" | "has_issues" | "incomplete";
  stuckReasons: {
    type: "capacity" | "funding" | "delivery";
    shopId?: string;
    title: string;
    message: string;
    actionLabel: string;
    actionTarget: string;
  }[];
  version: string;
};

export type MetricDelta = {
  status: "ok" | "unavailable";
  unit?: string;
  planA?: string;
  planB?: string;
  change?: string;
  changePct?: string | null;
  direction?: "up" | "down" | "flat";
  reason?: string;
};

export type SimulationResult = {
  scenarioKey: string;
  scenario: Record<string, unknown>;
  planA: { label: string; metrics: MetricSet; businessMetrics: MetricSet; grading: Grading };
  planB: { label: string; metrics: MetricSet; businessMetrics: MetricSet; grading: Grading };
  delta: {
    metrics: Record<string, MetricDelta>;
    businessMetrics: Record<string, MetricDelta>;
    grading: {
      planA: { grade: string | null; score: string | null };
      planB: { grade: string | null; score: string | null };
      gradeChanged: boolean;
      scoreChange?: string;
    };
    swarm?: Record<string, unknown>;
    summary: { improved: string[]; worsened: string[]; verdict: "better" | "worse" | "mixed" | "unchanged" };
  };
  assumptions: string[];
  notes: string[];
};

/** Thrown for any non-2xx response, with the backend's own detail attached. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, detail: unknown, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function unwrap<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!response.ok) {
    const detail = (body as { detail?: unknown })?.detail ?? body;
    throw new ApiError(response.status, detail, `${response.status} ${response.statusText}`);
  }
  return body as T;
}

async function postJson<T>(path: string, payload: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  return unwrap<T>(response);
}

// --- Endpoints ---------------------------------------------------------------

/** GET /health - cheap readiness probe; also reports whether writes are on. */
export async function health(signal?: AbortSignal) {
  return unwrap<{ status: string; service: string; persistence: boolean }>(
    await fetch(`${BACKEND_URL}/health`, { signal }),
  );
}

/** POST /api/upload - send a workbook; the file itself is never stored. */
export async function uploadStatement(
  file: File,
  options: { smeId?: string; persist?: boolean; signal?: AbortSignal } = {},
): Promise<UploadResponse> {
  const params = new URLSearchParams();
  if (options.smeId) params.set("sme_id", options.smeId);
  if (options.persist === false) params.set("persist", "false");
  const query = params.toString();

  const form = new FormData();
  form.append("file", file, file.name);

  const response = await fetch(`${BACKEND_URL}/api/upload${query ? `?${query}` : ""}`, {
    method: "POST",
    body: form,
    signal: options.signal,
  });
  return unwrap<UploadResponse>(response);
}

/** POST /api/calculate - metrics, unit economics and the A-D grade. */
export async function calculate(
  input: Record<string, unknown>,
  options: { smeId?: string; persist?: boolean; signal?: AbortSignal } = {},
): Promise<CalculateResponse> {
  return postJson<CalculateResponse>(
    "/api/calculate",
    { input, sme_id: options.smeId ?? null, persist: options.persist ?? true },
    options.signal,
  );
}

/** POST /api/analyze - narrative diagnosis; use_llm adds the model pass. */
export async function analyze(
  input: Record<string, unknown>,
  options: { useLlm?: boolean; signal?: AbortSignal } = {},
) {
  return postJson<Record<string, unknown>>(
    "/api/analyze",
    { input, use_llm: options.useLlm ?? false },
    options.signal,
  );
}

/** POST /api/swarm - allocate one order across shops and price each gap. */
export async function buildSwarm(
  request: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Envelope<SwarmProposal> & { projectId: string | null }> {
  return postJson("/api/swarm", request, signal);
}

/** GET /api/swarm/{orderRef} - read back a stored proposal. */
export async function getSwarm(orderRef: string, signal?: AbortSignal) {
  return unwrap<Envelope<Record<string, unknown>>>(
    await fetch(`${BACKEND_URL}/api/swarm/${encodeURIComponent(orderRef)}`, { signal }),
  );
}

/** POST /api/simulate - Plan A vs Plan B for a what-if scenario. */
export async function simulate(
  request: {
    input: Record<string, unknown>;
    scenario: Record<string, unknown>;
    swarm?: Record<string, unknown>;
    sme_id?: string | null;
    scenario_key?: string;
    persist?: boolean;
  },
  signal?: AbortSignal,
): Promise<Envelope<SimulationResult> & { simulationId: string | null }> {
  return postJson("/api/simulate", request, signal);
}

// --- Hooks -------------------------------------------------------------------

export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: ApiError | Error | null;
};

/**
 * Runs an async backend call and exposes {data, loading, error}. Pages keep
 * their own rendering; this only supplies the values.
 *
 * Pass `deps` so the call re-runs when its inputs change. In-flight requests
 * are aborted on unmount or when deps change, so a slow response cannot
 * overwrite a newer one.
 */
export function useBackend<T>(
  call: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = [],
  options: { enabled?: boolean } = {},
): AsyncState<T> & { refetch: () => void } {
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: enabled, error: null });
  const [nonce, setNonce] = useState(0);
  const callRef = useRef(call);
  callRef.current = call;

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const controller = new AbortController();
    let active = true;
    setState((previous) => ({ ...previous, loading: true, error: null }));

    callRef
      .current(controller.signal)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((error: Error) => {
        if (!active || error.name === "AbortError") return;
        setState({ data: null, loading: false, error });
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, ...deps]);

  const refetch = useCallback(() => setNonce((value) => value + 1), []);
  return { ...state, refetch };
}

/** Is the backend reachable? Useful for falling back to the mock client. */
export function useBackendHealth() {
  return useBackend((signal) => health(signal), []);
}

/**
 * Imperative action hook for POSTs driven by a user gesture (upload, run a
 * simulation). Nothing fires until `run` is called.
 */
export function useBackendAction<Args extends unknown[], T>(
  action: (...args: Args) => Promise<T>,
): AsyncState<T> & { run: (...args: Args) => Promise<T | null>; reset: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: false, error: null });

  const run = useCallback(
    async (...args: Args) => {
      setState({ data: null, loading: true, error: null });
      try {
        const data = await action(...args);
        setState({ data, loading: false, error: null });
        return data;
      } catch (error) {
        setState({ data: null, loading: false, error: error as Error });
        return null;
      }
    },
    [action],
  );

  const reset = useCallback(() => setState({ data: null, loading: false, error: null }), []);
  return { ...state, run, reset };
}
