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
};

export function missingDataLabel(code: string): string { return labels[code] || code; }
