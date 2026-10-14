# Financial statement input

The supplied original workbook is stored locally as `Financial_Statement_Translated.xlsx`.
It is excluded from Git; the source file and its financial figures are not published.

## Supplied multi-statement workbook

Use `parsers.excel_parser.extract_statement_file()` for the supplied file, or
`extract_statement_workbook(content, filename)` for uploaded bytes.
The workbook contains English and Thai balance, income, cash flow, and equity
movement tables. Each statement has two reporting-period columns. The Thai
income table also has a notes column; it is not a financial amount column.

Extraction returns separate records with sheet, section, source column,
reporting-year/date metadata, currency, original scale, source cell references,
raw amounts, normalized fields, calculated metrics, and reconciliation checks.
Buddhist years are converted to Gregorian years. Million-unit cash amounts
are scaled to currency units without currency conversion.

Income-statement `Total expenses` is the operating subtotal before finance
costs and income tax. The engine's `total_expenses` includes those additional
costs exactly once. Negative expense presentation is normalized to positive
costs, while cash flows retain their signs. Financing totals labelled cash
used are normalized to outflows; CAPEX payments are positive expenditures.

Dash cells remain missing rather than becoming zero. Placeholder-year tables
with zero values are flagged as empty templates. Balance totals are validated
using `Assets = Liabilities + Equity`. Profit, expense subtotals, net cash flow,
and opening/closing cash are independently reconciled.

This workbook includes THB income and USD-million cash flow data with different
reporting dates. It cannot be treated as one SME financial record. No grade,
DSCR, or unrestricted cash reserve is inferred from this mixed workbook.
The canonical `parse_excel_file()` deliberately rejects this format with an
actionable error rather than passing mixed data to the existing analysis API.
Choose statements for the same business, currency, and period and provide the
remaining debt/reserve inputs before constructing a `FinancialInput`.
Equity movement tables are not substituted for balance-sheet equity.

The original workbook is read without modification. No formulas are executed;
formulas, Excel errors, duplicate totals, and oversized layouts are rejected.
Limits: 5 MiB uploaded, 25 MiB expanded, eight sheets, 256 rows/six columns per sheet.

## Canonical financial input

Use a `Financials` sheet with `field,value` in columns A and B. Thai headers
`รายการ,มูลค่า` and `รายการ,จำนวนเงิน` are also supported. Other sheet names can
be passed explicitly to `parse_excel_file(path, sheet_name="...")`.

Required fields: `currency` (`THB`), `kind` (`actual`, `forecast`, or `simulated`),
`period_start`, `period_end` (ISO dates or Excel dates), `assets`, `liabilities`, `equity`.
English and Thai financial labels are mapped in `parsers/excel_parser.py`.

Revenue and total expenses may be supplied as `Revenues` and `Expenses`.
Total expenses include COGS, operating expenses, interest, and income tax.
They are an alternative total, never an additional expense to sum with the categories.
Net income is derived only when both revenue and total expenses are explicitly supplied.

Keep missing optional inputs blank; enter a numeric zero only for a known zero.
Cash flows are signed. CAPEX, debt payments, revenue, and expenses are nonnegative.
Use numeric values or correctly grouped amount strings such as `1,000.00`.
Parenthesized negative amounts are accepted only for fields that permit negative values.
Formulas, Excel errors, duplicate aliases, unknown labels, and extra columns are rejected.
Limits: 5 MiB uploaded, 25 MiB expanded, 100 data rows.

Loan fields use `loan.principal`, `loan.annual_interest_rate`, `loan.periods`,
`loan.payments_per_year`, and optional `loan.timing` (`end` or `beginning`).
Interest rates are decimal fractions; `0.12` means 12% annually.
