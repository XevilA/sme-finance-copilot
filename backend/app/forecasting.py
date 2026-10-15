"""Pure dated cash forecasts and projected obligations; no database writes."""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP, localcontext
import json
from uuid import NAMESPACE_URL, UUID, uuid5

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, TypeAdapter

from .schemas import Money, PositiveMoney

_MONEY = TypeAdapter(Money)
_POSITIVE = TypeAdapter(PositiveMoney)
_DATE = TypeAdapter(date)
_ZERO = Decimal(0)
_HORIZONS = (30, 60, 90)


class CashEvent(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    id: str = Field(min_length=1, max_length=200)
    event_date: date = Field(validation_alias=AliasChoices("date", "event_date"))
    amount: PositiveMoney
    is_inflow: bool = Field(strict=True, validation_alias=AliasChoices("isInflow", "is_inflow"))
    status: str
    sme_id: str | None = None


class Obligation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=200)
    due_date: date
    amount: PositiveMoney
    title: str = Field(min_length=1, max_length=500)
    partner: str | None = Field(default=None, max_length=200)


def _cash(value: Decimal | None) -> str | None:
    return None if value is None else format(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), "f")


def _events(rows: list[dict], include_simulated: bool) -> list[CashEvent]:
    if len(rows) > 10000:
        raise ValueError("At most 10000 dated cash events are supported")
    seen = {}
    scopes = set()
    for row in rows:
        event = CashEvent.model_validate(row)
        if event.status not in {"confirmed", "projected", "simulated"}:
            raise ValueError(f"Event {event.id}: unsupported status")
        if event.sme_id is not None:
            scopes.add(event.sme_id)
        if event.id in seen and event != seen[event.id]:
            raise ValueError(f"Conflicting duplicate cash event id: {event.id}")
        seen[event.id] = event
    if len(scopes) > 1:
        raise ValueError("Cash events from different SMEs cannot be combined")
    return sorted((event for event in seen.values() if include_simulated or event.status != "simulated"),
                  key=lambda event: (event.event_date, event.id))


def forecast_cashflow(events: list[dict] | None, *, opening_cash: Decimal | None, as_of: date,
                      minimum_cash_reserve: Decimal | None = None,
                      schedule_complete_through: date | None = None,
                      include_simulated: bool = False) -> dict:
    """Opening cash includes all movements through as_of; forecast starts next day.

    End-of-day netting is used because source rows have dates, not timestamps.
    Completeness is an explicit caller assertion, never the last available date.
    """
    as_of = _DATE.validate_python(as_of)
    if as_of.toordinal() + 90 > date.max.toordinal():
        raise ValueError("The 90-day horizon exceeds the supported calendar")
    if type(include_simulated) is not bool:
        raise ValueError("include_simulated must be boolean")
    complete = None if schedule_complete_through is None else _DATE.validate_python(schedule_complete_through)
    if complete is not None and complete < as_of:
        raise ValueError("schedule_complete_through cannot precede as_of")
    opening = None if opening_cash is None else _MONEY.validate_python(opening_cash)
    reserve = None if minimum_cash_reserve is None else _POSITIVE.validate_python(minimum_cash_reserve)
    source_rows = None if events is None else _events(events, include_simulated)
    last_date = as_of + timedelta(days=90)
    future_rows = [] if source_rows is None else [event for event in source_rows if as_of < event.event_date <= last_date]
    missing = []
    if opening is None:
        missing.append("opening_cash")
    if source_rows is None or not source_rows and complete is None:
        missing.append("cash_events")
    elif not future_rows and complete is None:
        missing.append("future_cash_events")
    if complete is None:
        missing.append("schedule_complete_through")
    usable = opening is not None and "cash_events" not in missing and "future_cash_events" not in missing
    with localcontext() as context:
        context.prec = 50
        timeline = []
        balance = opening
        minimum = opening if usable else None
        min_date = as_of if usable else None
        threshold = reserve if reserve is not None else _ZERO
        first_shortfall = as_of if usable and opening < threshold else None
        first_negative = as_of if usable and opening < 0 else None
        first_reserve = as_of if usable and reserve is not None and opening < reserve else None
        by_day = defaultdict(lambda: {"inflow": _ZERO, "outflow": _ZERO, "event_ids": []})
        for event in future_rows:
            row = by_day[event.event_date]
            row["inflow" if event.is_inflow else "outflow"] += event.amount
            row["event_ids"].append(event.id)
        if usable:
            for event_date, row in sorted(by_day.items()):
                net = row["inflow"] - row["outflow"]
                balance += net
                if balance < minimum:
                    minimum, min_date = balance, event_date
                if first_shortfall is None and balance < threshold:
                    first_shortfall = event_date
                if first_negative is None and balance < 0:
                    first_negative = event_date
                if first_reserve is None and reserve is not None and balance < reserve:
                    first_reserve = event_date
                timeline.append({"date": event_date.isoformat(), "inflow": _cash(row["inflow"]),
                                 "outflow": _cash(row["outflow"]), "net_change": _cash(net),
                                 "cash_balance": _cash(balance), "event_ids": sorted(row["event_ids"])})
        periods = {}
        conditional = {}
        for days in _HORIZONS:
            end = as_of + timedelta(days=days)
            at_end = opening if usable else None
            if usable:
                for row in timeline:
                    if row["date"] <= end.isoformat():
                        at_end = Decimal(row["cash_balance"])
            conditional[str(days)] = _cash(at_end)
            periods[str(days)] = _cash(at_end) if complete is not None and complete >= end else None
            if complete is not None and complete < end:
                missing.append(f"cash_schedule_through_{end.isoformat()}")
        full = usable and complete is not None and complete >= last_date
        return {"kind": "simulated" if include_simulated else "forecast", "status": "ok" if full else "insufficient_data",
                "as_of": as_of.isoformat(), "unit": "THB", "opening_cash": _cash(opening),
                "schedule_complete_through": None if complete is None else complete.isoformat(),
                "minimum_cash": _cash(minimum) if full else None,
                "minimum_cash_date": min_date.isoformat() if full else None,
                "first_shortfall_date": first_shortfall.isoformat() if full and first_shortfall else None,
                "first_negative_date": first_negative.isoformat() if full and first_negative else None,
                "first_reserve_breach_date": first_reserve.isoformat() if full and first_reserve else None,
                "minimum_cash_reserve": _cash(reserve), "period_end_balances": periods,
                "conditional_minimum_cash": _cash(minimum),
                "conditional_first_shortfall_date": None if first_shortfall is None else first_shortfall.isoformat(),
                "conditional_period_end_balances": conditional, "timeline": timeline, "missing": sorted(set(missing)),
                "assumptions": ["Caller supplies one SME's THB events and the closing cash snapshot at as_of",
                                "Events dated on/before as_of are already included in opening cash and are not applied twice",
                                "Source events are netted at end of day; intraday timing and unscheduled movements are unknown",
                                "30/60/90-day balances include all supplied events through each horizon's end date",
                                "Completeness must be explicitly confirmed through each horizon; conditional outputs are not complete forecasts",
                                "Shortfall means below the supplied reserve, or negative bank cash when no reserve is supplied",
                                "Simulated events are excluded unless explicitly requested; no historical total is spread across dates"]}


