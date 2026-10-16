import json
from datetime import datetime
from decimal import Decimal
from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook
from pydantic import ValidationError

from app.main import app
from app.schemas import FinancialInput
from engines.financial_engine import calculate_statement
from parsers import excel_parser
from parsers.excel_parser import ExtractionError, parse_excel, parse_excel_file


def payload(**changes):
    data = json.loads((Path(__file__).parents[1] / "examples/analysis_input.json").read_text(encoding="utf-8"))
    return {**data, **changes}


def workbook_bytes(rows, *, sheet="Financials", header=("field", "value")):
    book = Workbook()
    book.active.title = sheet
    book.active.append(header)
    for row in rows:
        book.active.append(row)
    stream = BytesIO()
    book.save(stream)
    book.close()
    return stream.getvalue()


def translated_rows(data):
    rows = []
    for key, value in data.items():
        if isinstance(value, dict):
            rows.extend((f"{key}.{subkey}", subvalue) for subkey, subvalue in value.items())
        else:
            aliases = excel_parser._TRANSLATIONS.get(key, ())
            label = next((alias for alias in aliases if any("\u0e00" <= char <= "\u0e7f" for char in alias)), key)
            rows.append((label, value))
    return rows


@pytest.mark.parametrize("label", ["Inventory", "Stock", "สินค้าคงเหลือ", "สต็อก"])
def test_inventory_aliases_preserve_explicit_amount_without_filling_missing_total(label):
    parsed = parse_excel(workbook_bytes([*translated_rows(payload()), (label, "1234.50")]), "statement.xlsx")
    assert parsed.inventory == Decimal("1234.50")
    assert parsed.total_expenses is None


def test_thai_workbook_matches_manual_metrics_grade_and_existing_api():
    data = payload(total_expenses="200000", net_income=None)
    content = workbook_bytes(translated_rows(data), header=("รายการ", "จำนวนเงิน"))
    parsed = parse_excel(content, "Financial_Statement_Translated.xlsx")
    assert parsed == FinancialInput.model_validate(data)
    result = calculate_statement(parsed)
    assert result["data"]["net_profit"]["value"] == "50000.00"
    assert result["data"]["total_cost"]["value"] == "200000.00"
    assert result["data"]["fcf"]["value"] == "50000.00"
    assert result["grading"]["grade"] == "B"
    assert result["grading"]["score"] == "75.00"
    response = TestClient(app).post("/api/v1/analyze/excel", files={"file": ("statement.xlsx", content)})
    assert response.status_code == 200
    assert response.json()["data"]["grading"]["score"] == "75.00"


def test_english_aliases_accounting_amounts_excel_dates_and_aggregate_expenses():
    rows = [("currency", "THB"), ("kind", "actual"), ("Period Start", datetime(2026, 9, 1)),
            ("Period End", datetime(2026, 9, 30)), ("Total Assets", "100,000.00"),
            ("Liabilities", "60,000.00"), ("Equity", "40,000.00"), ("Revenues", "25,000.00"),
            ("Expenses", "30,000.00"), ("Operating Cash Flow", "(1,000.25)"),
            ("Investing Cash Flow", "(500.00)"), ("Financing Cash Flow", 0)]
    parsed = parse_excel(workbook_bytes(rows), "statement.xlsx")
    assert parsed.net_income == Decimal("-5000.00")
    assert parsed.operating_cash_flow == Decimal("-1000.25")
    assert parsed.investing_cash_flow == Decimal("-500.00")
    result = calculate_statement(parsed)
    assert result["data"]["net_profit"]["value"] == "-5000.00"
    assert result["data"]["total_cost"]["value"] == "30000.00"
    assert result["data"]["net_cash_flow"]["value"] == "-1500.25"
    assert result["grading"]["grade"] is None


@pytest.mark.parametrize("label,value", [
    ("สินทรัพย์", "1000000"), ("Total Assets", None), ("Assets", "1,00"),
    ("รายได้", "=1000+1"), ("ค่าใช้จ่าย", "#DIV/0!"), ("Cash Flows", "123"),
])
def test_rejects_duplicate_aliases_formulas_errors_and_ambiguous_labels(label, value):
    with pytest.raises(ExtractionError):
        parse_excel(workbook_bytes([*translated_rows(payload()), (label, value)]), "statement.xlsx")


@pytest.mark.parametrize("changes", [
    {"assets": "1000001"}, {"total_expenses": "190000"}, {"total_expenses": "210000"},
    {"total_expenses": "200000", "net_income": "1"}, {"total_expenses": "NaN"},
    {"total_expenses": -1},
])
def test_rejects_unbalanced_or_inconsistent_financials(changes):
    with pytest.raises(ValidationError):
        parse_excel(workbook_bytes(translated_rows(payload(**changes))), "statement.xlsx")


def test_aggregate_total_cannot_be_smaller_than_known_categories():
    with pytest.raises(ValidationError, match="Known expense categories"):
        FinancialInput.model_validate(payload(total_expenses="100000", tax_expense=None))


@pytest.mark.parametrize("amount", ["1,00", "(1,00)", "(-1)", "THB 100", "NaN", True])
def test_invalid_amount_strings_are_not_silently_normalized(amount):
    rows = translated_rows(payload(operating_cash_flow=amount))
    with pytest.raises((ExtractionError, ValidationError)):
        parse_excel(workbook_bytes(rows), "statement.xlsx")


def test_blank_total_expenses_does_not_invent_net_income():
    data = payload(total_expenses=None, net_income=None)
    parsed = parse_excel(workbook_bytes(translated_rows(data)), "statement.xlsx")
    assert parsed.net_income is None
    assert parsed.total_expenses is None


def test_local_file_with_explicit_sheet_name_and_missing_template(tmp_path):
    path = tmp_path / "Financial_Statement_Translated.xlsx"
    path.write_bytes(workbook_bytes(translated_rows(payload()), sheet="Statement"))
    assert parse_excel_file(path, sheet_name="Statement").assets == Decimal("1000000")
    with pytest.raises(FileNotFoundError):
        parse_excel_file(tmp_path / "missing.xlsx")


def test_expanded_archive_limit(monkeypatch):
    monkeypatch.setattr(excel_parser, "MAX_EXPANDED_BYTES", 1)
    with pytest.raises(ExtractionError, match="expanded size"):
        parse_excel(workbook_bytes(translated_rows(payload())), "statement.xlsx")
