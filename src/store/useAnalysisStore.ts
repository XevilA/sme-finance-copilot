import { create } from "zustand";
import type { AnalysisEnvelope } from "@/api/contracts/analysis";

type AnalysisState = {
  result: AnalysisEnvelope | null;
  inputJson: string;
  isStale: boolean;
  setInputJson: (json: string) => void;
  setResult: (result: AnalysisEnvelope) => void;
  markStale: () => void;
};

// Per-browser memory only: never publish a user's latest analysis globally.
export const useAnalysisStore = create<AnalysisState>((set) => ({
  result: null,
  inputJson: "",
  isStale: false,
  setInputJson: (inputJson) => set((state) => ({ inputJson, isStale: state.result !== null })),
  setResult: (result) => set({ result, inputJson: JSON.stringify(result.data.input, null, 2), isStale: false }),
  markStale: () => set((state) => ({ isStale: state.result !== null })),
}));
