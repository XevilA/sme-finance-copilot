-- Demo rows for local development. Fixed UUIDs so the same ids work in every
-- demo, Postman collection and screenshot. Safe to re-run.
--
-- Two SMEs are deliberately contrasted, per the demo acceptance checklist:
--   Baan Suan Kitchen  - healthy: cash well above reserve, no funding gap
--   Rung Charoen Foods - distressed: cash barely over reserve, blocked on funding
-- All figures are synthetic and labelled as such; none describe a real business.

INSERT INTO sme_profiles (id, name, monogram, sector, province, unit,
                          capacity_total, capacity_used, cost_per_unit,
                          cash_balance, minimum_cash_reserve,
                          category, location, tags, status_note)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'Baan Suan Kitchen', 'BS', 'food_processing', 'Nonthaburi', 'box',
   600, 100, 60.00, 5000000.00, 200000.00,
   'ครัวกลางอาหารพร้อมทาน', 'นนทบุรี',
   '["ครัวมาตรฐาน GMP","ห้องเย็น","รับงานด่วน"]'::jsonb,
   'กำลังผลิตเหลือ 500 กล่อง/วัน เงินสดเพียงพอ'),
  ('22222222-2222-4222-8222-222222222222', 'Rung Charoen Foods', 'RC', 'food_processing', 'Pathum Thani', 'box',
   400, 0, 70.00, 180000.00, 150000.00,
   'โรงงานแปรรูปขนาดเล็ก', 'ปทุมธานี',
   '["แปรรูป","ต้องการเงินทุนหมุนเวียน"]'::jsonb,
   'กำลังผลิตว่างเต็ม 400 กล่อง/วัน แต่เงินสดเหนือเงินสำรองเพียง 30,000 บาท'),
  ('33333333-3333-4333-8333-333333333333', 'Sahai Packing Co', 'SP', 'packaging', 'Samut Prakan', 'box',
   900, 450, 55.00, 1200000.00, 300000.00,
   'บรรจุภัณฑ์และแพ็กกิ้ง', 'สมุทรปราการ',
   '["บรรจุภัณฑ์รักษ์โลก","ซีลสูญญากาศ"]'::jsonb,
   'กำลังผลิตเหลือ 450 กล่อง/วัน ต้นทุนต่อหน่วยต่ำสุดในกลุ่ม')
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
                            duration_days, payment_terms_days, deposit_ratio, status,
                            code, title, buyer_rating, delivery_location, standard,
                            payment_terms_text, start_date, deadline, progress_percent,
                            risk_level, roi_estimate_pct, duration_months, fund_purpose,
                            evidence_level)
VALUES
  ('bbbbbbbb-0000-4000-8000-000000000001', 'PO-STP-2026-091', 'Siam Retail Group',
   1000, 'box', 100.00, 30, 30, 0.2000, 'ready',
   'PRJ-2026-091', 'ออเดอร์อาหารพร้อมทาน 1,000 กล่อง/วัน 30 วัน', 4.5,
   'ศูนย์กระจายสินค้า ลาดกระบัง', 'GMP + HACCP',
   'มัดจำ 20% ชำระส่วนที่เหลือเครดิต 30 วันหลังส่งมอบ',
   '2026-10-01', '2026-10-31', 35,
   'medium', 24.50, 2, 'เงินทุนหมุนเวียนซื้อวัตถุดิบและค่าแรงช่วงผลิต',
   'verified_documents')
ON CONFLICT (id) DO NOTHING;

-- Allocations for the demo project, so the seed is self-contained and does not
-- depend on POST /api/swarm having been called. The shares, working capital and
-- funding gaps are what app/swarm.py computes for this order, so the stored
-- rows and a live recomputation agree.
--
-- NOTE: that working-capital formula is under review (see DEMO_READINESS.md
-- P0 - it charges production cost across the payment-wait days). These rows
-- match the engine as it stands today; when the formula changes, reseed.
INSERT INTO swarm_allocations (id, project_id, sme_id, assigned_role, share_per_day,
                               working_capital_needed, current_cash, funding_gap, status,
                               selling_price_per_unit, raw_material_cost,
                               additional_labor_cost, delivery_cost, service_fee,
                               buyer_signed, shop_signed, logistics_signed, funder_signed)
