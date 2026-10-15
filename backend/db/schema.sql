-- SME SWARM Finance Copilot - PostgreSQL 15+ schema
-- Money: NUMERIC(20,2). Rates: NUMERIC(12,10) as a decimal fraction (0.0725 = 7.25%).
-- Raw uploaded workbooks are never persisted; only extraction metadata is.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. SME Profiles ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sme_profiles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT        NOT NULL,
    monogram                TEXT,
    tax_id                  TEXT        UNIQUE,
    sector                  TEXT        NOT NULL,
    province                TEXT,
    unit                    TEXT        NOT NULL DEFAULT 'box',
    capacity_total          NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (capacity_total >= 0),
    capacity_used           NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (capacity_used >= 0),
    cost_per_unit           NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (cost_per_unit >= 0),
    cash_balance            NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (cash_balance >= 0),
    minimum_cash_reserve    NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (minimum_cash_reserve >= 0),
    contact_email           TEXT,
    contact_phone           TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT capacity_used_within_total CHECK (capacity_used <= capacity_total)
);
CREATE INDEX IF NOT EXISTS sme_profiles_sector_idx ON sme_profiles (sector);

-- 2. Financial Records -------------------------------------------------------
-- payload = validated FinancialInput (schemas.py). computed = calculate_financials() output.
CREATE TABLE IF NOT EXISTS financial_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sme_id          UUID        NOT NULL REFERENCES sme_profiles (id) ON DELETE CASCADE,
    currency        CHAR(3)     NOT NULL DEFAULT 'THB' CHECK (currency = 'THB'),
    kind            TEXT        NOT NULL CHECK (kind IN ('actual', 'forecast', 'simulated')),
    source          TEXT        NOT NULL CHECK (source IN ('manual', 'excel', 'api')),
    period_start    DATE        NOT NULL,
    period_end      DATE        NOT NULL,
    payload         JSONB       NOT NULL,
    computed        JSONB,
    status          TEXT        NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'insufficient_data', 'error')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT period_order CHECK (period_end >= period_start)
);
CREATE INDEX IF NOT EXISTS financial_records_sme_period_idx
    ON financial_records (sme_id, period_end DESC);
-- One canonical "actual" statement per SME per period.
CREATE UNIQUE INDEX IF NOT EXISTS financial_records_actual_period_uniq
    ON financial_records (sme_id, period_start, period_end) WHERE kind = 'actual';

-- 3. Upload metadata (no file bytes stored) ----------------------------------
CREATE TABLE IF NOT EXISTS upload_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sme_id          UUID        REFERENCES sme_profiles (id) ON DELETE SET NULL,
    record_id       UUID        REFERENCES financial_records (id) ON DELETE SET NULL,
    filename        TEXT        NOT NULL,
    byte_size       BIGINT      NOT NULL CHECK (byte_size >= 0),
    content_sha256  CHAR(64)    NOT NULL,
    status          TEXT        NOT NULL CHECK (status IN ('parsed', 'rejected')),
    reject_reason   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Swarm Projects ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS swarm_projects (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_ref           TEXT        NOT NULL UNIQUE,
    buyer_name          TEXT        NOT NULL,
    target_capacity     NUMERIC(20,2) NOT NULL CHECK (target_capacity > 0),
    unit                TEXT        NOT NULL DEFAULT 'box',
    unit_price          NUMERIC(20,2) NOT NULL CHECK (unit_price >= 0),
    duration_days       INTEGER     NOT NULL CHECK (duration_days > 0),
    payment_terms_days  INTEGER     NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
    deposit_ratio       NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (deposit_ratio BETWEEN 0 AND 1),
    deadline            DATE,
    status              TEXT        NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'ready', 'has_issues', 'incomplete', 'committed', 'closed')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Swarm Allocations: one row = the share of one project held by one SME ----