def project_cash_events(*, as_of: date, sme_id: str, project_id: str | None = None,
                        receivables: list[dict] | None = None, payables: list[dict] | None = None,
                        operating_costs: list[dict] | None = None, installments: list[dict] | None = None) -> dict:
    """Generate cash_events-compatible rows for CLAUDE to upsert, never write DB.

    None means an unknown category; [] means explicitly no obligations. Stable
    UUIDs use SME, project, category and source id, so corrected dates/amounts
    update the same event. Missing dates/amounts are validation errors.
    """
    as_of = _DATE.validate_python(as_of)
    if not sme_id or not isinstance(sme_id, str):
        raise ValueError("sme_id is required")
    sme_id = str(UUID(sme_id))
    project_id = None if project_id is None else str(UUID(project_id))
    categories = {"receivables": receivables, "payables": payables, "operating_costs": operating_costs, "installments": installments}
    if sum(len(rows) for rows in categories.values() if rows is not None) > 10000:
        raise ValueError("At most 10000 projected obligations are supported")
    events, missing, overdue = [], [], []
    for category, rows in categories.items():
        if rows is None:
            missing.append(category)
            continue
        seen = set()
        for raw in rows:
            row = Obligation.model_validate(raw)
            if row.id in seen:
                raise ValueError(f"Duplicate obligation id in {category}: {row.id}")
            seen.add(row.id)
            if row.due_date <= as_of:
                overdue.append({"category": category, "source_id": row.id, "due_date": row.due_date.isoformat()})
                missing.append(f"rescheduled_due_date:{category}:{row.id}")
                continue
            identifier = str(uuid5(NAMESPACE_URL, json.dumps(["sme-swarm-cash-v1", sme_id, project_id, category, row.id], separators=(",", ":"))))
            events.append({"id": identifier, "sme_id": sme_id, "project_id": project_id,
                           "event_date": row.due_date.isoformat(), "day_index": (row.due_date - as_of).days,
                           "type": "receive_payment" if category == "receivables" else "pay_obligations",
                           "title": row.title, "amount": _cash(row.amount), "is_inflow": category == "receivables",
                           "partner": row.partner, "status": "projected", "impact_reason": f"Projected from dated {category} obligation; no inferred payment date or amount"})
    return {"events": sorted(events, key=lambda row: (row["event_date"], row["id"])),
            "missing": sorted(set(missing)), "overdue": overdue,
            "status": "ok" if not missing else "insufficient_data"}