VALUES
  -- Sahai Packing: cheapest unit cost, so it is allocated first.
  ('b1000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
   '33333333-3333-4333-8333-333333333333', 'lead_producer', 450,
   1485000.00, 1200000.00, 315000.00, 'review',
   100.00, 742500.00, 40500.00, 20250.00, 6750.00, TRUE, TRUE, TRUE, FALSE),
  -- Baan Suan: healthy cash, no gap.
  ('b1000000-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111111', 'co_producer', 500,
   1800000.00, 5000000.00, 0.00, 'ready',
   100.00, 900000.00, 45000.00, 22500.00, 7500.00, TRUE, TRUE, TRUE, TRUE),
  -- Rung Charoen: distressed, blocked on funding.
  ('b1000000-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000001',
   '22222222-2222-4222-8222-222222222222', 'finisher', 50,
   210000.00, 180000.00, 150000.00, 'blocked',
   100.00, 105000.00, 4500.00, 2250.00, 750.00, TRUE, FALSE, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Any allocation created through the API has no itemised cost lines, so fill
-- them from the shop unit cost rather than leaving the finance screen at zero.
UPDATE swarm_allocations a SET
    selling_price_per_unit = COALESCE(a.selling_price_per_unit, p.unit_price),
    raw_material_cost      = a.share_per_day * p.duration_days * s.cost_per_unit,
    additional_labor_cost  = a.share_per_day * p.duration_days * 3.00,
    delivery_cost          = a.share_per_day * p.duration_days * 1.50,
    service_fee            = a.share_per_day * p.duration_days * 0.50
FROM swarm_projects p, sme_profiles s
WHERE a.project_id = p.id AND a.sme_id = s.id AND a.raw_material_cost IS NULL;

INSERT INTO project_deliveries (project_id, day, delivery_date, target_units, delivered_units, status)
VALUES
  ('bbbbbbbb-0000-4000-8000-000000000001', 1, '2026-10-01', 1000, 1000, 'done'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 2, '2026-10-02', 1000, 1000, 'done'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 3, '2026-10-03', 1000, 950, 'delayed'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 4, '2026-10-04', 1000, 0, 'on_schedule'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 5, '2026-10-05', 1000, 0, 'on_schedule')
ON CONFLICT (project_id, day) DO NOTHING;

INSERT INTO project_evidence (id, project_id, title, verified, document_date)
VALUES
  ('e0000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'ใบสั่งซื้อจากผู้ซื้อ (PO)', TRUE, '2026-09-25'),
  ('e0000000-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001', 'ใบรับรอง GMP ของครัวกลาง', TRUE, '2026-06-30'),
  ('e0000000-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000001', 'สัญญาขนส่งควบคุมอุณหภูมิ', FALSE, NULL)
ON CONFLICT (id) DO NOTHING;

-- Dated cash movements. The timeline is built from these rows only; a period
-- total is never spread across days.
INSERT INTO cash_events (id, sme_id, project_id, event_date, day_index, type, title,
                         amount, is_inflow, partner, status, impact_reason)
VALUES
  ('f0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'bbbbbbbb-0000-4000-8000-000000000001',
   '2026-10-01', 1, 'receive_payment', 'รับเงินมัดจำ 20% จากผู้ซื้อ', 600000.00, TRUE,
   'Siam Retail Group', 'confirmed', 'มัดจำตามสัญญา PO-STP-2026-091'),
  ('f0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'bbbbbbbb-0000-4000-8000-000000000001',
   '2026-10-02', 2, 'buy_materials', 'ซื้อวัตถุดิบล็อตแรก', 900000.00, FALSE,
   'ผู้จำหน่ายวัตถุดิบ', 'confirmed', 'ต้องจ่ายสดก่อนเริ่มผลิต'),
  ('f0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'bbbbbbbb-0000-4000-8000-000000000001',
   '2026-10-10', 10, 'produce', 'ค่าแรงและค่าสาธารณูปโภคช่วงผลิต', 450000.00, FALSE,
   NULL, 'projected', 'ค่าแรงรายงวดระหว่างการผลิต'),
  ('f0000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'bbbbbbbb-0000-4000-8000-000000000001',
   '2026-10-15', 15, 'buy_materials', 'ซื้อวัตถุดิบล็อตสอง', 850000.00, FALSE,
   'ผู้จำหน่ายวัตถุดิบ', 'projected', 'เติมวัตถุดิบครึ่งหลังของออเดอร์'),
  ('f0000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'bbbbbbbb-0000-4000-8000-000000000001',
   '2026-10-25', 25, 'pay_obligations', 'ชำระค่างวดสินเชื่อและดอกเบี้ย', 30000.00, FALSE,
   'Bank A', 'confirmed', 'ค่างวดตามตารางชำระหนี้'),
  ('f0000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'bbbbbbbb-0000-4000-8000-000000000001',
   '2026-10-31', 31, 'deliver', 'ส่งมอบงวดสุดท้าย', 0.00, FALSE,
   'Siam Retail Group', 'projected', 'ครบกำหนดส่งมอบตามสัญญา'),
  ('f0000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'bbbbbbbb-0000-4000-8000-000000000001',
   '2026-11-30', 61, 'receive_payment', 'รับชำระส่วนที่เหลือ 80%', 2400000.00, TRUE,
   'Siam Retail Group', 'projected', 'เครดิต 30 วันหลังส่งมอบ')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sales_products (sme_id, name, category, period_start, period_end,
                            units_sold, revenue, cost, turnover_days)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'ข้าวกล่องแกงเขียวหวานไก่', 'อาหารพร้อมทาน',
   '2026-09-01', '2026-09-30', 12000, 1080000.00, 660000.00, 3.50),
  ('11111111-1111-4111-8111-111111111111', 'ข้าวกล่องผัดกะเพราหมู', 'อาหารพร้อมทาน',
   '2026-09-01', '2026-09-30', 9800, 823200.00, 539000.00, 4.20),
  ('11111111-1111-4111-8111-111111111111', 'ชุดอาหารเช้าพร้อมทาน', 'อาหารพร้อมทาน',
   '2026-09-01', '2026-09-30', 3100, 341000.00, 232500.00, 12.80),
  ('11111111-1111-4111-8111-111111111111', 'น้ำพริกแกงบรรจุถุง', 'เครื่องปรุง',
   '2026-09-01', '2026-09-30', 1400, 98000.00, 79800.00, 28.40)
ON CONFLICT (sme_id, name, period_start, period_end) DO NOTHING;

INSERT INTO sales_channels (sme_id, channel, period_start, period_end,
                            gross_sales, commission_fee, ad_cost, delivery_cost)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'ขายตรงหน้าร้าน', '2026-09-01', '2026-09-30',
   780000.00, 0.00, 12000.00, 0.00),
  ('11111111-1111-4111-8111-111111111111', 'แพลตฟอร์มเดลิเวอรี', '2026-09-01', '2026-09-30',
   920000.00, 276000.00, 48000.00, 64000.00),
  ('11111111-1111-4111-8111-111111111111', 'ขายส่งให้ร้านค้า', '2026-09-01', '2026-09-30',
   642200.00, 0.00, 5000.00, 32000.00)