CREATE TABLE IF NOT EXISTS swarm_allocations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id              UUID        NOT NULL REFERENCES swarm_projects (id) ON DELETE CASCADE,
    sme_id                  UUID        NOT NULL REFERENCES sme_profiles (id) ON DELETE CASCADE,
    assigned_role           TEXT        NOT NULL,
    share_per_day           NUMERIC(20,2) NOT NULL CHECK (share_per_day >= 0),
    working_capital_needed  NUMERIC(20,2) NOT NULL CHECK (working_capital_needed >= 0),
    current_cash            NUMERIC(20,2) NOT NULL CHECK (current_cash >= 0),
    funding_gap             NUMERIC(20,2) NOT NULL CHECK (funding_gap >= 0),
    status                  TEXT        NOT NULL CHECK (status IN ('ready', 'review', 'blocked')),
    version                 TEXT        NOT NULL DEFAULT 'v1',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT one_allocation_per_sme UNIQUE (project_id, sme_id)
);
CREATE INDEX IF NOT EXISTS swarm_allocations_project_idx ON swarm_allocations (project_id);

-- 6. Funding catalogue + match results ---------------------------------------
CREATE TABLE IF NOT EXISTS funding_products (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT        NOT NULL,
    provider                TEXT        NOT NULL,
    type                    TEXT        NOT NULL
                            CHECK (type IN ('term_loan', 'invoice_financing', 'po_financing', 'grant', 'revolving')),
    min_amount              NUMERIC(20,2) NOT NULL CHECK (min_amount >= 0),
    max_amount              NUMERIC(20,2) NOT NULL CHECK (max_amount >= 0),
    interest_rate_annual    NUMERIC(12,10) NOT NULL CHECK (interest_rate_annual BETWEEN 0 AND 1),
    term_months             INTEGER     NOT NULL CHECK (term_months > 0),
    disbursement_days       INTEGER     NOT NULL CHECK (disbursement_days >= 0),
    min_dscr                NUMERIC(12,4),
    required_docs           JSONB       NOT NULL DEFAULT '[]'::jsonb,
    eligibility             JSONB       NOT NULL DEFAULT '[]'::jsonb,
    active                  BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT amount_range CHECK (max_amount >= min_amount)
);

CREATE TABLE IF NOT EXISTS funding_matches (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sme_id           UUID        NOT NULL REFERENCES sme_profiles (id) ON DELETE CASCADE,
    product_id       UUID        NOT NULL REFERENCES funding_products (id) ON DELETE CASCADE,
    project_id       UUID        REFERENCES swarm_projects (id) ON DELETE SET NULL,
    requested_amount NUMERIC(20,2) NOT NULL CHECK (requested_amount >= 0),
    monthly_payment  NUMERIC(20,2),
    total_repayment  NUMERIC(20,2),
    match_score      SMALLINT    NOT NULL CHECK (match_score BETWEEN 0 AND 100),
    match_reason     TEXT        NOT NULL,
    status           TEXT        NOT NULL CHECK (status IN ('eligible', 'requires_info', 'not_eligible')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS funding_matches_sme_score_idx
    ON funding_matches (sme_id, match_score DESC);

-- 7. What-If simulations -----------------------------------------------------
CREATE TABLE IF NOT EXISTS simulations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sme_id          UUID        REFERENCES sme_profiles (id) ON DELETE CASCADE,
    project_id      UUID        REFERENCES swarm_projects (id) ON DELETE CASCADE,
    base_record_id  UUID        REFERENCES financial_records (id) ON DELETE SET NULL,
    scenario_key    TEXT        NOT NULL,
    severity        TEXT        CHECK (severity IN ('low', 'medium', 'high')),
    params          JSONB       NOT NULL,
    results         JSONB       NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS simulations_scope_idx ON simulations (sme_id, created_at DESC);

-- 8. AI analysis cache (keyed by payload hash to avoid repeat LLM spend) -----
CREATE TABLE IF NOT EXISTS ai_analyses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sme_id          UUID        REFERENCES sme_profiles (id) ON DELETE CASCADE,
    scope           TEXT        NOT NULL,
    input_sha256    CHAR(64)    NOT NULL,
    model           TEXT        NOT NULL,
    response        JSONB       NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ai_analyses_cache_key UNIQUE (scope, input_sha256)
);

-- 9. Users and role-based access control -------------------------------------
-- role is the RBAC anchor. An sme_owner row points at the SME it may act for;
-- an investor row points at its investor profile. Enforcement lives in the API
-- layer, so adding a role here never silently widens access.
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT        NOT NULL UNIQUE,
    full_name       TEXT        NOT NULL,
    role            TEXT        NOT NULL
                    CHECK (role IN ('sme_owner', 'investor', 'analyst', 'admin')),
    sme_id          UUID        REFERENCES sme_profiles (id) ON DELETE SET NULL,
    investor_id     UUID,
    password_hash   TEXT,
    active          BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- An sme_owner is meaningless without the SME it owns; likewise investors.
    CONSTRAINT role_scope CHECK (
        (role = 'sme_owner' AND sme_id IS NOT NULL)
        OR (role = 'investor' AND investor_id IS NOT NULL)
        OR role IN ('analyst', 'admin')
    )
);
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);

