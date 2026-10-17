"""Synthetic workbooks only; preview must never persist or call AI."""

from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import upload
from test_statement_parser import content, fixture_book


@pytest.fixture
def client(monkeypatch):
    def no_session(*args, **kwargs):
        raise AssertionError("Preview must not open a DB session")
    monkeypatch.setattr(upload, "session_scope", no_session)
    rejection = AsyncMock(side_effect=AssertionError("Preview must not record a rejection"))
    monkeypatch.setattr(upload, "record_rejection", rejection)
    return TestClient(app)


def test_preview_preserves_sections_currency_and_unknowns_without_grading(client):
    response = client.post("/api/v1/upload/preview", files={"file": ("statement.xlsx", content(fixture_book()))})
    assert response.status_code == 200
    body = response.json()
    assert body["format"] == "statements"
    assert body["persisted"] is False
    assert "input" not in body
    assert len(body["statements"]) == 6
    assert body["grading"]["grade"] is None
    assert body["statements"][0]["currency"] == "THB"
    assert body["statements"][4]["currency"] == "USD"
    assert body["statements"][2]["fields"]["revenue"] == "10000"


def test_canonical_preview_can_be_analysed_without_writing(client):
    template = client.get("/api/v1/analysis/template.xlsx")
    response = client.post("/api/v1/upload/preview", files={"file": ("template.xlsx", template.content)})
    assert response.status_code == 200
    body = response.json()
    assert body["format"] == "financials"
    assert body["persisted"] is False
    assert body["source"] == "supplied_input"
    analysed = client.post("/api/v1/analyze", json={"input": body["input"], "use_llm": False})
    assert analysed.status_code == 200
    assert analysed.json()["source"] == "supplied_input"


def test_invalid_checks_are_visible_without_enabling_grading(client):
    book = fixture_book()
    book.active["B5"] = 100001
    response = client.post("/api/v1/upload/preview", files={"file": ("invalid.xlsx", content(book))})
    assert response.status_code == 200
    assert response.json()["statements"][0]["status"] == "invalid"
    assert response.json()["grading"]["grade"] is None


@pytest.mark.parametrize("filename,payload", [("bad.xlsx", b"bad"), ("bad.csv", b"field,value"), ("empty.xlsx", b"")])
def test_preview_rejects_unreadable_files_without_writes(client, filename, payload):
    response = client.post("/api/v1/upload/preview", files={"file": (filename, payload)})
    assert response.status_code == 422


def test_preview_rejects_formula_and_oversize_before_any_write(client):
    book = fixture_book()
    book.active["B5"] = "=1+1"
    assert client.post("/api/v1/upload/preview", files={"file": ("formula.xlsx", content(book))}).status_code == 422
    assert client.post("/api/v1/upload/preview", files={"file": ("large.xlsx", b"x" * (5 * 1024 * 1024 + 1))}).status_code == 413
