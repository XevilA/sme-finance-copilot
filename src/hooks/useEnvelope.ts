// Shared data-loading hooks.
//
// Every page that renders backend data uses these so three rules hold in one
// place rather than being re-implemented per page:
//
//   1. A response from an older request never overwrites a newer one. Each load
//      carries a sequence number and the data context epoch it started under.
//   2. Changing the data context (accepting an analysis, editing the draft that
//      produced it) reloads the page instead of leaving older numbers on screen.
//   3. A failure ends the load. It leaves an error, never a permanent skeleton.
//
// These hooks move data; they never compute a financial value.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Envelope } from "@/api/contracts/types";
import {
  AcceptedAnalysis,
  contextEpoch,
  getAcceptedAnalysis,
  isAcceptedStale,
  subscribeAnalysis,
} from "@/api/activeAnalysis";

/** Re-renders whenever the accepted analysis, identity or draft revision moves. */
export function useAnalysisEpoch(): number {
  return useSyncExternalStore(subscribeAnalysis, contextEpoch, contextEpoch);
}

export type AnalysisContextState = {
  accepted: AcceptedAnalysis | null;
  /** Accepted result exists but the draft has moved to another revision. */
  stale: boolean;
  epoch: number;
};

export function useAnalysisContext(): AnalysisContextState {
  const epoch = useAnalysisEpoch();
  return { accepted: getAcceptedAnalysis(), stale: isAcceptedStale(), epoch };
}

export type EnvelopeState<T> = {
  envelope: Envelope<T> | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

/**
 * Loads one envelope and keeps only the newest answer.
 *
 * `deps` behaves like an effect dependency list. The data context epoch is
 * always part of it, so accepting an analysis or editing its draft reloads.
 */
export function useEnvelope<T>(load: () => Promise<Envelope<T>>, deps: unknown[] = []): EnvelopeState<T> {
  const epoch = useAnalysisEpoch();
  const [envelope, setEnvelope] = useState<Envelope<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const loader = useRef(load);
  loader.current = load;
  const sequence = useRef(0);

  useEffect(() => {
    const id = ++sequence.current;
    const startedAt = epoch;
    setLoading(true);
    setError(null);
    loader
      .current()
      .then((result) => {
        // Discard a reply that belongs to a superseded request or context.
        if (sequence.current !== id || contextEpoch() !== startedAt) return;
        setEnvelope(result);
        setLoading(false);
      })
      .catch((failure: unknown) => {
        if (sequence.current !== id || contextEpoch() !== startedAt) return;
        setEnvelope(null);
        setError(failure instanceof Error ? failure.message : "Could not load data.");
        setLoading(false);
      });
    return () => {
      // A unmount or dependency change retires the in-flight request.
      ++sequence.current;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epoch, attempt, ...deps]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { envelope, loading, error, reload };
}

/**
 * Guard for an action that writes or computes. Returns a runner that refuses to
 * start while a previous run is in flight, so a double click cannot submit the
 * same operation twice.
 */
export function useSingleFlight(): {
  running: boolean;
  run: <T>(operation: () => Promise<T>) => Promise<T | undefined>;
} {
  const [running, setRunning] = useState(false);
  const busy = useRef(false);
  const run = useCallback(async <T,>(operation: () => Promise<T>): Promise<T | undefined> => {
    if (busy.current) return undefined;
    busy.current = true;
    setRunning(true);
    try {
      return await operation();
    } finally {
      busy.current = false;
      setRunning(false);
    }
  }, []);
  return { running, run };
}

/**
 * Maps an envelope onto the page state the shared renderer understands.
 * A nonempty missing list is never reported as a complete result.
 */
export function envelopeMode<T>(
  state: EnvelopeState<T>,
  isEmpty: (data: T) => boolean,
): "loading" | "error" | "unavailable" | "insufficient_data" | "stale" | "normal" {
  if (state.loading) return "loading";
  if (state.error || !state.envelope) return "error";
  const { status, data } = state.envelope;
  if (status === "unavailable") return "unavailable";
  if (status === "error") return "error";
  if (data == null || isEmpty(data)) return "insufficient_data";
  if (status === "stale") return "stale";
  return "normal";
}
