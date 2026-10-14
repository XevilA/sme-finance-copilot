// ==========================================
// SME Finance Copilot — API Contracts & Types
// ==========================================

export type DataKind = "actual" | "forecast" | "simulated";

export type EnvelopeStatus = "ok" | "insufficient_data" | "stale" | "error";

export type EvidenceRef = {
  id: string;
  label: string;
  targetId: string;
};

export type Envelope<T> = {
  data: T;
  kind: DataKind;
  status: EnvelopeStatus;
  missing?: string[]; // Used when status === 'insufficient_data'
  asOf: string;
  analyzedAt?: string;
  evidenceRefs?: EvidenceRef[];
  unit?: string;
  period?: string;
};

// --- Shop & Swarm Types ---

export type ShopStatus = "ready" | "review" | "blocked";

export type Shop = {
  id: string;
  name: string;
  monogram: string;
  category: string;
  capacityTotal: number;
  capacityUsed: number;
  capacityAvailable: number;
  unit: string;
  status: ShopStatus;
  statusNote: string;
  costPerUnit: number;
  workingCapitalNeeded: number;
  currentCash: number;
  fundingGap: number;
  location: string;
  tags: string[];
  evidenceRefs?: EvidenceRef[];
};

export type SwarmOrder = {
  id: string;
  title: string;
  buyerName: string;
  buyerRating: number;
  quantityPerDay: number;
  days: number;
  totalQuantity: number;
  unitPrice: number;
  budgetTotal: number;
  targetDeliveryDate: string;
  deliveryLocation: string;
  standard: string;
  paymentTerms: string;
};

export type StuckReasonType = "capacity" | "funding" | "delivery";

export type StuckReason = {
  type: StuckReasonType;
  shopId?: string;
  title: string;
  message: string;
  actionLabel: string;
  actionTarget: string;
};

export type SwarmProposalShop = {
  shopId: string;
  shareBoxesPerDay: number;
  workingCapitalNeeded: number;
  currentCash: number;
  fundingGap: number;
  status: ShopStatus;
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
  stuckReasons: StuckReason[];
  version: string;
};

// --- Cashflow & Timeline Types ---

export type FinancialEventType =
  | "buy_materials"
  | "produce"
  | "deliver"
  | "receive_payment"
  | "pay_obligations";

export type FinancialEvent = {
  id: string;
  date: string;
  dayIndex: number;
  type: FinancialEventType;
  title: string;
  amount: number;
  isInflow: boolean;
  shopId?: string;
  partner?: string;
  status: "confirmed" | "projected" | "simulated";
  impactReason: string;
  evidenceRefs?: EvidenceRef[];
};

export type CashflowDay = {
  date: string;
  dayIndex: number;
  actualCash?: number;
  projectedCash: number;
  simulatedCash?: number;
  reserveLine: number;
  inflow: number;
  outflow: number;
  netChange: number;
  isDeficit: boolean;
  deficitAmount?: number;
  events: FinancialEvent[];
};

export type ShopFinance = {
  shopId: string;
  name: string;
  monogram: string;
  boxesPerDay: number;
  totalBoxes: number;
  sellingPricePerBox: number;
  revenue: number;
  rawMaterialCost: number;
  additionalLaborCost: number;
  deliveryCost: number;
  serviceFee: number;
  totalCost: number;
  projectedProfit: number;
  profitMarginPercent: number;
  upfrontCashNeeded: number;
  currentCash: number;
  minCashBalance: number;
  fundingGap: number;
  status: ShopStatus;
  cashTimeline: {
    dayIndex: number;
    date: string;
    type: FinancialEventType;
    title: string;
    amount: number;
    cashBalance: number;
    note: string;
  }[];
  partyAcceptance: {
    buyerSigned: boolean;
    shopSigned: boolean;
    logisticsSigned: boolean;
    funderSigned: boolean;
  };
};

// --- Funding Types ---

export type FundingType = "invoice_factoring" | "project_loan" | "soft_loan" | "crowdfunding";

export type FundingOption = {
  id: string;
  name: string;
  provider: string;
  providerLogo?: string;
  type: FundingType;
  typeLabel: string;
  maxAmount: number;
  minAmount: number;
  interestRateAnnual: number;
  termMonths: number;
  disbursementDays: number;
  monthlyPayment: number;
  totalRepayment: number;
  impactOnCash: string;
  requiredDocs: string[];
  eligibilityConditions: string[];
  matchScore: number; // 0 - 100
  matchReason: string;
  status: "eligible" | "requires_info" | "not_eligible";
};

// --- SME UNLOCK Resource Types ---

export type ResourceCategory = "kitchen" | "truck" | "machine" | "team" | "space";

export type UnlockResource = {
  id: string;
  title: string;
  category: ResourceCategory;
  categoryLabel: string;
  ownerShop: string;
  location: string;
  capacityText: string;
  priceText: string;
  unitPrice: number;
  availability: string;
  status: "offered" | "confirmed";
  isDetached?: boolean;
  imageUrl?: string;
  impactIfDetached: {
    additionalCost: number;
    delayDays: number;
    bottleneckMessage: string;
    affectedShopIds: string[];
  };
};

// --- Chaos Rehearsal Types ---

export type ChaosCategory =
  | "shop_dropout"
  | "raw_material_surge"
  | "delayed_payment"
  | "truck_unavailable"
  | "late_funding";

export type ContingencyOption = {
  id: string;
  title: string;
  actionText: string;
  savingsOrMitigation: string;
  targetPage: string;
  payload?: Record<string, unknown>;
};

