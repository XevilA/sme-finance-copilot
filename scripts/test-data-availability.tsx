import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StateRenderer } from "../src/components/ui/StateRenderer";
import { databaseUnavailable, missingDataLabel } from "../src/api/dataAvailability";

assert.equal(databaseUnavailable(["database_disabled"]), true);
assert.equal(databaseUnavailable([], "Order context requires DATABASE_URL"), true);
assert.equal(databaseUnavailable([], "Funding catalogue requires DATABASE_URL"), true);
assert.equal(databaseUnavailable([], "HTTP 503"), false, "Other outages must not be mislabelled as an absent DB");
assert.equal(databaseUnavailable(["net_income"]), false);
assert.equal(missingDataLabel("assets"), "assets");
for (const mode of ["error", "insufficient_data", "unavailable"] as const) {
  const html = renderToStaticMarkup(<StateRenderer currentMode={mode} missingItems={["database_disabled"]} onRetry={() => {}}>{null}</StateRenderer>);
  assert.ok(html.includes("This page requires an online database connection"));
  assert.ok(html.includes("Check connection again"));
  assert.ok(!html.includes("Add missing data") && !html.includes("database_disabled"));
}
const configError = renderToStaticMarkup(<StateRenderer currentMode="error" errorMessage="Order context requires DATABASE_URL">{null}</StateRenderer>);
assert.ok(configError.includes("This page requires an online database connection"));
const businessGap = renderToStaticMarkup(<StateRenderer currentMode="unavailable" missingItems={["product_sales_for_imported_statement"]}>{null}</StateRenderer>);
assert.ok(businessGap.includes("Product-level sales for this period"));
assert.ok(!businessGap.includes("This page requires an online database connection") && !businessGap.includes("Go to data import"));
const genericError = renderToStaticMarkup(<StateRenderer currentMode="error" errorMessage="Connection failed">{null}</StateRenderer>);
assert.ok(genericError.includes("Processing failed"));
console.log("Availability states: absent database, business evidence, retry and generic errors passed.");
