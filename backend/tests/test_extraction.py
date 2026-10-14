from io import BytesIO

import pytest
from openpyxl import Workbook
from pydantic import ValidationError

from app.extraction import ExtractionError, parse_excel, parse_manual


def base_payload():
    return dict(currency="THB", kind="actual", period_start="2026-09-01", period_end="2026-09-30",
                assets="100000", liabilities="60000", equity="40000")


def workbook_bytes(rows, sheet="Financials"):
    book = Workbook()
    book.active.title = sheet
    for row in rows:
        book.active.append(row)
    stream = BytesIO()
    book.save(stream)
    book.close()
    return stream.getvalue()


def test_manual_and_excel_agree():
    payload = base_payload()
    payload["net_income"] = "-5000.25"
    content = workbook_bytes([("field", "value"), *payload.items()])
    assert parse_excel(content, "input.xlsx") == parse_manual(payload)


def test_balance_tolerance_and_negative_equity():
    payload = base_payload()
    assert parse_manual({**payload, "equity": "40000.01"})
    assert parse_manual({**payload, "liabilities": "110000", "equity": "-10000"})
    with pytest.raises(ValidationError, match="Balance sheet mismatch"):
        parse_manual({**payload, "equity": "40000.02"})


@pytest.mark.parametrize("patch", [
    {"assets": True}, {"assets": "NaN"}, {"assets": "Infinity"}, {"assets": "1,000"},
    {"assets": -1}, {"assets": "100000.001"}, {"asset": 10},
    {"current_assets": "100001"}, {"current_liabilities": "60001"},
    {"cash_balance": "100001"}, {"current_assets": "100", "cash_balance": "101"},
    {"period_end": "2026-08-31"},
])
def test_rejects_invalid_manual_values(patch):
    with pytest.raises(ValidationError):
        parse_manual({**base_payload(), **patch})


@pytest.mark.parametrize("extra", [
    ("assets", 100000), ("unsupported_field", 1), ("net_income", "=1+2"), ("net_income", "#DIV/0!"),
])
def test_excel_rejects_duplicates_unknowns_formulas_errors(extra):
    content = workbook_bytes([("field", "value"), *base_payload().items(), extra])
    with pytest.raises(ExtractionError):
        parse_excel(content, "input.xlsx")


def test_excel_loan_and_blank_optional_field():
    rows = [("field", "value"), *base_payload().items(), ("net_income", None),
            ("loan.principal", "12000"), ("loan.annual_interest_rate", "0.12"),
            ("loan.periods", 12), ("loan.payments_per_year", 12)]
    data = parse_excel(workbook_bytes(rows), "input.xlsx")
    assert data.net_income is None
    assert data.loan.periods == 12


@pytest.mark.parametrize("filename,content", [("input.xls", b"abc"), ("input.xlsx", b""),
    ("input.xlsx", b"bad zip"), ("input.xlsx", b"x" * (5 * 1024 * 1024 + 1))],
    ids=["legacy-xls", "empty", "corrupt-zip", "oversized"])
def test_invalid_workbook(filename, content):
    with pytest.raises(ExtractionError):
        parse_excel(content, filename)


def test_excel_wrong_sheet_header_and_overflow():
    for content in [workbook_bytes([("field", "value")], "Other"),
                    workbook_bytes([("name", "amount")]),
                    workbook_bytes([("field", "value"), *[(None, None)] * 100, ("assets", 1)])]:
        with pytest.raises(ExtractionError):
            parse_excel(content, "input.xlsx")
