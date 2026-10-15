"""Adapters from catalogue rows to the frontend list contracts.

Shapes are fixed by src/api/contracts/types.ts, which belongs to the frontend
owner. Same rule as adapters.py: anything not derivable from stored data is
served empty or null and named in `missing`, never filled with a number nobody
can defend.

Thresholds that are a presentation choice rather than accounting (stock
velocity bands, the funder recommendation ladder) are marked as demo policy
where they appear and are returned to the caller so the UI can disclose them.
"""

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

# Demo policy: inventory turnover bands, in days.
VELOCITY_FAST_DAYS = Decimal("7")
VELOCITY_NORMAL_DAYS = Decimal("21")

PROJECT_STATUS_TEXT = {
    "draft": "ร่าง",
    "under_review": "กำลังตรวจสอบ",
    "pending_approval": "รออนุมัติ",
    "in_progress": "กำลังดำเนินการ",
    "ready": "พร้อมเริ่มงาน",
    "has_issues": "มีประเด็นต้องแก้",
    "incomplete": "ข้อมูลไม่ครบ",
    "committed": "ยืนยันแล้ว",
    "completed": "ส่งมอบครบแล้ว",
    "closed": "ปิดโครงการ",
    "issue": "มีปัญหา",
}

# The UI's ProjectRecord status union is narrower than swarm_projects.status.
PROJECT_STATUS_MAP = {
    "draft": "draft",
    "ready": "in_progress",
    "has_issues": "issue",
    "incomplete": "under_review",
    "committed": "in_progress",
    "closed": "completed",
}

FUNDING_TYPE_LABEL = {
    "term_loan": "สินเชื่อระยะยาว",
    "po_financing": "สินเชื่อตามใบสั่งซื้อ",
    "invoice_financing": "ขายลดลูกหนี้การค้า",
    "grant": "เงินให้เปล่า/ทุนสนับสนุน",
    "revolving": "วงเงินหมุนเวียน",
}


