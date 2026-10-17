/** Infrastructure failures differ from missing values in an imported workbook. */
export function databaseUnavailable(missing: string[], error = ""): boolean {
  return missing.includes("database_disabled") || /requires? DATABASE_URL/.test(error);
}

const labels: Record<string, string> = {
  dated_cash_events_for_imported_statement: "รายการเงินเข้า–ออกพร้อมวันที่ของงบที่นำเข้า",
  sme_identity_for_imported_statement: "การเชื่อมงบที่นำเข้ากับกิจการที่บันทึกไว้",
  product_sales_for_imported_statement: "ยอดขายแยกรายสินค้าของงวดนี้ (Excel มีเฉพาะยอดรวม)",
  channel_sales_for_imported_statement: "ยอดขายแยกช่องทางของงวดนี้ (Excel มีเฉพาะยอดรวม)",
  no_stored_swarm_project: "ออเดอร์และโครงการ SWARM ที่บันทึกไว้",
  no_shared_resources: "รายการทรัพยากรที่เปิดให้ใช้ร่วมกัน",
  no_sales_products: "รายการขายแยกสินค้า",
  no_sales_channels: "รายการขายแยกช่องทาง",
  rbac_not_enforced: "ระบบตรวจสิทธิ์ผู้ใช้งานจริงยังไม่ได้เปิด",
};

export function missingDataLabel(code: string): string { return labels[code] || code; }
