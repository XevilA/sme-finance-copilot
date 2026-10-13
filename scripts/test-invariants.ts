// ==========================================
// Invariant Verification Script for SME Finance Copilot
// Tests that mock seed data satisfies all mathematical invariants
// ==========================================

import {
  mockShops,
  mockOrder,
  mockSwarmProposal,
  mockShopFinances,
} from "../src/api/mock/seedData";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ INVARIANT VIOLATION: ${message}`);
    process.exit(1);
  }
  console.log(`✅ Passed: ${message}`);
}

console.log("🔍 Running Invariant Verification Suite for scenario: demo-300-boxes...\n");

// Invariant 1: Order quantity matching
const sumAssignedBoxesPerDay = mockSwarmProposal.shops.reduce(
  (acc, s) => acc + s.shareBoxesPerDay,
  0
);
assert(
  sumAssignedBoxesPerDay === mockOrder.quantityPerDay,
  `Sum of shops' capacity (${sumAssignedBoxesPerDay}) equals Order target (${mockOrder.quantityPerDay} boxes/day)`
);

// Invariant 2: Total quantity equals quantityPerDay * days
const calculatedTotalQuantity = mockOrder.quantityPerDay * mockOrder.days;
assert(
  calculatedTotalQuantity === mockOrder.totalQuantity,
  `Calculated total boxes (${calculatedTotalQuantity}) equals Order total quantity (${mockOrder.totalQuantity})`
);

// Invariant 3: Exactly 6 participating shops
assert(
  mockSwarmProposal.shops.length === 6,
  `Exactly 6 shops are assigned to the proposal (got ${mockSwarmProposal.shops.length})`
);

// Invariant 4: Sum of shop costs equals proposal total cost
const sumShopCosts = Object.values(mockShopFinances).reduce(
  (acc, sf) => acc + sf.totalCost,
  0
);
assert(
  sumShopCosts === mockSwarmProposal.totalCost,
  `Sum of individual shop costs (${sumShopCosts.toLocaleString()} ฿) equals proposal totalCost (${mockSwarmProposal.totalCost.toLocaleString()} ฿)`
);

// Invariant 5: Sum of shop revenue equals proposal total revenue
const sumShopRevenue = Object.values(mockShopFinances).reduce(
  (acc, sf) => acc + sf.revenue,
  0
);
assert(
  sumShopRevenue === mockSwarmProposal.totalRevenue,
  `Sum of shop revenues (${sumShopRevenue.toLocaleString()} ฿) equals proposal totalRevenue (${mockSwarmProposal.totalRevenue.toLocaleString()} ฿)`
);

// Invariant 6: Total profit equals Total revenue - Total cost
const calculatedProfit = mockSwarmProposal.totalRevenue - mockSwarmProposal.totalCost;
assert(
  calculatedProfit === mockSwarmProposal.totalProfit,
  `Proposal total profit (${mockSwarmProposal.totalProfit.toLocaleString()} ฿) matches calculated (${calculatedProfit.toLocaleString()} ฿)`
);

// Invariant 7: Exactly 2 shops have funding shortages
const shortageShops = mockSwarmProposal.shops.filter((s) => s.fundingGap > 0);
assert(
  shortageShops.length === 2,
  `Exactly 2 shops have a funding gap > 0 (found ${shortageShops.length}: ${shortageShops.map((s) => s.shopId).join(", ")})`
);

// Invariant 8: Sum of individual funding gaps equals proposal totalFundingGap
const sumFundingGap = mockSwarmProposal.shops.reduce(
  (acc, s) => acc + s.fundingGap,
  0
);
assert(
  sumFundingGap === mockSwarmProposal.totalFundingGap,
  `Sum of funding gaps (${sumFundingGap.toLocaleString()} ฿) equals proposal totalFundingGap (${mockSwarmProposal.totalFundingGap.toLocaleString()} ฿)`
);

// Invariant 9: For each individual shop, profit = revenue - totalCost
for (const [shopId, sf] of Object.entries(mockShopFinances)) {
  const diff = sf.revenue - sf.totalCost;
  assert(
    diff === sf.projectedProfit,
    `Shop ${shopId} (${sf.name}) profit invariant holds (${sf.revenue} - ${sf.totalCost} = ${sf.projectedProfit} ฿)`
  );
}

// Invariant 10: Deficit math: fundingGap = workingCapitalNeeded - currentCash (when workingCapitalNeeded > currentCash)
for (const shop of mockSwarmProposal.shops) {
  const expectedGap = Math.max(0, shop.workingCapitalNeeded - shop.currentCash);
  assert(
    shop.fundingGap === expectedGap,
    `Shop ${shop.shopId} funding gap invariant holds (needed: ${shop.workingCapitalNeeded}, cash: ${shop.currentCash} -> gap: ${shop.fundingGap})`
  );
}

console.log("\n🎉 ALL 10 INVARIANTS PASSED! Seed data is mathematically sound.");