ON CONFLICT (sme_id, channel, period_start, period_end) DO NOTHING;

INSERT INTO shared_resources (id, owner_sme_id, title, category, category_label, location,
                              capacity_text, price_text, unit_price, availability, status,
                              impact_additional_cost, impact_delay_days, impact_message,
                              affected_sme_ids)
VALUES
  ('a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'ครัวกลางมาตรฐาน GMP พร้อมห้องเย็น', 'kitchen',
   'ครัวกลาง', 'นนทบุรี', 'รองรับ 600 กล่อง/วัน', '3,500 บาท/วัน', 3500.00,
   'ว่าง 1–20 พ.ย. 2026', 'confirmed',
   120000.00, 4, 'ถ้าถอนครัวกลางออก ต้องเช่าครัวภายนอกที่ค่าเช่าสูงกว่าและเสียเวลาขนย้าย',
   '["22222222-2222-4222-8222-222222222222"]'::jsonb),
  ('a1000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', 'รถห้องเย็น 4 ล้อ ควบคุมอุณหภูมิ', 'truck',
   'ขนส่งห้องเย็น', 'สมุทรปราการ', 'บรรทุก 1,200 กล่อง/เที่ยว', '2,800 บาท/เที่ยว', 2800.00,
   'ว่างทุกวันจันทร์–ศุกร์', 'offered',
   85000.00, 2, 'ถ้าไม่มีรถห้องเย็น ต้องใช้ขนส่งภายนอกและเสี่ยงของเสียระหว่างทาง',
   '["11111111-1111-4111-8111-111111111111","22222222-2222-4222-8222-222222222222"]'::jsonb),
  ('a1000000-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333', 'เครื่องซีลสูญญากาศกำลังสูง', 'machine',
   'เครื่องจักร', 'สมุทรปราการ', 'ซีลได้ 1,500 ชิ้น/ชั่วโมง', '1,200 บาท/วัน', 1200.00,
   'ว่าง 5–25 พ.ย. 2026', 'offered',
   40000.00, 1, 'ถ้าไม่มีเครื่องซีล ต้องแพ็กมือซึ่งช้าลงและอายุสินค้าสั้นลง',
   '["11111111-1111-4111-8111-111111111111"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO chaos_scenarios (slug, title, category, severity, description, trigger_node_id,
                             propagation_path, cash_impact_amount, deficit_days,
                             contingency_options, revenue_loss, additional_cost,
                             new_deficit_amount, delivery_delay_days)
