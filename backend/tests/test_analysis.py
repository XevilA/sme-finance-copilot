import json
from io import BytesIO
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook

from app import ai_provider
from app.main import app

client = TestClient(app)


def payload(**changes):
    data = json.loads((Path(__file__).parents[1] / "examples/analysis_input.json").read_text())
    return {**data, **changes}


def analyze(data=None, **options):
    return client.post("/api/analyze", json={"input": data or payload(), **options})


def excel_bytes(data):
    book = Workbook()
    book.active.title = "Financials"
    book.active.append(["field", "value"])
    for key, value in data.items():
        if isinstance(value, dict):
            for subkey, subvalue in value.items():
                book.active.append([f"{key}.{subkey}", subvalue])
        else:
            book.active.append([key, value])
    output = BytesIO()
    book.save(output)
    book.close()
    return output.getvalue()


def test_complete_analysis_has_auditable_metrics_grade_and_evidence():
    response = analyze()
    assert response.status_code == 200
    body = response.json()
    # Behaviour changed: the envelope now declares the two analysis context
    # inputs it never queried. A request naming no stored SME has no expense
    # history and no cash events to read, so it cannot confirm an unusual
    # expense or a dated shortfall, and status follows missing as everywhere
    # else. The statement's own fields are all present, which is why nothing
    # else appears in the list.
    assert body["missing"] == ["cash_forecast", "expense_history"]
    assert body["status"] == "insufficient_data"
    assert body["kind"] == "simulated"
    assert body["data"]["grading"]["score"] == "75.00"
    assert body["data"]["grading"]["grade"] == "B"
    assert body["data"]["metrics"]["breakeven_units"]["value"] == "1154.0000"
    assert body["data"]["aiMode"] == "rules"
    metrics = body["data"]["metrics"]
    assert len(metrics) == 18
    for finding in body["data"]["findings"]:
        assert finding["evidenceIds"]
        assert all(metrics[key]["value"] is not None for key in finding["evidenceIds"])
    targets = {item["id"] for item in body["data"]["indicators"]}
    for evidence in body["data"]["explanation"]["dataUsed"]:
        assert evidence["targetElementId"] in targets
        assert evidence["value"].startswith(metrics[evidence["id"]]["value"])


def test_negative_cashflow_and_debt_service_shortfall_are_explained():
    body = analyze(payload(operating_cash_flow="-1000", cash_available_for_debt_service="10000")).json()
    findings = {item["id"]: item for item in body["data"]["findings"]}
    assert "debt_service_shortfall" in findings
    assert "cash_decrease" in findings
    assert "capex_cash_pressure" in findings
    assert findings["debt_service_shortfall"]["evidenceIds"] == ["dscr"]
    assert next(item for item in body["data"]["indicators"] if item["id"] == "health-dscr")["status"] == "danger"


def test_unrounded_ratios_drive_risk_decisions():
    data = payload(cash_available_for_debt_service="29999.99")
    body = analyze(data).json()["data"]
    assert body["metrics"]["dscr"]["value"] == "1.0000"
    assert "debt_service_shortfall" in {item["id"] for item in body["findings"]}
    assert next(item for item in body["indicators"] if item["id"] == "health-dscr")["status"] == "danger"


def test_partial_data_and_zero_denominators_are_explicit():
    body = analyze(payload(revenue=None, operating_cash_outflow="0", debt_principal_due="0", debt_interest_due="0")).json()
    assert body["status"] == "insufficient_data"
    assert body["data"]["grading"]["grade"] is None
    assert body["data"]["metrics"]["net_profit"]["value"] is None
    assert "revenue" in body["missing"]
    dscr = next(item for item in body["data"]["indicators"] if item["id"] == "health-dscr")
    assert dscr["value"] is None
    assert "zero" in dscr["interpretation"].lower()


def test_stateless_requests_do_not_share_analysis_data():
    first = analyze().json()
    second = analyze(payload(operating_cash_flow="10000")).json()
    third = analyze().json()
    assert first["inputHash"] == third["inputHash"] != second["inputHash"]
    assert first["data"] == third["data"]


