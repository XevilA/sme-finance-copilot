// ==========================================
// SME Finance Copilot — API Contracts & Types
// ==========================================

export type DataKind = "actual" | "forecast" | "simulated";

export type EnvelopeStatus =
  | "ok"
  | "insufficient_data"
  | "stale"
  | "error"
  | "unavailable";

// Identity and revision the backend echoes back on every contextual response.
// An absent identity stays null; it is never inferred from a shop name.
export type AnalysisContext = {
  smeId: string | null;
  projectId: string | null;
  inputRevision: string | null;
  inputHash: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  scheduleCompleteThrough: string | null;
};

export type EvidenceRef = {
  id: string;
  label: string;
  targetId: string;
};

export type Envelope<T> = {
  data: T;
  kind: DataKind;
  status: EnvelopeStatus;
  // Always present on financial views. A nonempty list forbids claiming "ok".
  missing: string[];
  // stored_record | database | supplied_input | demo_dataset | provider | none.
  // Reading from the database does not make seed rows real customer data.
  source: string;
  asOf: string;
  analyzedAt?: string;
  evidenceRefs?: EvidenceRef[];
  unit?: string;
  period?: string;
  // Contextual POST responses echo the identity and hashes they consumed.
  context?: AnalysisContext;
  inputHash?: string;
  contextHash?: string;
  smeId?: string | null;
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

export type CashflowPreviewInput = {
  as_of: string;
  opening_cash: string;
  reserve: string;
  events: { date: string; type: FinancialEventType; title: string; amount: string;
    isInflow: boolean; partner?: string; impactReason?: string }[];
};

export type SalesPreviewInput = {
  products: { name: string; category: string; unitsSold: number; revenue: string;
    cost: string; turnoverDays: number }[];
  channels: { channel: string; grossSales: string; commissionFee: string;
    adCost: string; deliveryCost: string }[];
};

export type SalesPreviewResult = { products: ProductSales[]; channels: ChannelSales[] };

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

// Values served by the catalogue and by POST /funding/evaluate. The legacy demo
// fixture names are kept so mock mode stays type-checked against the same union.
export type FundingType =
  | "term_loan"
  | "po_financing"
  | "invoice_financing"
  | "grant"
  | "invoice_factoring"
  | "project_loan"
  | "soft_loan"
  | "crowdfunding";

export type FundingOption = {
  id: string;
  name: string;
  provider: string;
  providerLogo?: string;
  type: FundingType;
  typeLabel: string;
  maxAmount: number;
  minAmount: number;
  // Decimal fraction per year: 0.15 is 15%, not 0.15%.
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
  // Ranking evidence returned by the matcher. This is not a credit decision.
  postFundingDscr?: string | null;
  policyVersion?: string;
  notice?: string;
  missing?: string[];
};

// POST /api/v1/funding/evaluate — ranks the supplied statement, never a stored
// seed statement. requestedAmount null + requested_amount in missing means the
// gap is unknown; notRequired true means an explicit zero gap.
export type FundingEvaluation = {
  requestedAmount: string | null;
  notRequired: boolean | null;
  grade: string | null;
  gradeScore: string | null;
  funding: Record<string, unknown>[];
  investors: {
    investor_id: string;
    match_score: number;
    match_reason: string;
    status: "eligible" | "requires_info" | "not_eligible";
    missing: string[];
    notice?: string;
    policy_version?: string;
    assumptions?: string[];
  }[];
  options: FundingOption[];
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

// Categories stored in the chaos catalogue. The legacy fixture names are kept
// so mock fixtures stay type-checked. Reading a scenario does not run the engine.
export type ChaosCategory =
  | "capacity"
  | "cost"
  | "payment"
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
  // Unknown is null and named in the envelope's missing list. Known zero is 0.
  revenue: number | null;
  expense: number | null;
  netProfit: number | null;
  netProfitMargin: number | null;
  cashBalance: number | null;
  usableCashAfterReserve: number | null;
  reserveThreshold: number | null;
  period: string;
  lastPeriodDiff: {
    revenue: number | null;
    expense: number | null;
    netProfit: number | null;
    cashBalance: number | null;
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

// All five scalars are number | null. Known zero stays 0; unknown is null plus
// a name in missing, never a zero placeholder.
export type CostBreakdown = {
  categories: CostCategoryItem[];
  costPerUnit: number | null;
  profitPerUnit: number | null;
  breakevenUnits: number | null;
  currentMonthlyFixedCost: number | null;
  currentMonthlyVariableCost: number | null;
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
  // "rules" for the deterministic engine; a model run only reorders finding IDs.
  mode?: string;
  // Set when an optional provider call failed and rules output was used instead.
  warning?: string | null;
  policyVersion?: string;
};

// --- Runtime capability contract (GET /api/v1/capabilities) ---

export type Capability = {
  available: boolean;
  reason?: string;
  endpoint?: string;
  scope?: string;
  mode?: string;
  requiresDatabase?: boolean;
};

// Business transactions the backend deliberately does not implement. A false
// flag must render as an explicit unavailable state, never as a success toast.
export type Capabilities = {
  fundingApplication: Capability;
  agreementSignature: Capability;
  funderInfoRequest: Capability;
  reportExport: Capability;
  resourceReservation: Capability;
  orderPreview: Capability;
  orderResourceOutage: Capability;
  savedSimulationReplay: Capability;
  deterministicAnalysis: Capability;
  arbitraryChaosEffects: Capability;
};

// --- Dated forecast preview (POST /api/v1/forecast/preview) ---

export type ForecastDay = {
  date: string;
  inflow: string;
  outflow: string;
  net_change: string;
  cash_balance: string;
  event_ids: string[];
};

// Continued from the supplied statement's closing cash using dated rows of
// exactly this SME/project. Unknown horizons stay null; "conditional_" values
// rest on the engine's explicit settlement assumption, not a confirmed date.
export type ForecastPreview = {
  kind: DataKind;
  status: EnvelopeStatus;
  as_of: string;
  unit: string;
  opening_cash: string | null;
  schedule_complete_through: string | null;
  minimum_cash: string | null;
  minimum_cash_date: string | null;
  first_shortfall_date: string | null;
  first_negative_date: string | null;
  first_reserve_breach_date: string | null;
  minimum_cash_reserve: string | null;
  period_end_balances: Record<string, string | null>;
  conditional_minimum_cash: string | null;
  conditional_first_shortfall_date: string | null;
  conditional_period_end_balances: Record<string, string | null>;
  timeline: ForecastDay[];
};

// --- Stored order constraints (GET /api/v1/projects/{id}/constraints) ---

// SQL NULL / an omitted key / required_business_types null is unknown; an
// explicit [] means no type restriction. Omitted max_distance_km is unknown;
// explicit null means no distance limit.
export type OrderConstraints = {
  required_business_types: string[] | null;
  max_distance_km: string | null;
  buyer_coordinates: { latitude: string; longitude: string } | null;
  collection_schedule: { day_index: number; fraction: string }[] | null;
};

// --- Saved simulations (GET/POST /api/v1/simulations...) ---

export type SavedSimulationSummary = {
  simulationId: string;
  smeId: string | null;
  projectId: string | null;
  scenarioKey: string;
  createdAt: string;
  engine: string | null;
  context: Record<string, unknown> | null;
  // false for legacy partial saves; replay answers 409 for those.
  replayAvailable: boolean;
};

export type SavedSimulation = SavedSimulationSummary & {
  request: Record<string, unknown>;
  results: Record<string, unknown>;
  resultHash: string;
};

// Replay recomputes from the saved snapshot, not from current database values.
// reproduced=true means exact deterministic equality. Engine, context, revision
// or hash differences are reported in contextDifferences with status "stale".
export type SimulationReplay = {
  simulationId: string;
  reproduced: boolean;
  savedResultHash: string;
  recomputedResultHash: string;
  savedEngine: string | null;
  currentEngine: string;
  contextDifferences: string[];
  context: Record<string, unknown> | null;
  results: Record<string, unknown>;
  replaySource: string;
};

// --- Authenticated principal (GET /api/v1/auth/me) ---

// The role comes from the database when a token is presented. The header's role
// selector is a view filter and never authenticates anybody.
export type AuthPrincipal = {
  email: string | null;
  role: string | null;
  smeId: string | null;
  investorId: string | null;
  authenticated: boolean;
  method: string | null;
};
