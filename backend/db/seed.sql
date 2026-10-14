-- Demo rows for local development. Fixed UUIDs so the same ids work in every
-- demo, Postman collection and screenshot. Safe to re-run.

INSERT INTO sme_profiles (id, name, monogram, sector, province, unit,
                          capacity_total, capacity_used, cost_per_unit,
                          cash_balance, minimum_cash_reserve)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'Baan Suan Kitchen', 'BS', 'food_processing', 'Nonthaburi', 'box',
   600, 100, 60.00, 5000000.00, 200000.00),
  ('22222222-2222-4222-8222-222222222222', 'Rung Charoen Foods', 'RC', 'food_processing', 'Pathum Thani', 'box',
   400, 0, 70.00, 180000.00, 150000.00),
  ('33333333-3333-4333-8333-333333333333', 'Sahai Packing Co', 'SP', 'packaging', 'Samut Prakan', 'box',
   900, 450, 55.00, 1200000.00, 300000.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO funding_products (id, name, provider, type, min_amount, max_amount,
                              interest_rate_annual, term_months, disbursement_days,
                              min_dscr, required_docs, eligibility)
VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'SME Working Capital Term Loan', 'Bank A', 'term_loan',
   100000.00, 5000000.00, 0.0725, 36, 14, 1.2000,
   '["Company registration", "12-month bank statement", "Latest financial statement"]'::jsonb,
   '["Operating for at least 2 years", "DSCR of at least 1.2"]'::jsonb),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Purchase Order Financing', 'Fintech B', 'po_financing',
   50000.00, 3000000.00, 0.1500, 6, 3, 1.0000,
   '["Signed purchase order", "Buyer credit profile"]'::jsonb,
   '["Confirmed purchase order from a registered buyer"]'::jsonb),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'Invoice Factoring', 'Fintech C', 'invoice_financing',
   30000.00, 2000000.00, 0.1800, 3, 1, NULL,
   '["Issued invoice", "Delivery confirmation"]'::jsonb,
   '["Invoice not older than 90 days"]'::jsonb),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'SME Upgrade Grant', 'Government Agency', 'grant',
   50000.00, 500000.00, 0.0000, 12, 45, NULL,
   '["Project proposal", "Company registration"]'::jsonb,
   '["Registered SME", "One grant per fiscal year"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO swarm_projects (id, order_ref, buyer_name, target_capacity, unit, unit_price,
                            duration_days, payment_terms_days, deposit_ratio, status)
VALUES
  ('bbbbbbbb-0000-4000-8000-000000000001', 'PO-STP-2026-091', 'Siam Retail Group',
   1000, 'box', 100.00, 30, 30, 0.2000, 'draft')
ON CONFLICT (id) DO NOTHING;
