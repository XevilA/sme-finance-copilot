/** Infrastructure failures differ from missing values in an imported workbook. */
export function databaseUnavailable(missing: string[], error = ""): boolean {
  return missing.includes("database_disabled") || /requires? DATABASE_URL/.test(error);
}

const labels: Record<string, string> = {
  dated_cash_events_for_imported_statement: "Dated cash inflows and outflows for the imported statement",
  sme_identity_for_imported_statement: "Link between the imported statement and a saved business",
  product_sales_for_imported_statement: "Product-level sales for this period (the Excel file contains totals only)",
  channel_sales_for_imported_statement: "Channel-level sales for this period (the Excel file contains totals only)",
  no_stored_swarm_project: "Saved SWARM orders and projects",
  no_shared_resources: "Resources available for sharing",
  no_sales_products: "Product-level sales records",
  no_sales_channels: "Channel-level sales records",
  rbac_not_enforced: "User access control is not enabled",
  cash_balance: "Closing cash balance",
  operating_cash_flow: "Operating cash flow",
  investing_cash_flow: "Investing cash flow",
  financing_cash_flow: "Financing cash flow",
  revenue: "Revenue",
  cost_of_goods_sold: "Cost of goods sold",
  total_expenses: "Total expenses",
  net_income: "Net income",
  units_sold: "Units sold",
  current_assets: "Current assets",
  current_liabilities: "Current liabilities",
  opening_assets: "Opening assets",
  opening_equity: "Opening equity",
};

export function missingDataLabel(code: string): string {
  return labels[code] || code.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
