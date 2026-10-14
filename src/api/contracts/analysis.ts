import type { AIResponse, Envelope, HealthIndicator } from "./types";

export type FinancialInput = Record<string, unknown>;

export type FinancialMetric = {
  value: string | null;
  unit: string;
  formula: string;
  status: "ok" | "insufficient_data" | "undefined";
  missingFields: string[];
  reason: string | null;
};

export type BusinessGrade = {
  score: string | null;
  grade: "A" | "B" | "C" | "D" | null;
  status: "ok" | "insufficient_data";
  missingFields: string[];
  policyVersion: string;
  formula: string;
  notice: string;
  thresholds: Record<string, number>;
  components: Record<string, {
    score: string | null;
    weight: string;
    formula: string;
    rawValue: string | null;
    missingFields: string[];
    status: "ok" | "insufficient_data" | "undefined";
    reason: string | null;
  }>;
};

export type FinancialAnalysis = {
  input: FinancialInput;
  metrics: Record<string, FinancialMetric>;
  grading: BusinessGrade;
  indicators: HealthIndicator[];
  findings: {
    id: string;
    category: "strength" | "weakness" | "risk";
    severity: "critical" | "high" | "medium" | "low";
    text: string;
    evidenceIds: string[];
    action: { text: string; targetPage: string };
  }[];
  explanation: AIResponse;
  aiMode: "rules" | "openai";
  aiWarning: string | null;
  aiModel?: string;
  prioritizedFindingIds?: string[];
};

export type AnalysisEnvelope = Envelope<FinancialAnalysis> & {
  inputHash: string;
  schemaVersion: string;
};