def test_excel_and_json_share_the_analysis_contract():
    data = payload()
    manual = analyze(data).json()
    excel = client.post("/api/v1/analyze/excel", files={"file": ("analysis.xlsx", excel_bytes(data))})
    assert excel.status_code == 200
    assert excel.json()["data"] == manual["data"]
    assert excel.json()["inputHash"] == manual["inputHash"]


def test_analysis_rejects_unbalanced_input_and_invalid_profit():
    assert analyze(payload(equity="1")).status_code == 422
    assert analyze(payload(net_income="1")).status_code == 422
    assert analyze(use_llm="false").status_code == 422


def test_example_and_versioned_alias():
    example = client.get("/api/v1/analysis/example")
    assert example.status_code == 200
    assert example.json()["kind"] == "simulated"
    assert client.post("/api/v1/analyze", json={"input": example.json()["data"]}).status_code == 200


def test_downloaded_template_round_trips_through_the_excel_api():
    template = client.get("/api/v1/analysis/template.xlsx")
    assert template.status_code == 200
    assert "analysis-template.xlsx" in template.headers["content-disposition"]
    result = client.post("/api/v1/analyze/excel", files={"file": ("template.xlsx", template.content)})
    assert result.status_code == 200
    assert result.json()["data"]["grading"]["score"] == "75.00"
    assert result.json()["kind"] == "simulated"


def test_model_is_opt_in_and_missing_configuration_is_disclosed(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
    default = analyze().json()["data"]
    requested = analyze(use_llm=True).json()["data"]
    assert default["aiWarning"] is None
    assert requested["aiMode"] == "rules"
    assert "missing" in requested["aiWarning"]
    assert requested["explanation"]["warning"] == requested["aiWarning"]


def mock_provider(monkeypatch, response_body=None, failure=False):
    monkeypatch.setenv("OPENAI_API_KEY", "test-only-key")
    monkeypatch.setenv("OPENAI_MODEL", "test-model")
    calls = []

    class FakeClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, **kwargs):
            calls.append(kwargs)
            if failure:
                raise httpx.ReadTimeout("test timeout")
            return httpx.Response(200, request=httpx.Request("POST", url), json=response_body)

    monkeypatch.setattr(ai_provider.httpx, "AsyncClient", FakeClient)
    return calls


def provider_output(value):
    return {"status": "completed", "output": [{"type": "message", "content": [{"type": "output_text", "text": json.dumps(value)}]}]}


def test_model_can_prioritize_only_existing_findings_without_changing_math(monkeypatch):
    baseline = analyze().json()["data"]
    calls = mock_provider(monkeypatch, provider_output({"finding_ids": ["period_profit"]}))
    result = analyze(use_llm=True).json()["data"]
    assert result["aiMode"] == "openai"
    assert result["prioritizedFindingIds"] == ["period_profit"]
    assert result["findings"][0]["id"] == "unfunded_working_capital"
    assert {item["id"] for item in result["findings"]} == {item["id"] for item in baseline["findings"]}
    assert result["metrics"] == baseline["metrics"]
    assert result["grading"] == baseline["grading"]
    assert calls[0]["json"]["store"] is False
    assert calls[0]["json"]["text"]["format"]["strict"] is True
    # No raw workbook, contact details, or browser-entered arbitrary fields are sent.
    assert set(json.loads(calls[0]["json"]["input"])) == {"metrics", "grading", "findings"}


@pytest.mark.parametrize("provider_body", [
    provider_output({"finding_ids": ["invented_approval"]}),
    provider_output({"finding_ids": ["period_profit"], "score": 100}),
    provider_output({"finding_ids": []}), {"status": "incomplete", "output": []}, [],
])
def test_invalid_model_output_falls_back_without_losing_results(monkeypatch, provider_body):
    mock_provider(monkeypatch, provider_body)
    result = analyze(use_llm=True).json()["data"]
    assert result["aiMode"] == "rules"
    assert result["aiWarning"]
    assert result["grading"]["score"] == "75.00"


def test_provider_timeout_falls_back_without_exposing_credentials(monkeypatch):
    mock_provider(monkeypatch, failure=True)
    response = analyze(use_llm=True)
    assert response.status_code == 200
    assert response.json()["data"]["aiMode"] == "rules"
    assert "test-only-key" not in response.text