VALUES
  ('buyer_pays_late', 'ผู้ซื้อเลื่อนชำระออกไป 30 วัน', 'payment', 'high',
   'ผู้ซื้อขอขยายเครดิตจาก 30 วันเป็น 60 วัน ทำให้เงินเข้าช้ากว่ากำหนดหนึ่งงวดเต็ม',
   'node-receive-payment',
   '["node-receive-payment","node-cash-balance","node-pay-obligations"]'::jsonb,
   2400000.00, '[31,45,61]'::jsonb,
   '[{"id":"factoring","title":"ขายลดลูกหนี้การค้า","actionText":"จับคู่สินเชื่อ invoice financing","savingsOrMitigation":"ได้เงินเร็วขึ้นประมาณ 30 วัน แลกกับดอกเบี้ย 18% ต่อปี","targetPage":"funding"},{"id":"renegotiate","title":"ต่อรองขอมัดจำเพิ่ม","actionText":"เสนอเพิ่มมัดจำเป็น 40%","savingsOrMitigation":"ลดเงินทุนหมุนเวียนที่ต้องหาเองลงครึ่งหนึ่ง","targetPage":"swarm"}]'::jsonb,
   0.00, 36000.00, 2400000.00, 0),
  ('material_price_spike', 'ราคาวัตถุดิบขึ้น 15% กลางออเดอร์', 'cost', 'medium',
   'ราคาวัตถุดิบหลักปรับขึ้นก่อนสั่งล็อตสอง ทำให้ต้นทุนรวมสูงกว่าที่ตั้งไว้',
   'node-buy-materials',
   '["node-buy-materials","node-total-cost","node-net-profit"]'::jsonb,
   127500.00, '[15]'::jsonb,
   '[{"id":"switch_supplier","title":"เปลี่ยนผู้จำหน่ายบางรายการ","actionText":"เทียบราคาผู้จำหน่ายสำรอง","savingsOrMitigation":"ลดผลกระทบได้ประมาณ 40% ของส่วนต่างราคา","targetPage":"cost"}]'::jsonb,
   0.00, 127500.00, 127500.00, 0),
  ('shop_drops_out', 'ร้านร่วมผลิตถอนตัวกลางทาง', 'capacity', 'high',
   'ร้านที่รับกำลังผลิตส่วนหนึ่งถอนตัว ทำให้กำลังผลิตรวมไม่ถึงเป้าของออเดอร์',
   'node-shop-allocation',
   '["node-shop-allocation","node-capacity","node-deliver"]'::jsonb,
   0.00, '[]'::jsonb,
   '[{"id":"invite_shop","title":"ชวนร้านสำรองเข้าแทน","actionText":"เปิดหารือร้านในกลุ่ม SWARM","savingsOrMitigation":"ปิดส่วนที่ขาดได้ถ้ามีร้านว่างพอ","targetPage":"swarm"},{"id":"reduce_scope","title":"ลดปริมาณส่งมอบตามที่ทำได้","actionText":"ขอปรับสัญญากับผู้ซื้อ","savingsOrMitigation":"เลี่ยงค่าปรับส่งมอบไม่ครบ แต่รายได้ลดลงตามสัดส่วน","targetPage":"projects"}]'::jsonb,
   1500000.00, 0.00, 0.00, 5)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO investor_profiles (id, name, type, province, ticket_min, ticket_max,
                               target_sectors, risk_appetite, min_grade, min_dscr,
                               horizon_months, contact_email)
VALUES
  ('cccccccc-0000-4000-8000-000000000001', 'Thai SME Growth Fund', 'vc', 'กรุงเทพมหานคร',
   500000.00, 10000000.00, '["food_processing","packaging"]'::jsonb, 'medium', 'B', 1.2000,
   24, 'deals@example.test'),
  ('cccccccc-0000-4000-8000-000000000002', 'Angel Network Bangkok', 'angel', 'กรุงเทพมหานคร',
   100000.00, 1500000.00, '["food_processing"]'::jsonb, 'high', 'C', NULL,
   18, 'intro@example.test'),
  ('cccccccc-0000-4000-8000-000000000003', 'SME Support Programme', 'government', 'นนทบุรี',
   50000.00, 500000.00, '["food_processing","packaging","retail"]'::jsonb, 'low', 'B', 1.5000,
   12, 'programme@example.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, full_name, role, sme_id, investor_id)
VALUES
  ('dddddddd-0000-4000-8000-000000000001', 'owner@baansuan.test', 'Baan Suan Owner',
   'sme_owner', '11111111-1111-4111-8111-111111111111', NULL),
  ('dddddddd-0000-4000-8000-000000000002', 'owner@rungcharoen.test', 'Rung Charoen Owner',
   'sme_owner', '22222222-2222-4222-8222-222222222222', NULL),
  ('dddddddd-0000-4000-8000-000000000003', 'fund@example.test', 'Growth Fund Analyst',
   'investor', NULL, 'cccccccc-0000-4000-8000-000000000001'),
  ('dddddddd-0000-4000-8000-000000000004', 'admin@example.test', 'Platform Admin',
   'admin', NULL, NULL)
ON CONFLICT (id) DO NOTHING;
