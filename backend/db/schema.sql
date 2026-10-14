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