def money(value: Decimal | float) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def percent(numerator: float, denominator: float) -> float:
    if denominator == 0:
        return 0.0
    ratio = Decimal(str(numerator)) / Decimal(str(denominator)) * 100
    return float(ratio.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def to_number(value) -> float | None:
    """The matcher serialises money and ratios as decimal strings."""
    if value is None:
        return None
    try:
        return float(Decimal(str(value)))
    except (InvalidOperation, ValueError):
        return None


# --- /shops ------------------------------------------------------------------

def shops(rows: list[dict]) -> tuple[list[dict], list[str]]:
    missing: list[str] = []
    out = []
    for row in rows:
        available = row["capacityTotal"] - row["capacityUsed"]
        # Status comes from the shop's latest allocation. With no allocation the
        # shop has no order exposure yet, so it is shown as ready to review.
        if row["allocationStatus"] is None:
            status = "review"
            note = row["statusNote"] or "ยังไม่ได้รับจัดสรรในออเดอร์ใด"
            if "shop_order_exposure" not in missing:
                missing.append("shop_order_exposure")
        else:
            status = row["allocationStatus"]
            note = row["statusNote"] or ""
        out.append({
            "id": row["id"],
            "name": row["name"],
            "monogram": row["monogram"] or "",
            "category": row["category"] or "",
            "capacityTotal": row["capacityTotal"],
            "capacityUsed": row["capacityUsed"],
            "capacityAvailable": available,
            "unit": row["unit"],
            "status": status,
            "statusNote": note,
            "costPerUnit": row["costPerUnit"],
            "workingCapitalNeeded": row["workingCapitalNeeded"] or 0,
            "currentCash": row["currentCash"],
            "fundingGap": row["fundingGap"] or 0,
            "location": row["location"] or "",
            "tags": row["tags"],
        })
    return out, missing


# --- /order ------------------------------------------------------------------

def swarm_order(project: dict) -> tuple[dict, list[str]]:
    missing: list[str] = []
    total_quantity = project["targetCapacity"] * project["durationDays"]
    for field, name in (("title", "order_title"), ("standard", "order_standard"),
                        ("deliveryLocation", "delivery_location"),
                        ("buyerRating", "buyer_rating"),
                        ("paymentTermsText", "payment_terms_text")):
        if project.get(field) in (None, ""):
            missing.append(name)
    return {
        "id": project["orderRef"],
        "title": project["title"] or project["orderRef"],
        "buyerName": project["buyerName"],
        "buyerRating": project["buyerRating"] or 0,
        "quantityPerDay": project["targetCapacity"],
        "days": project["durationDays"],
        "totalQuantity": total_quantity,
        "unitPrice": project["unitPrice"],
        "budgetTotal": money(Decimal(str(total_quantity)) * Decimal(str(project["unitPrice"]))),
        "targetDeliveryDate": project["deadline"] or "",
        "deliveryLocation": project["deliveryLocation"] or "",
        "standard": project["standard"] or "",
        "paymentTerms": project["paymentTermsText"] or f"เครดิต {project['paymentTermsDays']} วัน",
    }, missing


# --- /shops/{id}/finance -----------------------------------------------------

def shop_finance(stored: dict) -> tuple[dict, list[str]]:
    allocation = stored["allocation"]
    shop = stored["shop"]
    project = stored["project"]
    missing: list[str] = []

    share = allocation["sharePerDay"]
    total_units = share * project["durationDays"]
    price = allocation["sellingPricePerUnit"] or project["unitPrice"]
    revenue = money(Decimal(str(total_units)) * Decimal(str(price)))

    lines = {
        "rawMaterialCost": allocation["rawMaterialCost"],
        "additionalLaborCost": allocation["additionalLaborCost"],
        "deliveryCost": allocation["deliveryCost"],
        "serviceFee": allocation["serviceFee"],
    }
    if any(value is None for value in lines.values()):
        missing.append("allocation_cost_lines")
        total_cost = 0.0
        profit = 0.0
    else:
        total_cost = money(sum(Decimal(str(value)) for value in lines.values()))
        profit = money(Decimal(str(revenue)) - Decimal(str(total_cost)))

    # Running balance over the dated events, opening at the shop's cash.
    balance = Decimal(str(allocation["currentCash"]))
    timeline = []
    for event in stored["events"]:
        amount = Decimal(str(event["amount"]))
        balance = balance + amount if event["isInflow"] else balance - amount
        timeline.append({
            "dayIndex": event["dayIndex"],
            "date": event["date"],
            "type": event["type"],
            "title": event["title"],
            "amount": event["amount"],
            "cashBalance": money(balance),
            "note": event["impactReason"],
        })
    if not timeline:
        missing.append("shop_cash_events")

    return {
        "shopId": allocation["shopId"],
        "name": shop["name"] or "",
        "monogram": shop["monogram"] or "",
        "boxesPerDay": share,
        "totalBoxes": total_units,
        "sellingPricePerBox": price,
        "revenue": revenue,
        "rawMaterialCost": lines["rawMaterialCost"] or 0,
        "additionalLaborCost": lines["additionalLaborCost"] or 0,
        "deliveryCost": lines["deliveryCost"] or 0,
        "serviceFee": lines["serviceFee"] or 0,
        "totalCost": total_cost,
        "projectedProfit": profit,
        "profitMarginPercent": percent(profit, revenue),
        "upfrontCashNeeded": allocation["workingCapitalNeeded"],
        "currentCash": allocation["currentCash"],
        "minCashBalance": shop["minimumCashReserve"] or 0,
        "fundingGap": allocation["fundingGap"],
        "status": allocation["status"],
        "cashTimeline": timeline,
        "partyAcceptance": {
            "buyerSigned": allocation["buyerSigned"],
            "shopSigned": allocation["shopSigned"],
            "logisticsSigned": allocation["logisticsSigned"],
            "funderSigned": allocation["funderSigned"],
        },
    }, missing


# --- /cashflow/timeline ------------------------------------------------------

def cashflow_timeline(events: list[dict], opening_cash: float, reserve: float) -> tuple[list[dict], list[str]]:
    """One row per date that actually has an event.

    Days between events are not emitted: with no movement the balance does not
    change, and inventing rows would imply a daily series the data cannot
    support. The UI reads dayIndex, so gaps are explicit.
    """
    if not events:
        return [], ["dated_cash_events"]

    by_date: dict[str, list[dict]] = {}
    for event in events:
        by_date.setdefault(event["date"], []).append(event)

    balance = Decimal(str(opening_cash))
    reserve_decimal = Decimal(str(reserve))
    days = []
    for date in sorted(by_date):
        group = by_date[date]
        inflow = sum(Decimal(str(e["amount"])) for e in group if e["isInflow"])
        outflow = sum(Decimal(str(e["amount"])) for e in group if not e["isInflow"])
        net = inflow - outflow
        balance += net
        deficit = balance < reserve_decimal
        days.append({
            "date": date,
            "dayIndex": group[0]["dayIndex"],
            "projectedCash": money(balance),
            "reserveLine": money(reserve_decimal),
            "inflow": money(inflow),
            "outflow": money(outflow),
            "netChange": money(net),
            "isDeficit": deficit,
            "deficitAmount": money(reserve_decimal - balance) if deficit else None,
            "events": [
                {
                    "id": e["id"],
                    "date": e["date"],
                    "dayIndex": e["dayIndex"],
                    "type": e["type"],
                    "title": e["title"],
                    "amount": e["amount"],
                    "isInflow": e["isInflow"],
                    "partner": e["partner"],
                    "status": e["status"],
                    "impactReason": e["impactReason"],
                }
                for e in group
            ],
        })
    # actualCash and simulatedCash are separate series the stored events do not
    # distinguish, so they are left off rather than aliased to projectedCash.
    return days, ["actual_vs_simulated_cash_series"]


# --- /funding/options --------------------------------------------------------

def funding_options(
    products: list[dict], matches: list[dict] | None, requested_amount: float
) -> tuple[list[dict], list[str]]:
    """Merges catalogue metadata with the matcher's ranking.

    Scoring, eligibility and the repayment stress test all come from
    app/matching.py - this only reshapes them into the frontend FundingOption.
    Nothing is recomputed here, so a grant keeps the matcher's zero repayment
    instead of being amortised like a 0% loan.

    With no matcher result (no stored statement to score against) the products
    are still listed, as requires_info with a null payment and the reason
    declared, rather than shown with an invented score.
    """
    missing: list[str] = []
    by_product = {row.get("product_id"): row for row in (matches or [])}
    if matches is None:
        missing.append("financial_record_for_matching")

    options = []
    for product in products:
        match = by_product.get(product["id"])

        if match is None:
            score, status = 0, "requires_info"
            reason = "ยังไม่มีงบการเงินในระบบสำหรับประเมินการจับคู่"
            payment = None
            total_repayment = None
            notice = None
        else:
            score = int(match["match_score"])
            status = match["status"]
            reason = match.get("match_reason") or ""
            payment = to_number(match.get("monthly_payment"))
            # The UI field means total repayment over the facility life, so it
            # multiplies by the tenor. The matcher's period_installments is a
            # different quantity - installments inside the reporting period,
            # used for its DSCR stress test - and must not be used here.
            total_repayment = (
                None if payment is None
                else money(Decimal(str(payment)) * Decimal(str(product["termMonths"])))
            )
            notice = match.get("notice")

        if payment is None:
            impact = f"เงินเข้าบัญชีภายใน {product['disbursementDays']} วัน (ยังคำนวณค่างวดไม่ได้)"
        elif payment == 0:
            impact = (
                f"ไม่มีภาระผ่อนชำระ เงินเข้าบัญชีภายใน {product['disbursementDays']} วัน"
            )
        else:
            impact = (
                f"ผ่อนเดือนละ {payment:,.0f} บาท เป็นเวลา {product['termMonths']} เดือน "
                f"เงินเข้าบัญชีภายใน {product['disbursementDays']} วัน"
            )

        option = {
            "id": product["id"],
            "name": product["name"],
            "provider": product["provider"],
            "type": product["type"],
            "typeLabel": FUNDING_TYPE_LABEL.get(product["type"], product["type"]),
            "maxAmount": product["maxAmount"],
            "minAmount": product["minAmount"],
            "interestRateAnnual": product["interestRateAnnual"],
            "termMonths": product["termMonths"],
            "disbursementDays": product["disbursementDays"],
            "monthlyPayment": payment if payment is not None else 0,
            "totalRepayment": total_repayment if total_repayment is not None else 0,
            "impactOnCash": impact,
            "requiredDocs": product["requiredDocs"],
            "eligibilityConditions": product["eligibility"],
            "matchScore": score,
            "matchReason": reason,
            "status": status,
        }
        if match is not None:
            # Carried through so a screen can disclose the stress test and the
            # fact that a ranking is not a credit decision.
            option["postFundingDscr"] = match.get("post_funding_dscr")
            option["policyVersion"] = match.get("policy_version")
            option["notice"] = notice
        options.append(option)

    # Keep the matcher ordering: best first, rejections last.
    order = {product_id: index for index, product_id in enumerate(by_product)}
    options.sort(key=lambda item: order.get(item["id"], len(order)))
    return options, missing


# --- /sales/products and /sales/channels -------------------------------------

def sales_products(rows: list[dict]) -> tuple[list[dict], list[str]]:
    missing: list[str] = []
    out = []
    for row in rows:
        profit = money(Decimal(str(row["revenue"])) - Decimal(str(row["cost"])))
        turnover = row["turnoverDays"]
        if turnover is None:
            velocity = "normal"
            if "product_turnover_days" not in missing:
                missing.append("product_turnover_days")
        else:
            days = Decimal(str(turnover))
            velocity = ("fast" if days <= VELOCITY_FAST_DAYS
                        else "normal" if days <= VELOCITY_NORMAL_DAYS else "slow")
        out.append({
            "id": row["id"],
            "name": row["name"],
            "category": row["category"],
            "unitsSold": row["unitsSold"],
            "revenue": row["revenue"],
            "cost": row["cost"],
            "profit": profit,
            "profitMarginPercent": percent(profit, row["revenue"]),
            "turnoverDays": turnover or 0,
            "velocity": velocity,
        })
    return out, missing


def sales_channels(rows: list[dict]) -> tuple[list[dict], list[str]]:
    out = []
    for row in rows:
        net = money(
            Decimal(str(row["grossSales"]))
            - Decimal(str(row["commissionFee"]))
            - Decimal(str(row["adCost"]))
            - Decimal(str(row["deliveryCost"]))
        )
        out.append({
            "channel": row["channel"],
            "grossSales": row["grossSales"],
            "commissionFee": row["commissionFee"],
            "adCost": row["adCost"],
            "deliveryCost": row["deliveryCost"],
            "netProfit": net,
            "netMarginPercent": percent(net, row["grossSales"]),
        })
    # Channel net profit here is gross less the stated channel costs; it does
    # not subtract cost of goods, which is not split per channel.
    return out, ["channel_cost_of_goods_split"]


# --- /projects ---------------------------------------------------------------

def project_records(rows: list[dict]) -> tuple[list[dict], list[str]]:
    missing: list[str] = []
    out = []
    for row in rows:
        total_units = row["targetCapacity"] * row["durationDays"]
        if row["progressPercent"] is None and "project_progress" not in missing:
            missing.append("project_progress")
        out.append({
            "id": row["id"],
            "code": row["code"] or row["orderRef"],
            "title": row["title"] or row["orderRef"],
            "clientName": row["buyerName"],
            "status": PROJECT_STATUS_MAP.get(row["status"], "under_review"),
            "statusText": PROJECT_STATUS_TEXT.get(row["status"], row["status"]),
            "progressPercent": row["progressPercent"] or 0,
            "version": "v1",
            "totalBudget": money(Decimal(str(total_units)) * Decimal(str(row["unitPrice"]))),
            "totalShops": len(row["allocations"]),
            "startDate": row["startDate"] or "",
            "deliveryDate": row["deadline"] or "",
            "deliverySchedule": row["deliveries"],
        })
    # postMortem needs actual delivered cost and payment dates per project,
    # which are not recorded yet, so it is omitted rather than estimated.
    missing.append("project_post_mortem")
    return out, missing


# --- /funder/projects --------------------------------------------------------

def funder_projects(rows: list[dict], has_access: bool) -> tuple[list[dict], list[str]]:
    """Demo recommendation ladder, disclosed rather than presented as a model.

    all evidence verified and risk not high -> recommend
    some evidence unverified               -> reduced_amount_possible
    no verified evidence                   -> insufficient_data
    """
    missing: list[str] = []
    out = []
    for row in rows:
        gap = money(sum(Decimal(str(a["fundingGap"])) for a in row["allocations"]))
        total_units = row["targetCapacity"] * row["durationDays"]
        target_funding = money(Decimal(str(total_units)) * Decimal(str(row["unitPrice"])))

        evidence = row["evidence"]
        verified = [item for item in evidence if item["verified"]]
        if not evidence:
            decision, note = "insufficient_data", "ยังไม่มีเอกสารประกอบในระบบ"
            if "project_evidence" not in missing:
                missing.append("project_evidence")
        elif len(verified) == len(evidence) and row["riskLevel"] != "high":
            decision, note = "recommend", f"เอกสารครบและตรวจแล้ว {len(verified)} ฉบับ ความเสี่ยงระดับ {row['riskLevel']}"
        elif verified:
            decision = "reduced_amount_possible"
            note = f"ตรวจแล้ว {len(verified)} จาก {len(evidence)} ฉบับ พิจารณาวงเงินบางส่วนได้"
        else:
            decision, note = "insufficient_data", "มีเอกสารแต่ยังไม่ผ่านการตรวจสอบ"

        if row["roiEstimatePct"] is None and "project_roi_estimate" not in missing:
            missing.append("project_roi_estimate")

        out.append({
            "id": row["id"],
            "title": row["title"] or row["orderRef"],
            "enterpriseName": ", ".join(
                a["shopName"] for a in row["allocations"] if a["shopName"]
            ) or row["buyerName"],
            "category": row["standard"] or "",
            "location": row["deliveryLocation"] or "",
            "targetFunding": target_funding,
            "fundingGap": gap,
            "fundPurpose": row["fundPurpose"] or "",
            "evidenceLevel": row["evidenceLevel"] or "unverified",
            "evidenceLevelBadge": "ตรวจสอบแล้ว" if decision == "recommend" else "ยังไม่ครบ",
            "evidenceDocuments": evidence,
            "riskLevel": row["riskLevel"] or "medium",
            "readyResources": [a["shopName"] for a in row["allocations"] if a["shopName"]],
            "roiEstimatePercent": row["roiEstimatePct"] or 0,
            "durationMonths": row["durationMonths"] or 0,
            "allocationRecommended": decision == "recommend",
            "recommendationDecision": decision,
            "recommendationNote": note,
            "hasAccessPermission": has_access,
        })
    return out, missing
