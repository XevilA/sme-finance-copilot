"""ORM mapping for db/schema.sql. schema.sql stays the source of truth."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, Numeric, SmallInteger, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

MONEY = Numeric(20, 2)
RATE = Numeric(12, 10)


class Base(DeclarativeBase):
    pass


def pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class SmeProfile(Base):
    __tablename__ = "sme_profiles"

    id: Mapped[uuid.UUID] = pk()
    name: Mapped[str] = mapped_column(Text, nullable=False)
    monogram: Mapped[str | None] = mapped_column(Text)
    tax_id: Mapped[str | None] = mapped_column(Text, unique=True)
    sector: Mapped[str] = mapped_column(Text, nullable=False)
    province: Mapped[str | None] = mapped_column(Text)
    unit: Mapped[str] = mapped_column(Text, nullable=False, default="box")
    capacity_total: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    capacity_used: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    cost_per_unit: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    cash_balance: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    minimum_cash_reserve: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    contact_email: Mapped[str | None] = mapped_column(Text)
    contact_phone: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(Text)
    tags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    status_note: Mapped[str | None] = mapped_column(Text)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(12, 8))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(12, 8))
    business_type: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    records: Mapped[list["FinancialRecord"]] = relationship(back_populates="sme", cascade="all, delete-orphan")
    allocations: Mapped[list["SwarmAllocation"]] = relationship(back_populates="sme", cascade="all, delete-orphan")

    @property
    def capacity_available(self) -> Decimal:
        return self.capacity_total - self.capacity_used


class FinancialRecord(Base):
    __tablename__ = "financial_records"

    id: Mapped[uuid.UUID] = pk()
    sme_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sme_profiles.id", ondelete="CASCADE"), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="THB")
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    computed: Mapped[dict | None] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="ok")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sme: Mapped[SmeProfile] = relationship(back_populates="records")

    __table_args__ = (CheckConstraint("period_end >= period_start", name="period_order"),)


class UploadEvent(Base):
    __tablename__ = "upload_events"

    id: Mapped[uuid.UUID] = pk()
    sme_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sme_profiles.id", ondelete="SET NULL"))
    record_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("financial_records.id", ondelete="SET NULL"))
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False)
    content_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    reject_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SwarmProject(Base):
    __tablename__ = "swarm_projects"

    id: Mapped[uuid.UUID] = pk()
    order_ref: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    buyer_name: Mapped[str] = mapped_column(Text, nullable=False)
    target_capacity: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    unit: Mapped[str] = mapped_column(Text, nullable=False, default="box")
    unit_price: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)
    payment_terms_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    deposit_ratio: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False, default=0)
    deadline: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="draft")
    code: Mapped[str | None] = mapped_column(Text)
    title: Mapped[str | None] = mapped_column(Text)
    buyer_rating: Mapped[Decimal | None] = mapped_column(Numeric(3, 1))
    delivery_location: Mapped[str | None] = mapped_column(Text)
    standard: Mapped[str | None] = mapped_column(Text)
    payment_terms_text: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date | None] = mapped_column(Date)
    progress_percent: Mapped[int | None] = mapped_column(SmallInteger)
    risk_level: Mapped[str | None] = mapped_column(Text)
    roi_estimate_pct: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    duration_months: Mapped[int | None] = mapped_column(SmallInteger)
    fund_purpose: Mapped[str | None] = mapped_column(Text)
    evidence_level: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    allocations: Mapped[list["SwarmAllocation"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    deliveries: Mapped[list["ProjectDelivery"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    evidence: Mapped[list["ProjectEvidence"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class SwarmAllocation(Base):
    __tablename__ = "swarm_allocations"

    id: Mapped[uuid.UUID] = pk()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("swarm_projects.id", ondelete="CASCADE"), nullable=False)
    sme_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sme_profiles.id", ondelete="CASCADE"), nullable=False)
    assigned_role: Mapped[str] = mapped_column(Text, nullable=False)
    share_per_day: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    working_capital_needed: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    current_cash: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    funding_gap: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[str] = mapped_column(Text, nullable=False, default="v1")
    selling_price_per_unit: Mapped[Decimal | None] = mapped_column(MONEY)
    raw_material_cost: Mapped[Decimal | None] = mapped_column(MONEY)
    additional_labor_cost: Mapped[Decimal | None] = mapped_column(MONEY)
    delivery_cost: Mapped[Decimal | None] = mapped_column(MONEY)
    service_fee: Mapped[Decimal | None] = mapped_column(MONEY)
    buyer_signed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    shop_signed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    logistics_signed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    funder_signed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped[SwarmProject] = relationship(back_populates="allocations")
    sme: Mapped[SmeProfile] = relationship(back_populates="allocations")

    __table_args__ = (UniqueConstraint("project_id", "sme_id", name="one_allocation_per_sme"),)


class FundingProduct(Base):
    __tablename__ = "funding_products"

    id: Mapped[uuid.UUID] = pk()
    name: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    min_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    max_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    interest_rate_annual: Mapped[Decimal] = mapped_column(RATE, nullable=False)
    term_months: Mapped[int] = mapped_column(Integer, nullable=False)
    disbursement_days: Mapped[int] = mapped_column(Integer, nullable=False)
    min_dscr: Mapped[Decimal | None] = mapped_column(Numeric(12, 4))
    required_docs: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    eligibility: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FundingMatch(Base):
    __tablename__ = "funding_matches"

    id: Mapped[uuid.UUID] = pk()
    sme_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sme_profiles.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("funding_products.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("swarm_projects.id", ondelete="SET NULL"))
    requested_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    monthly_payment: Mapped[Decimal | None] = mapped_column(MONEY)
    total_repayment: Mapped[Decimal | None] = mapped_column(MONEY)
    match_score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    match_reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Simulation(Base):
    __tablename__ = "simulations"

    id: Mapped[uuid.UUID] = pk()
    sme_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sme_profiles.id", ondelete="CASCADE"))
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("swarm_projects.id", ondelete="CASCADE"))
    base_record_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("financial_records.id", ondelete="SET NULL"))
    scenario_key: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str | None] = mapped_column(Text)
    params: Mapped[dict] = mapped_column(JSONB, nullable=False)
    results: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AiAnalysis(Base):
    __tablename__ = "ai_analyses"

    id: Mapped[uuid.UUID] = pk()
    sme_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sme_profiles.id", ondelete="CASCADE"))
    scope: Mapped[str] = mapped_column(Text, nullable=False)
    input_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    model: Mapped[str] = mapped_column(Text, nullable=False)
    response: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("scope", "input_sha256", name="ai_analyses_cache_key"),)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = pk()
    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    sme_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sme_profiles.id", ondelete="SET NULL"))
    investor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("investor_profiles.id", ondelete="SET NULL"))
    password_hash: Mapped[str | None] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InvestorProfile(Base):
    __tablename__ = "investor_profiles"

    id: Mapped[uuid.UUID] = pk()
    name: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    province: Mapped[str | None] = mapped_column(Text)
    ticket_min: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    ticket_max: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    target_sectors: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    risk_appetite: Mapped[str] = mapped_column(Text, nullable=False)
    min_grade: Mapped[str | None] = mapped_column(String(1))
    min_dscr: Mapped[Decimal | None] = mapped_column(Numeric(12, 4))
    horizon_months: Mapped[int | None] = mapped_column(Integer)
    contact_email: Mapped[str | None] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InvestorMatch(Base):
    __tablename__ = "investor_matches"

    id: Mapped[uuid.UUID] = pk()
    investor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("investor_profiles.id", ondelete="CASCADE"), nullable=False)
    sme_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sme_profiles.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("swarm_projects.id", ondelete="SET NULL"))
    requested_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    sme_grade: Mapped[str | None] = mapped_column(String(1))
    match_score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    match_reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("investor_id", "sme_id", "project_id", name="one_match_per_investor"),)


class CashEvent(Base):
    """A dated cash movement. The only honest basis for a day-level forecast."""

    __tablename__ = "cash_events"

    id: Mapped[uuid.UUID] = pk()
    sme_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sme_profiles.id", ondelete="CASCADE"))
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("swarm_projects.id", ondelete="CASCADE"))
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    day_index: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    is_inflow: Mapped[bool] = mapped_column(Boolean, nullable=False)
    partner: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="projected")
    impact_reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SalesProduct(Base):
    __tablename__ = "sales_products"

    id: Mapped[uuid.UUID] = pk()
    sme_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sme_profiles.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    units_sold: Mapped[int] = mapped_column(Integer, nullable=False)
    revenue: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    turnover_days: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("sme_id", "name", "period_start", "period_end", name="one_product_per_period"),
    )


class SalesChannel(Base):
    __tablename__ = "sales_channels"

    id: Mapped[uuid.UUID] = pk()
    sme_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sme_profiles.id", ondelete="CASCADE"), nullable=False)
    channel: Mapped[str] = mapped_column(Text, nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    gross_sales: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    commission_fee: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    ad_cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    delivery_cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("sme_id", "channel", "period_start", "period_end", name="one_channel_per_period"),
    )


class SharedResource(Base):
    """A resource one SME offers to the swarm (SME UNLOCK)."""

    __tablename__ = "shared_resources"

    id: Mapped[uuid.UUID] = pk()
    owner_sme_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sme_profiles.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    category_label: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str] = mapped_column(Text, nullable=False)
    capacity_text: Mapped[str] = mapped_column(Text, nullable=False)
    price_text: Mapped[str] = mapped_column(Text, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    availability: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str | None] = mapped_column(Text)
    impact_additional_cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    impact_delay_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    impact_message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    affected_sme_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    owner: Mapped["SmeProfile | None"] = relationship()


class ChaosScenario(Base):
    __tablename__ = "chaos_scenarios"

    id: Mapped[uuid.UUID] = pk()
    slug: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    trigger_node_id: Mapped[str] = mapped_column(Text, nullable=False)
    propagation_path: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    cash_impact_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    deficit_days: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    contingency_options: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    revenue_loss: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    additional_cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    new_deficit_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    delivery_delay_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProjectDelivery(Base):
    __tablename__ = "project_deliveries"

    id: Mapped[uuid.UUID] = pk()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("swarm_projects.id", ondelete="CASCADE"), nullable=False)
    day: Mapped[int] = mapped_column(Integer, nullable=False)
    delivery_date: Mapped[date] = mapped_column(Date, nullable=False)
    target_units: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    delivered_units: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    status: Mapped[str] = mapped_column(Text, nullable=False)

    project: Mapped[SwarmProject] = relationship(back_populates="deliveries")

    __table_args__ = (UniqueConstraint("project_id", "day", name="one_delivery_per_day"),)


class ProjectEvidence(Base):
    __tablename__ = "project_evidence"

    id: Mapped[uuid.UUID] = pk()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("swarm_projects.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    document_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped[SwarmProject] = relationship(back_populates="evidence")


class IndustryNews(Base):
    """Cache for the trends module. id is the fetcher hash of sector plus URL."""

    __tablename__ = "industry_news"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    sector: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    observed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    date_source: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str | None] = mapped_column(Text)
    raw: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
