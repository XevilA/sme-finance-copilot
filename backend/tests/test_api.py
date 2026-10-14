import json
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

from fastapi.testclient import TestClient
from openpyxl import Workbook

from app.main import app

client = TestClient(app)


def payload():
    return json.loads((Path(__file__).parents[1] / "examples/manual_input.json").read_text())


def workbook(data):
    book = Workbook()
    book.active.title = "Financials"
    book.active.append(["field", "value"])
    for key, value in data.items():
        if isinstance(value, dict):
            for subkey, subvalue in value.items():
                book.active.append([f"{key}.{subkey}", subvalue])
        else:
            book.active.append([key, value])
    stream = BytesIO()
    book.save(stream)
    book.close()
    return stream.getvalue()


def test_health_and_manual_validation():
    assert client.get("/health").json()["status"] == "ok"
    response = client.post("/api/v1/inputs/manual", json=payload())
    assert response.status_code == 200
    assert response.json()["balanceSheetValid"] is True


def test_excel_and_manual_calculations_agree():
    data = payload()
    manual = client.post("/api/v1/finance/calculate", json=data)
    excel = client.post("/api/v1/finance/calculate/excel", files={"file": ("input.xlsx", workbook(data))})
    assert manual.status_code == excel.status_code == 200
    assert excel.json()["data"] == manual.json()["data"]
    assert excel.json()["kind"] == "simulated"


def test_balance_mismatch_returns_422_for_both_sources():
    data = {**payload(), "equity": "1"}
    assert client.post("/api/v1/inputs/manual", json=data).status_code == 422
    response = client.post("/api/v1/inputs/excel", files={"file": ("input.xlsx", workbook(data))})
    assert response.status_code == 422
    assert "Balance sheet mismatch" in response.json()["detail"][0]["msg"]


def test_invalid_excel_and_upload_limit():
    response = client.post("/api/v1/inputs/excel", files={"file": ("input.xlsx", b"bad zip")})
    assert response.status_code == 422
    response = client.post("/api/v1/inputs/excel", files={"file": ("input.xlsx", b"x" * (5 * 1024 * 1024 + 1))})
    assert response.status_code == 413


def test_corrupt_worksheet_returns_422():
    stream = BytesIO()
    with ZipFile(BytesIO(workbook(payload()))) as source, ZipFile(stream, "w") as target:
        for entry in source.infolist():
            content = source.read(entry.filename)
            if entry.filename == "xl/worksheets/sheet1.xml":
                content = content.replace(b"</sheetData>", b"</broken>")
            target.writestr(entry.filename, content)
    response = client.post("/api/v1/inputs/excel", files={"file": ("input.xlsx", stream.getvalue())})
    assert response.status_code == 422


def test_cors_allows_deployed_frontend():
    response = client.options("/api/v1/finance/calculate", headers={
        "Origin": "https://sme-finance-copilot.vercel.app", "Access-Control-Request-Method": "POST"})
    assert response.headers["access-control-allow-origin"] == "https://sme-finance-copilot.vercel.app"


def test_partial_data_returns_explicit_missing_fields():
    data = payload()
    del data["net_income"]
    response = client.post("/api/v1/finance/calculate", json=data)
    assert response.status_code == 200
    assert response.json()["data"]["roe"]["missingFields"] == ["net_income"]
