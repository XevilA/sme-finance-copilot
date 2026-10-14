# Financial statement input

Place the original workbook at `Financial_Statement_Translated.xlsx` in this directory.
The original file was not supplied; no business figures or substitute workbook have been created.

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
