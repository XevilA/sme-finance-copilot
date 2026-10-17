// Active data context for this browser tab.
//
// One accepted analysis, one identity, one input revision. Everything that
// renders imported numbers reads from here so Overview, Health, Cost, AI,
// Funding and Forecast cannot drift onto different inputs or silently fall
// back to a stored seed statement.
//
// Rules enforced here:
//   * An accepted result belongs to the revision it was computed from. When the
//     draft moves on, the result is marked stale instead of being replaced by
//     default seed data, and instead of being presented as current.
//   * Every context change bumps an epoch. A response carrying an older epoch
//     is discarded rather than allowed to overwrite a newer request.
//   * An absent identity stays null. It is never inferred from a shop name.
//
// No financial value is computed in this module.

import {
  AIResponse,
  AnalysisContext,
  BusinessOverview,
  CostBreakdown,
  Envelope,
  ForecastPreview,
  HealthIndicator,
} from "./contracts/types";

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

export type AnalysisViews = {
  overview: Envelope<BusinessOverview>;
  indicators: Envelope<HealthIndicator[]>;
  cost: Envelope<CostBreakdown>;
  explanation: Envelope<AIResponse>;
  forecast?: Envelope<ForecastPreview | null>;
};

export type AnalysisResult = Envelope<{
  input: FinancialInput;
  metrics: Record<string, { value: string | null }>;
  grading: { grade: string | null; score: string | null };
  // "rules" for the deterministic engine; a model run only reorders finding IDs.
  aiMode?: string;
  // Set when an optional provider call failed and rules output was used.
  aiWarning?: string | null;
  [field: string]: unknown;
}> & {
  views: AnalysisViews;
};

export type AcceptedAnalysis = {
  result: AnalysisResult;
  context: AnalysisContext;
  input: FinancialInput;
  revision: string;
  inputHash: string;
  acceptedAt: string;
};

export type RequestContext = {
  sme_id?: string | null;
  project_id?: string | null;
  input_revision?: string | null;
  expected_input_hash?: string | null;
  schedule_complete_through?: string | null;
};

let accepted: AcceptedAnalysis | null = null;
let draftRevision: string | null = null;
let epoch = 1;
const listeners = new Set<() => void>();

function notify(): void {
  epoch += 1;
  for (const listener of [...listeners]) listener();
}

/** Monotonic counter. Bumped by every accept, invalidate or identity change. */
export function contextEpoch(): number {
  return epoch;
}

/** Subscribe to context changes so a page can reload and drop stale results. */
export function subscribeAnalysis(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAcceptedAnalysis(): AcceptedAnalysis | null {
  return accepted;
}

/**
 * True when a result was accepted and the draft has since moved to another
 * revision. The result stays readable and keeps its own evidence, but it must
 * be presented as stale and must not be described as the current analysis.
 */
export function isAcceptedStale(): boolean {
  return Boolean(accepted && draftRevision && accepted.revision !== draftRevision);
}

/** The identity the active analysis was computed for, or null before import. */
export function activeContext(): AnalysisContext | null {
  return accepted ? accepted.context : null;
}

/** Context fields to send with a contextual POST, so every page agrees. */
export function activeRequestContext(): RequestContext {
  if (!accepted) return {};
  return {
    sme_id: accepted.context.smeId,
    project_id: accepted.context.projectId,
    input_revision: accepted.revision,
    schedule_complete_through: accepted.context.scheduleCompleteThrough,
  };
}

export function acceptAnalysis(entry: AcceptedAnalysis): void {
  accepted = entry;
  draftRevision = entry.revision;
  notify();
}

/** Drop the accepted analysis entirely, for example on sign-out. */
export function clearAcceptedAnalysis(): void {
  if (!accepted && draftRevision === null) return;
  accepted = null;
  draftRevision = null;
  notify();
}

/**
 * Record which draft revision the user is editing. Called on every draft edit.
 * Moving away from the accepted revision marks the accepted result stale; it
 * does not reinstate stored defaults in its place.
 */
export function noteDraftRevision(revision: string): void {
  if (draftRevision === revision) return;
  const wasStale = isAcceptedStale();
  draftRevision = revision;
  if (isAcceptedStale() !== wasStale) notify();
}

export function draftRevisionId(): string | null {
  return draftRevision;
}

/**
 * Stable identity for a draft. This is an opaque client revision used to detect
 * edits and to discard responses computed from an older draft. It is not
 * authentication and it is not a financial value.
 */
export function revisionFor(input: unknown): string {
  const canonical = canonicalJson(input);
  // FNV-1a, two independent offsets, so short edits cannot collide silently.
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let index = 0; index < canonical.length; index += 1) {
    const code = canonical.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ ((code + index) & 0xff), 0x811c9dc5) >>> 0;
  }
  return `draft-${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}`;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}
