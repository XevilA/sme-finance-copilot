"""Shared validated contracts for manual and English/Thai Excel inputs."""

from parsers.excel_parser import (
    ExtractionError, MAX_EXPANDED_BYTES, MAX_ROWS, MAX_UPLOAD_BYTES, parse_excel,
)

from .schemas import FinancialInput


def parse_manual(payload: dict) -> FinancialInput:
    return FinancialInput.model_validate(payload)