-- 10. Investor profiles and their scored matches -----------------------------
-- funding_products covers lending products; this covers the counterparties who
-- back a swarm project directly (angels, VCs, government programmes).
CREATE TABLE IF NOT EXISTS investor_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT        NOT NULL,
    type                TEXT        NOT NULL
                        CHECK (type IN ('bank', 'vc', 'angel', 'government', 'fintech', 'corporate')),
    province            TEXT,
    ticket_min          NUMERIC(20,2) NOT NULL CHECK (ticket_min >= 0),
    ticket_max          NUMERIC(20,2) NOT NULL CHECK (ticket_max >= 0),
    target_sectors      JSONB       NOT NULL DEFAULT '[]'::jsonb,
    risk_appetite       TEXT        NOT NULL CHECK (risk_appetite IN ('low', 'medium', 'high')),
    min_grade           CHAR(1)     CHECK (min_grade IN ('A', 'B', 'C', 'D')),
    min_dscr            NUMERIC(12,4),
    horizon_months      INTEGER     CHECK (horizon_months > 0),
    contact_email       TEXT,
    active              BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ticket_range CHECK (ticket_max >= ticket_min)
);
CREATE INDEX IF NOT EXISTS investor_profiles_sector_idx ON investor_profiles USING GIN (target_sectors);

