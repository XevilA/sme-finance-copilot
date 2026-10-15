import asyncio
from copy import deepcopy
import json
from pathlib import Path

import httpx
import pytest

from app import ai_provider
from app.analysis import build_analysis
from app.schemas import FinancialInput


def analysis():
    payload = json.loads((Path(__file__).parents[1] / "examples/analysis_input.json").read_text())
    return build_analysis(FinancialInput.model_validate(payload))


def invoke(monkeypatch, handler):
    monkeypatch.setenv("OPENAI_API_KEY", "test-only-key")
    monkeypatch.setenv("OPENAI_MODEL", "test-model")
    real_client = httpx.AsyncClient
    monkeypatch.setattr(ai_provider.httpx, "AsyncClient",
                        lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs))
    before = analysis()
    result = asyncio.run(ai_provider.apply_model_priorities(deepcopy(before)))
    assert result["data"]["metrics"] == before["data"]["metrics"]
    assert result["data"]["grading"] == before["data"]["grading"]
    canonical = lambda rows: json.dumps(sorted(rows, key=lambda row: row["id"]), sort_keys=True, ensure_ascii=False).encode()
    assert canonical(result["data"]["findings"]) == canonical(before["data"]["findings"])
    severity = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    ranks = [severity[row["severity"]] for row in result["data"]["findings"]]
    assert ranks == sorted(ranks)
    assert "test-only-key" not in json.dumps(result)
    return result["data"]


@pytest.mark.parametrize("code", [401, 403, 429, 500])
def test_credential_credit_and_server_failures_keep_rules_without_leaking_provider_body(monkeypatch, code):
    result = invoke(monkeypatch, lambda request: httpx.Response(code, json={"error": {"message": "private-provider-detail"}}))
    assert result["aiMode"] == "rules"
    assert result["aiWarning"]
    assert "private-provider-detail" not in json.dumps(result)
    assert result["explanation"]["warning"] == result["aiWarning"]


@pytest.mark.parametrize("body", [b"{", b'{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"{"}]}]}',
                                 b'{"status":"completed","output":[{"type":"message","content":[{"type":"refusal","refusal":"declined"}]}]}'])
def test_malformed_json_or_refusal_keeps_deterministic_rules(monkeypatch, body):
    result = invoke(monkeypatch, lambda request: httpx.Response(200, content=body))
    assert result["aiMode"] == "rules"
    assert result["aiWarning"]


def test_transport_timeout_uses_rules(monkeypatch):
    def timeout(request):
        raise httpx.ReadTimeout("timeout", request=request)

    assert invoke(monkeypatch, timeout)["aiMode"] == "rules"


def test_valid_structured_json_over_http_transport_preserves_all_financial_evidence(monkeypatch):
    calls = []

    def valid(request):
        calls.append(json.loads(request.content))
        return httpx.Response(200, json={"status": "completed", "output": [{"type": "message", "content": [
            {"type": "output_text", "text": json.dumps({"finding_ids": ["period_profit"]})}]}]})

    result = invoke(monkeypatch, valid)
    assert result["aiMode"] == "openai"
    assert result["aiModel"] == "test-model"
    assert result["aiWarning"] is None
    assert len(calls) == 1
    assert calls[0]["text"]["format"]["type"] == "json_schema"
    assert calls[0]["text"]["format"]["strict"] is True
    assert calls[0]["text"]["format"]["schema"]["additionalProperties"] is False
    assert calls[0]["store"] is False
    assert calls[0]["max_output_tokens"] == 600
