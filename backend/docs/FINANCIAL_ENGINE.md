# Financial engine contract

Import `parsers.excel_parser.parse_excel_file` and
`engines.financial_engine.calculate_statement` with `backend` on the Python import path.
Existing manual and Excel API routes reuse the same validated contracts and calculations.
No frontend, route, or database changes are required.

Standalone Decimal functions: `calculate_net_profit`, `calculate_fcf`,
`calculate_dscr`, `calculate_pmt`, `calculate_roa`, `calculate_roe`,
`calculate_liquidity`, and `calculate_grade`.
ROA and ROE use average opening/closing balances and return period percentages.
No annualization is assumed. DSCR uses explicitly supplied CFADS divided by
principal plus interest due for the same reporting period. Zero denominators
return `None`; the statement result reports `undefined` rather than zero.
Missing inputs remain distinct from known zero values.

PMT is a positive installment with a nominal annual rate divided by payments
per year, fixed payments, and no fees or terminal balance. Payment timing is
explicit. This follows the rate/period conventions of
[Microsoft PMT documentation](https://support.microsoft.com/en-us/excel/functions/pmt-function).

The existing `demo-v1` grading policy normalizes each component to 0-100:

- DSCR: `clamp(100 * DSCR / 1.5, 0, 100)`.
- Cash flow: `clamp(100 * (operating_cash_flow / revenue) / 0.20, 0, 100)`.
- Debt burden: `clamp(100 * (1 - liabilities / assets), 0, 100)`.
- Cash reserve: `clamp(100 * reserve_months / 3, 0, 100)`;
  `reserve_months = cash_balance / (operating_cash_outflow * 30 / inclusive_period_days)`.

`G = 0.35 * DSCR_score + 0.30 * cash_flow_score + 0.20 * debt_burden_score + 0.15 * cash_reserve_score`.
The score is rounded to two decimal places, then graded A >=80, B >=65,
C >=50, otherwise D. Missing or undefined components produce no grade.
Explicit zero debt service and nonnegative CFADS score 100 for the DSCR
component while the raw DSCR remains undefined. These normalization targets
and grade thresholds are project demo policy, not lender approval criteria.
