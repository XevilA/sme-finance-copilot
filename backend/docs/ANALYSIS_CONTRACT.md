# Financial Analysis v1

The original eight metrics in `calculate_financials` stay compatible. The
`/api/calculate` and `/api/v1/calculate` routes add `businessMetrics` and `grading`.
The existing top-level calculation status describes the original eight metrics;
each additional metric and the grading object carry their own status.

Additional inputs are optional: revenue, cost_of_goods_sold, operating_expenses,
interest_expense, tax_expense, operating_cash_outflow, units_sold, unit_price,
variable_cost_per_unit, fixed_costs, initial_investment and investment_net_gain.
Missing expenses are not zero. When all income-statement fields and net_income
are supplied, they must reconcile within THB 0.01. Units sold must be a
nonnegative integer. Excel uses the same field names and validation contract.

## Business metrics

Gross profit is revenue minus cost of goods sold. Operating profit additionally
subtracts operating expenses. Net profit additionally subtracts interest expense
and tax expense. Total cost includes all four expense categories.
Cost per unit is (cost of goods sold + operating expenses) / units sold;
it excludes interest and tax. Contribution per unit is selling price minus
variable cost per unit. Break-even units round fixed costs / contribution
up to the next whole unit. A nonpositive contribution has no finite break-even.
Simple ROI is investment net gain / initial investment * 100, for the supplied
period. It is not annualized and does not imply an NPV or IRR calculation.
Debt ratio is liabilities / assets. Reserve months use a normalized 30-day
cash operating outflow, not accrual operating expenses or principal repayments.

## Grading policy: demo-v1

All component scores are clamped to 0..100:

| Component | Weight | Normalization |
| --- | --- | --- |
| DSCR | 0.35 | 100 * DSCR / 1.5 |
| Cash flow | 0.30 | 100 * (operating cash flow / revenue) / 0.20 |
| Debt burden | 0.20 | 100 * (1 - liabilities / assets) |
| Cash reserve | 0.15 | 100 * reserve months / 3 |

Period days include both endpoints. Monthly outflow is operating_cash_outflow
* 30 / period_days. Explicit zero principal and interest due with nonnegative
cash available score 100 for debt service; raw DSCR remains undefined, never
infinity. Negative cash available with no debt service is undefined.

The weighted score is rounded half up to two places, then graded: A >=80,
B >=65, C >=50, D <50. Missing or undefined components produce a null grade
and null score; weights are never redistributed. Component formulas, raw
values, scores and policy version are returned for audit. This is a hackathon
policy, not lender approval, an industry benchmark, or a calibrated default
probability. Financial distress is also reported independently of the score.

`examples/analysis_input.json` is synthetic and has grade B, score 75.00.