CREATE TABLE IF NOT EXISTS investor_matches (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id      UUID        NOT NULL REFERENCES investor_profiles (id) ON DELETE CASCADE,
    sme_id           UUID        NOT NULL REFERENCES sme_profiles (id) ON DELETE CASCADE,
    project_id       UUID        REFERENCES swarm_projects (id) ON DELETE SET NULL,
    requested_amount NUMERIC(20,2) NOT NULL CHECK (requested_amount >= 0),
    sme_grade        CHAR(1)     CHECK (sme_grade IN ('A', 'B', 'C', 'D')),
    match_score      SMALLINT    NOT NULL CHECK (match_score BETWEEN 0 AND 100),
    match_reason     TEXT        NOT NULL,
    status           TEXT        NOT NULL CHECK (status IN ('eligible', 'requires_info', 'not_eligible')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT one_match_per_investor UNIQUE (investor_id, sme_id, project_id)
);
CREATE INDEX IF NOT EXISTS investor_matches_sme_score_idx
    ON investor_matches (sme_id, match_score DESC);

-- users.investor_id is declared before investor_profiles exists, so the foreign
-- key is attached here. Re-running this file must not fail on an existing one.
DO $$
BEGIN
    ALTER TABLE users ADD CONSTRAINT users_investor_fk
        FOREIGN KEY (investor_id) REFERENCES investor_profiles (id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END;
$$;

-- 11. Columns the frontend contracts need on existing tables -----------------
-- Added with ALTER ... IF NOT EXISTS so this file stays re-runnable.
ALTER TABLE sme_profiles  ADD COLUMN IF NOT EXISTS category      TEXT;
ALTER TABLE sme_profiles  ADD COLUMN IF NOT EXISTS location      TEXT;
ALTER TABLE sme_profiles  ADD COLUMN IF NOT EXISTS tags          JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE sme_profiles  ADD COLUMN IF NOT EXISTS status_note   TEXT;
-- Coordinates for the SWARM distance filter. Nullable on purpose: a shop with
-- no coordinates is excluded when a radius is required, never given a guessed
-- position derived from its province text.
ALTER TABLE sme_profiles  ADD COLUMN IF NOT EXISTS latitude      NUMERIC(12,8) CHECK (latitude BETWEEN -90 AND 90);
ALTER TABLE sme_profiles  ADD COLUMN IF NOT EXISTS longitude     NUMERIC(12,8) CHECK (longitude BETWEEN -180 AND 180);
ALTER TABLE sme_profiles  ADD COLUMN IF NOT EXISTS business_type TEXT;

ALTER TABLE swarm_projects ADD COLUMN IF NOT EXISTS code                TEXT;
ALTER TABLE swarm_projects ADD COLUMN IF NOT EXISTS title               TEXT;
ALTER TABLE swarm_projects ADD COLUMN IF NOT EXISTS buyer_rating        NUMERIC(3,1) CHECK (buyer_rating BETWEEN 0 AND 5);
ALTER TABLE swarm_projects ADD COLUMN IF NOT EXISTS delivery_location   TEXT;
ALTER TABLE swarm_projects ADD COLUMN IF NOT EXISTS standard            TEXT;
ALTER TABLE swarm_projects ADD COLUMN IF NOT EXISTS payment_terms_text  TEXT;
ALTER TABLE swarm_projects ADD COLUMN IF NOT EXISTS start_date          DATE;
ALTER TABLE swarm_projects ADD COLUMN IF NOT EXISTS progress_percent    SMALLINT CHECK (progress_percent BETWEEN 0 AND 100);
ALTER TABLE swarm_projects ADD COLUMN IF NOT EXISTS risk_level          TEXT CHECK (risk_level IN ('low', 'medium', 'high'));
ALTER TABLE swarm_projects ADD COLUMN IF NOT EXISTS roi_estimate_pct    NUMERIC(8,2);
ALTER TABLE swarm_projects ADD COLUMN IF NOT EXISTS duration_months     SMALLINT CHECK (duration_months > 0);
ALTER TABLE swarm_projects ADD COLUMN IF NOT EXISTS fund_purpose        TEXT;
ALTER TABLE swarm_projects ADD COLUMN IF NOT EXISTS evidence_level      TEXT;

-- Per-shop cost lines and sign-off, which the shop finance screen itemises.
ALTER TABLE swarm_allocations ADD COLUMN IF NOT EXISTS selling_price_per_unit NUMERIC(20,2) CHECK (selling_price_per_unit >= 0);
ALTER TABLE swarm_allocations ADD COLUMN IF NOT EXISTS raw_material_cost      NUMERIC(20,2) CHECK (raw_material_cost >= 0);
ALTER TABLE swarm_allocations ADD COLUMN IF NOT EXISTS additional_labor_cost  NUMERIC(20,2) CHECK (additional_labor_cost >= 0);
ALTER TABLE swarm_allocations ADD COLUMN IF NOT EXISTS delivery_cost          NUMERIC(20,2) CHECK (delivery_cost >= 0);
ALTER TABLE swarm_allocations ADD COLUMN IF NOT EXISTS service_fee            NUMERIC(20,2) CHECK (service_fee >= 0);
ALTER TABLE swarm_allocations ADD COLUMN IF NOT EXISTS buyer_signed           BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE swarm_allocations ADD COLUMN IF NOT EXISTS shop_signed            BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE swarm_allocations ADD COLUMN IF NOT EXISTS logistics_signed       BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE swarm_allocations ADD COLUMN IF NOT EXISTS funder_signed          BOOLEAN NOT NULL DEFAULT FALSE;

-- 12. Dated cash events -------------------------------------------------------
-- Feeds the cashflow timeline and each shop's cash schedule. Dated rows are the
-- only honest source for a day-level forecast; a period total cannot be spread
-- across days without inventing the shape of the curve.
CREATE TABLE IF NOT EXISTS cash_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sme_id          UUID        REFERENCES sme_profiles (id) ON DELETE CASCADE,
    project_id      UUID        REFERENCES swarm_projects (id) ON DELETE CASCADE,
    event_date      DATE        NOT NULL,
    day_index       INTEGER     NOT NULL,
    type            TEXT        NOT NULL
                    CHECK (type IN ('buy_materials', 'produce', 'deliver', 'receive_payment', 'pay_obligations')),
    title           TEXT        NOT NULL,
    amount          NUMERIC(20,2) NOT NULL CHECK (amount >= 0),
    is_inflow       BOOLEAN     NOT NULL,
    partner         TEXT,
    status          TEXT        NOT NULL DEFAULT 'projected'
                    CHECK (status IN ('confirmed', 'projected', 'simulated')),
    impact_reason   TEXT        NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cash_events_timeline_idx ON cash_events (sme_id, event_date);
CREATE INDEX IF NOT EXISTS cash_events_project_idx ON cash_events (project_id, day_index);

-- 13. Sales analytics ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sme_id          UUID        NOT NULL REFERENCES sme_profiles (id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,
    category        TEXT        NOT NULL,
    period_start    DATE        NOT NULL,
    period_end      DATE        NOT NULL,
    units_sold      INTEGER     NOT NULL CHECK (units_sold >= 0),
    revenue         NUMERIC(20,2) NOT NULL CHECK (revenue >= 0),
    cost            NUMERIC(20,2) NOT NULL CHECK (cost >= 0),
    turnover_days   NUMERIC(8,2) CHECK (turnover_days >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT sales_products_period CHECK (period_end >= period_start),
    CONSTRAINT one_product_per_period UNIQUE (sme_id, name, period_start, period_end)
);
CREATE INDEX IF NOT EXISTS sales_products_sme_idx ON sales_products (sme_id, period_end DESC);

CREATE TABLE IF NOT EXISTS sales_channels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sme_id          UUID        NOT NULL REFERENCES sme_profiles (id) ON DELETE CASCADE,
    channel         TEXT        NOT NULL,
    period_start    DATE        NOT NULL,
    period_end      DATE        NOT NULL,
    gross_sales     NUMERIC(20,2) NOT NULL CHECK (gross_sales >= 0),
    commission_fee  NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (commission_fee >= 0),
    ad_cost         NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (ad_cost >= 0),
    delivery_cost   NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (delivery_cost >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT sales_channels_period CHECK (period_end >= period_start),
    CONSTRAINT one_channel_per_period UNIQUE (sme_id, channel, period_start, period_end)
);
CREATE INDEX IF NOT EXISTS sales_channels_sme_idx ON sales_channels (sme_id, period_end DESC);

-- 14. Shared resources (SME UNLOCK) ------------------------------------------
CREATE TABLE IF NOT EXISTS shared_resources (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_sme_id            UUID        REFERENCES sme_profiles (id) ON DELETE SET NULL,
    title                   TEXT        NOT NULL,
    category                TEXT        NOT NULL
                            CHECK (category IN ('kitchen', 'truck', 'machine', 'team', 'space')),
    category_label          TEXT        NOT NULL,
    location                TEXT        NOT NULL,
    capacity_text           TEXT        NOT NULL,
    price_text              TEXT        NOT NULL,
    unit_price              NUMERIC(20,2) NOT NULL CHECK (unit_price >= 0),
    availability            TEXT        NOT NULL,
    status                  TEXT        NOT NULL CHECK (status IN ('offered', 'confirmed')),
    image_url               TEXT,
    -- What breaks if this resource is pulled out of the plan.
    impact_additional_cost  NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (impact_additional_cost >= 0),
    impact_delay_days       INTEGER     NOT NULL DEFAULT 0 CHECK (impact_delay_days >= 0),
    impact_message          TEXT        NOT NULL DEFAULT '',
    affected_sme_ids        JSONB       NOT NULL DEFAULT '[]'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shared_resources_category_idx ON shared_resources (category);

-- 15. Chaos scenarios for the simulator --------------------------------------
CREATE TABLE IF NOT EXISTS chaos_scenarios (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                    TEXT        NOT NULL UNIQUE,
    title                   TEXT        NOT NULL,
    category                TEXT        NOT NULL,
    severity                TEXT        NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    description             TEXT        NOT NULL,
    trigger_node_id         TEXT        NOT NULL,
    propagation_path        JSONB       NOT NULL DEFAULT '[]'::jsonb,
    cash_impact_amount      NUMERIC(20,2) NOT NULL DEFAULT 0,
    deficit_days            JSONB       NOT NULL DEFAULT '[]'::jsonb,
    contingency_options     JSONB       NOT NULL DEFAULT '[]'::jsonb,
    revenue_loss            NUMERIC(20,2) NOT NULL DEFAULT 0,
    additional_cost         NUMERIC(20,2) NOT NULL DEFAULT 0,
    new_deficit_amount      NUMERIC(20,2) NOT NULL DEFAULT 0,
    delivery_delay_days     INTEGER     NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16. Delivery schedule and funder evidence ----------------------------------
CREATE TABLE IF NOT EXISTS project_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID        NOT NULL REFERENCES swarm_projects (id) ON DELETE CASCADE,
    day             INTEGER     NOT NULL CHECK (day > 0),
    delivery_date   DATE        NOT NULL,
    target_units    NUMERIC(20,2) NOT NULL CHECK (target_units >= 0),
    delivered_units NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (delivered_units >= 0),
    status          TEXT        NOT NULL CHECK (status IN ('done', 'on_schedule', 'delayed')),
    CONSTRAINT one_delivery_per_day UNIQUE (project_id, day)
);

CREATE TABLE IF NOT EXISTS project_evidence (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID        NOT NULL REFERENCES swarm_projects (id) ON DELETE CASCADE,
    title           TEXT        NOT NULL,
    verified        BOOLEAN     NOT NULL DEFAULT FALSE,
    document_date   DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_evidence_project_idx ON project_evidence (project_id);

-- 17. Industry news cache ----------------------------------------------------
-- Cache for the trends module. `id` is the SHA-256 the fetcher derives from
-- sector plus canonical URL, so re-ingesting the same article is an upsert.
-- published_at stays nullable: the provider does not establish a publication
-- timestamp, and observed_at records only when the article was first seen.
CREATE TABLE IF NOT EXISTS industry_news (
    id              CHAR(64) PRIMARY KEY,
    sector          TEXT        NOT NULL,
    provider        TEXT        NOT NULL,
    source          TEXT,
    url             TEXT        NOT NULL,
    title           TEXT        NOT NULL,
    published_at    TIMESTAMPTZ,
    observed_at     TIMESTAMPTZ,
    fetched_at      TIMESTAMPTZ NOT NULL,
    date_source     TEXT,
    status          TEXT,
    raw             JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS industry_news_sector_idx ON industry_news (sector, fetched_at DESC);

-- 18. Dated obligations ------------------------------------------------------
-- Source rows for the 30/60/90-day forecast. app/forecasting.py turns these
-- into projected cash_events; it never reads the database itself, so these are
-- the inputs CLAUDE hands it.
--
-- Receivables and payables are separate tables because an inflow carries an
-- invoice and a collection, while an outflow covers suppliers, operating costs
-- and debt installments. The `kind` column on payables maps onto the three
-- outflow categories the forecaster takes.
--
-- `status` separates an obligation that is still outstanding from one that has
-- settled. Only outstanding rows are forecast: a settled one already shows in
-- the cash balance, so forecasting it again would double count.
CREATE TABLE IF NOT EXISTS receivables (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sme_id          UUID        NOT NULL REFERENCES sme_profiles (id) ON DELETE CASCADE,
    project_id      UUID        REFERENCES swarm_projects (id) ON DELETE SET NULL,
    invoice_ref     TEXT        NOT NULL,
    counterparty    TEXT        NOT NULL,
    amount          NUMERIC(20,2) NOT NULL CHECK (amount > 0),
    issued_date     DATE        NOT NULL,
    due_date        DATE        NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'outstanding'
                    CHECK (status IN ('outstanding', 'collected', 'written_off')),
    collected_date  DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT receivable_due_after_issue CHECK (due_date >= issued_date),
    -- A collected row must say when; an outstanding one must not pretend to.
    CONSTRAINT receivable_collected_date CHECK (
        (status = 'collected' AND collected_date IS NOT NULL)
        OR (status <> 'collected' AND collected_date IS NULL)
    ),
    CONSTRAINT one_receivable_per_invoice UNIQUE (sme_id, invoice_ref)
);
CREATE INDEX IF NOT EXISTS receivables_due_idx
    ON receivables (sme_id, due_date) WHERE status = 'outstanding';

CREATE TABLE IF NOT EXISTS payables (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sme_id          UUID        NOT NULL REFERENCES sme_profiles (id) ON DELETE CASCADE,
    project_id      UUID        REFERENCES swarm_projects (id) ON DELETE SET NULL,
    bill_ref        TEXT        NOT NULL,
    counterparty    TEXT,
    kind            TEXT        NOT NULL
                    CHECK (kind IN ('supplier', 'operating_cost', 'debt_installment')),
    category        TEXT,
    amount          NUMERIC(20,2) NOT NULL CHECK (amount > 0),
    issued_date     DATE,
    due_date        DATE        NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'outstanding'
                    CHECK (status IN ('outstanding', 'paid', 'cancelled')),
    paid_date       DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT payable_paid_date CHECK (
        (status = 'paid' AND paid_date IS NOT NULL)
        OR (status <> 'paid' AND paid_date IS NULL)
    ),
    CONSTRAINT one_payable_per_bill UNIQUE (sme_id, bill_ref)
);
CREATE INDEX IF NOT EXISTS payables_due_idx
    ON payables (sme_id, due_date) WHERE status = 'outstanding';

-- 19. Expense history --------------------------------------------------------
-- Individual dated expenses, so an unusual one can be compared against a real
-- baseline. analysis.py declares this gap in its unknowns today: without
-- transactions there is nothing to call unusual.
CREATE TABLE IF NOT EXISTS expense_transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sme_id              UUID        NOT NULL REFERENCES sme_profiles (id) ON DELETE CASCADE,
    transaction_date    DATE        NOT NULL,
    category            TEXT        NOT NULL,
    description         TEXT        NOT NULL,
    amount              NUMERIC(20,2) NOT NULL CHECK (amount > 0),
    counterparty        TEXT,
    source              TEXT        NOT NULL DEFAULT 'manual'
                        CHECK (source IN ('manual', 'excel', 'api')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expense_transactions_history_idx
    ON expense_transactions (sme_id, category, transaction_date DESC);

-- 20. Which resources a shop needs for its share -----------------------------
-- shared_resources records what is on offer; this records what a given
-- allocation depends on, which is what resource eligibility in the SWARM
-- allocator needs. `required` separates a hard dependency from a preference.
CREATE TABLE IF NOT EXISTS allocation_resources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id   UUID        NOT NULL REFERENCES swarm_allocations (id) ON DELETE CASCADE,
    resource_id     UUID        NOT NULL REFERENCES shared_resources (id) ON DELETE CASCADE,
    required        BOOLEAN     NOT NULL DEFAULT TRUE,
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT one_link_per_resource UNIQUE (allocation_id, resource_id)
);
CREATE INDEX IF NOT EXISTS allocation_resources_resource_idx
    ON allocation_resources (resource_id);

-- 21. Provider fetch state ---------------------------------------------------
-- One row per external provider, shared by every worker. The news fetcher must
-- not be called once per page render, and several replicas hitting it at once
-- is what produced HTTP 429. next_allowed_at is the gate; the work is taken
-- under pg_try_advisory_lock so a second worker skips rather than queues.
CREATE TABLE IF NOT EXISTS provider_fetch_state (
    provider                TEXT        PRIMARY KEY,
    last_attempt_at         TIMESTAMPTZ,
    last_success_at         TIMESTAMPTZ,
    next_allowed_at         TIMESTAMPTZ,
    consecutive_failures    INTEGER     NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
    last_error              TEXT,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 22. Login throttle ---------------------------------------------------------
-- Rate limit for POST /api/auth/login, held in the database so it applies
-- across replicas rather than per process. Keyed by a hash of the identifier,
-- so the table never stores the addresses that were tried.
CREATE TABLE IF NOT EXISTS auth_throttle (
    key_hash        CHAR(64)    PRIMARY KEY,
    window_start    TIMESTAMPTZ NOT NULL DEFAULT now(),
    attempts        INTEGER     NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    blocked_until   TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_throttle_blocked_idx ON auth_throttle (blocked_until);

-- updated_at triggers --------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sme_profiles_touch ON sme_profiles;
CREATE TRIGGER sme_profiles_touch BEFORE UPDATE ON sme_profiles
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS swarm_projects_touch ON swarm_projects;
CREATE TRIGGER swarm_projects_touch BEFORE UPDATE ON swarm_projects
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS users_touch ON users;
CREATE TRIGGER users_touch BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS investor_profiles_touch ON investor_profiles;
CREATE TRIGGER investor_profiles_touch BEFORE UPDATE ON investor_profiles
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