export type ChaosScenario = {
  id: string;
  title: string;
  category: ChaosCategory;
  severity: "low" | "medium" | "high";
  description: string;
  triggerNodeId: string;
  propagationPath: string[]; // Node IDs in sequence
  cashImpactAmount: number;
  deficitDays: number[];
  contingencyOptions: ContingencyOption[];
  calculatedResults: {
    revenueLoss: number;
    additionalCost: number;
    newDeficitAmount: number;
    deliveryDelayDays: number;
  };
};

// --- Business Overview & Health Indicators ---

export type ActionableItemType = "deficit_warning" | "due_item" | "expense_review" | "pending_plan";

export type ActionableItem = {
  id: string;
  type: ActionableItemType;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  dueDate?: string;
  amount?: number;
  actionText: string;
  targetPage: string;
};

export type BusinessOverview = {
  shopName: string;
  revenue: number;
  expense: number;
  netProfit: number;
  cashBalance: number;
  usableCashAfterReserve: number;
  reserveThreshold: number;
  period: string;
  lastPeriodDiff: {
    revenue: number;
    expense: number;
    netProfit: number;
    cashBalance: number;
  };
  cashVsProfitInsight: string;
  actionableItems: ActionableItem[];
  weeklyTrend: {
    week: string;
    income: number;
    expense: number;
    cash: number;
  }[];
};

export type HealthCategory = "liquidity" | "profitability" | "debt" | "efficiency" | "growth";

export type HealthIndicator = {
  id: string;
  category: HealthCategory;
  name: string;
  nameEn: string;
  value: number | null;
  unit: string;
  benchmark: string;
  status: "good" | "warning" | "danger" | "insufficient";
  trend: number[];
  formula: string;
  interpretation: string;
  missingFields?: string[];
  evidenceRefs?: EvidenceRef[];
};

// --- Cost & Investment Types ---

export type CostCategoryItem = {
  name: string;
  amount: number;
  percentage: number;
  color: string;
};

export type InvestmentPlan = {
  id: string;
  name: string;
  initialInvestment: number;
  expectedMonthlyCashflow: number;
  paybackMonths: number;
  npv: number;
  irr: number;
  assumptions: {
    key: string;
    label: string;
    value: number;
    unit: string;
  }[];
};

export type CostBreakdown = {
  categories: CostCategoryItem[];
  costPerUnit: number;
  profitPerUnit: number;
  breakevenUnits: number;
  currentMonthlyFixedCost: number;
  currentMonthlyVariableCost: number;
  investmentPlans: InvestmentPlan[];
};

// --- Sales & Channel Types ---

export type ProductSales = {
  id: string;
  name: string;
  category: string;
  unitsSold: number;
  revenue: number;
  cost: number;
  profit: number;
  profitMarginPercent: number;
  turnoverDays: number;
  velocity: "fast" | "normal" | "slow";
};

export type ChannelSales = {
  channel: string;
  grossSales: number;
  commissionFee: number;
  adCost: number;
  deliveryCost: number;
  netProfit: number;
  netMarginPercent: number;
};

// --- Funder View Types ---

export type EvidenceLevel = "interest" | "quotation" | "confirmed_po";

export type FunderProject = {
  id: string;
  title: string;
  enterpriseName: string;
  category: string;
  location: string;
  targetFunding: number;
  fundingGap: number;
  fundPurpose: string;
  evidenceLevel: EvidenceLevel;
  evidenceLevelBadge: string;
  evidenceDocuments: {
    title: string;
    verified: boolean;
    date: string;
  }[];
  riskLevel: "low" | "medium" | "high";
  readyResources: string[];
  roiEstimatePercent: number;
  durationMonths: number;
  allocationRecommended: boolean;
  recommendationDecision: "recommend" | "insufficient_data" | "reduced_amount_possible" | "not_recommended";
  recommendationNote: string;
  hasAccessPermission: boolean;
};

// --- Projects & Post Mortem ---

export type ProjectRecord = {
  id: string;
  code: string;
  title: string;
  clientName: string;
  status: "draft" | "under_review" | "pending_approval" | "in_progress" | "completed" | "issue";
  statusText: string;
  progressPercent: number;
  version: string;
  totalBudget: number;
  totalShops: number;
  startDate: string;
  deliveryDate: string;
  deliverySchedule: {
    day: number;
    date: string;
    targetUnits: number;
    deliveredUnits: number;
    status: "done" | "on_schedule" | "delayed";
  }[];
  postMortem?: {
    plannedUnits: number;
    actualUnits: number;
    unitsFulfillmentPercent: number;
    plannedCost: number;
    actualCost: number;
    costVariancePercent: number;
    plannedPaymentDate: string;
    actualPaymentDate: string;
    paymentDelayDays: number;
    shopNetProfits: {
      shopName: string;
      profit: number;
      actualCashRemaining: number;
    }[];
  };
};

// --- AI Panel Types ---

export type AISuggestion = {
  text: string;
  actionLabel?: string;
  targetPage?: string;
};

export type AIResponse = {
  pageId: string;
  summary: string;
  reasoning: string;
  dataUsed: {
    id: string;
    refNum: number;
    label: string;
    value: string;
    targetElementId: string;
  }[];
  suggestions: (AISuggestion | string)[];
  unknowns: string[];
  staleWarning?: string;
  mode?: "rules" | "openai";
  policyVersion?: string;
  warning?: string | null;
};
