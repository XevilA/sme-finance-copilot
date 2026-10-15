"""Finite-order cash schedules; no production continues after delivery."""

from datetime import date, timedelta
from decimal import Decimal, localcontext


def finite_order_schedule(*, daily_cost: Decimal, revenue: Decimal, duration_days: int,
                          payment_terms_days: int, deposit_ratio: Decimal,
                          start_date: date | None = None,
                          collections: list[tuple[int, Decimal]] | None = None) -> list[dict]:
    """Day 0 deposit; daily costs at day start; buyer collections at day end.

    Collection fractions split the invoice remaining after the initial deposit.
    Without a calendar origin, day_index remains relative; dates are not invented.
    """
    with localcontext() as context:
        context.prec = 50
        deposit = revenue * deposit_ratio
        final_balance = revenue - deposit
        payments = collections if collections is not None else [(duration_days + payment_terms_days, Decimal(1))]
        movements = [(0, 0, deposit, "deposit")]
        movements += [(day, 0, -daily_cost, "production_cost") for day in range(1, duration_days + 1)]
        movements += [(day, 1, final_balance * fraction, "buyer_collection") for day, fraction in payments]
        return [{"day_index": day, "date": None if start_date is None else (start_date + timedelta(days=day)).isoformat(),
                 "amount": amount, "type": kind}
                for day, priority, amount, kind in sorted(movements, key=lambda row: (row[0], row[1]))]


def peak_cash_deficit(movements: list[dict], *, include_deposit: bool = True) -> Decimal:
    with localcontext() as context:
        context.prec = 50
        balance = Decimal(0)
        minimum = Decimal(0)
        for movement in movements:
            if include_deposit or movement["type"] != "deposit":
                balance += movement["amount"]
                minimum = min(minimum, balance)
        return -minimum
