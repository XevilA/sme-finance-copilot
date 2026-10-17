// Contract/handler regression checks without a browser or new dependencies.
// Run while backend\run.cmd is serving localhost:8000: node scripts/test-import-wiring.mjs
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { setImmediate } from "node:timers/promises";

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite/package.json"))("esbuild");
let sequence = 0;
async function load(entry, options = {}) {
  const bundle = await build({
    entryPoints: [entry], bundle: true, write: false, platform: "node", format: "esm", jsx: "transform",
    define: { "import.meta.env": JSON.stringify({ VITE_USE_MOCK: "false", VITE_API_BASE_URL: "http://127.0.0.1:8000/api/v1", ...options.env }) },
    plugins: options.plugins || [],
  });
  await mkdir("backend/uploads/import-tests", { recursive: true });
  const output = path.resolve(`backend/uploads/import-tests/module-${sequence++}.mjs`);
  await writeFile(output, bundle.outputFiles[0].text);
  return import(`${pathToFileURL(output).href}?run=${Date.now()}`);
}

const payload = JSON.parse(await readFile("backend/examples/analysis_input.json", "utf8"));
// One bundle, so the client and the data context share module state exactly as
// they do in the browser build.
const clientModule = await load("src/api/client.ts");
const client = clientModule.apiClient;
const context = clientModule;
const valid = await client.validateManual(payload);
assert.equal(valid.balanceSheetValid, true);
await client.calculate(valid.data);
const analyzed = await client.analyze(valid.data, "Synthetic client test");
assert.equal(analyzed.data.grading.grade, "B");
assert.equal((await client.getOverview()).data.netProfit, 50000);
assert.equal((await client.getCostBreakdown()).source, "supplied_input");
assert.equal((await client.getAIExplanation("health")).data.pageId, "health");

// --- Shared data context --------------------------------------------------
// One accepted analysis carries the identity every page must agree on.
const accepted = context.getAcceptedAnalysis();
assert.ok(accepted, "analyze must record the accepted analysis");
assert.equal(accepted.context.inputHash, analyzed.inputHash);
assert.equal(accepted.revision, context.draftRevisionId());
assert.equal(accepted.context.smeId, null, "a free-text shop name must not become an SME identity");
assert.equal(context.isAcceptedStale(), false);
assert.equal(analyzed.context.inputRevision, accepted.revision);
const epochAfterAccept = context.contextEpoch();

// An aggregate statement carries no dated cash events and no product or channel
// split. Reading the stored default SME instead would swap the user's imported
// statement for seed data, so these views report what is missing.
for (const [label, read] of [
  ["cashflow", () => client.getCashflowTimeline()],
  ["products", () => client.getProductSales()],
  ["channels", () => client.getChannelSales()],
]) {
  const view = await read();
  assert.equal(view.status, "unavailable", `${label} must not fall back to stored defaults`);
  assert.equal(view.source, "none", `${label} must not claim a database source`);
  assert.deepEqual(view.data, [], `${label} must return an empty series, not invented rows`);
  assert.ok(view.missing.length > 0, `${label} must name the evidence it lacks`);
}

// Editing the draft retires the accepted result: it stays readable with its own
// evidence but is reported stale, and it is not replaced by stored defaults.
context.noteDraftRevision("draft-edited-after-accept");
assert.equal(context.isAcceptedStale(), true);
assert.ok(context.contextEpoch() > epochAfterAccept, "a context change must bump the epoch");
const staleOverview = await client.getOverview();
assert.equal(staleOverview.status, "stale");
assert.equal(staleOverview.source, "supplied_input");
assert.equal(staleOverview.data.netProfit, 50000, "a stale result keeps its own numbers");
assert.ok(staleOverview.missing.includes("input_revision_superseded_by_draft"));
assert.equal((await client.getCostBreakdown()).status, "stale");
// Returning to the analysed revision clears the stale marking.
context.noteDraftRevision(accepted.revision);
assert.equal(context.isAcceptedStale(), false);
assert.equal((await client.getOverview()).status, "insufficient_data");

// --- Funding and forecast against the same supplied statement --------------
const evaluation = await client.evaluateFunding(payload, { input_revision: accepted.revision });
assert.equal(evaluation.source, "supplied_input");
assert.equal(evaluation.persisted, false);
assert.equal(evaluation.inputHash, analyzed.inputHash, "funding must grade the imported statement");
assert.equal(evaluation.data.grade, "B");
assert.equal(evaluation.data.requestedAmount, "70000.00");
assert.equal(evaluation.data.notRequired, false);
assert.ok(evaluation.data.options.length > 0);
// An explicit zero request is a known zero, not an unknown gap.
const notRequired = await client.evaluateFunding(payload, { amount: "0" });
assert.equal(notRequired.data.notRequired, true);
assert.deepEqual(notRequired.data.options, []);
// An unknown gap stays unknown: null plus a name in missing, never 0.
const minimal = { currency: "THB", kind: "simulated", period_start: "2026-09-01", period_end: "2026-09-30",
  assets: "100000", liabilities: "60000", equity: "40000" };
const unknownGap = await client.evaluateFunding(minimal);
assert.equal(unknownGap.data.requestedAmount, null);
assert.ok(unknownGap.missing.includes("requested_amount"));
assert.deepEqual(unknownGap.data.funding, []);

// Without an SME identity there are no dated rows to continue from, so the
// forecast is null plus cash_forecast in missing rather than a flat series.
const forecast = await client.previewForecast(payload, { input_revision: accepted.revision });
assert.equal(forecast.data, null);
assert.ok(forecast.missing.includes("cash_forecast"));
assert.equal(forecast.status, "insufficient_data");

// --- Declared capabilities -------------------------------------------------
const capabilities = (await client.getCapabilities()).data;
for (const name of ["fundingApplication", "agreementSignature", "funderInfoRequest", "reportExport", "resourceReservation"]) {
  assert.equal(capabilities[name].available, false, `${name} must stay unavailable without a business contract`);
  assert.ok(capabilities[name].reason, `${name} must say why it is unavailable`);
}
assert.equal(capabilities.deterministicAnalysis.mode, "rules");
assert.equal(capabilities.orderPreview.available, true);

// --- Failure handling ------------------------------------------------------
// HTTP 422 surfaces the offending field instead of a generic failure.
await assert.rejects(client.evaluateFunding({ ...payload, period_end: "not-a-date" }), (error) => {
  assert.equal(error.status, 422);
  assert.match(error.message, /period_end/);
  return true;
});
// An unscoped saved-plan read is refused by the client before it reaches HTTP.
await assert.rejects(client.listSimulations({}), /project, SME หรือเลขออเดอร์/);
await assert.rejects(client.readSimulation("741434aa-747c-4376-8c75-66f790dcd68c", {}), /project, SME หรือเลขออเดอร์/);
await assert.rejects(client.validateManual({ ...payload, units_sold: "2500" }), /units_sold/);
await assert.rejects(client.validateManual({ ...payload, equity: "1" }), /Balance sheet mismatch/);
const templateResponse = await fetch("http://127.0.0.1:8000/api/v1/analysis/template.xlsx");
assert.equal(templateResponse.status, 200);
const file = new File([await templateResponse.arrayBuffer()], "template.xlsx");
const uploaded = await client.uploadStatement(file);
assert.equal(uploaded.persisted, false);
assert.equal(uploaded.input.revenue, "250000.00");
await assert.rejects(client.uploadStatement(new File(["x"], "legacy.xls")), /\.xlsx/);
await assert.rejects(client.uploadStatement(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.xlsx")), /5 MiB/);
await assert.rejects(client.uploadStatement(new File(["corrupt"], "bad.xlsx")), /Invalid or unreadable/);
const mock = (await load("src/api/client.ts", { env: { VITE_USE_MOCK: "true" } })).apiClient;
const realFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error("Mock mode must not contact the backend"); };
try {
  assert.equal((await mock.getOverview()).source, "demo_dataset");
  await assert.rejects(mock.calculate(payload), /โหมดตัวอย่าง/);
  await assert.rejects(mock.uploadStatement(file), /โหมดตัวอย่าง/);
} finally { globalThis.fetch = realFetch; }

// Render the component into an element tree with minimal hook/dependency stubs.
// Exercise the actual onDrop and submit handlers, not a copy of their logic.
const hookPlugin = {
  name: "import-handler-dependencies",
  setup(build) {
    build.onResolve({ filter: /^(react(?:\/jsx-runtime)?|lucide-react|@\/.*)$/ }, (args) => {
      // The data context is the module under test for draft invalidation, so it
      // is bundled for real instead of being replaced by a stub.
      if (args.path === "@/api/activeAnalysis") return { path: path.resolve("src/api/activeAnalysis.ts") };
      return { path: args.path, namespace: "handler-test" };
    });
    build.onLoad({ filter: /.*/, namespace: "handler-test" }, ({ path }) => {
      if (path === "react/jsx-runtime") return { contents: "export const jsx=(type,props)=>({type,props:props||{},children:[props?.children].flat()}); export const jsxs=jsx;" };
      if (path === "react") return { contents: `
        export const useRef = value => ({current:value});
        // This harness renders the component as one synchronous call, so
        // effects are not run here; handlers are what these cases exercise.
        export const useEffect = () => {};
        export const useState = initial => {
          let value = typeof initial === 'function' ? initial() : initial;
          if (value === 'manual') value = globalThis.__importTest.mode;
          return [value, next => { value = typeof next === 'function' ? next(value) : next; }];
        };
        export default {createElement:(type,props,...children)=>({type,props:props||{},children})};` };
      if (path === "@/api/client") return { contents: "export const apiClient = globalThis.__importTest.api;" };
      if (path === "@/store/useAppStore") return { contents: "export const useAppStore = () => globalThis.__importTest.store;" };
      return { contents: "export const DataKindBadge=()=>null, StateRenderer=()=>null, UploadCloud=()=>null, FileSpreadsheet=()=>null, Download=()=>null, CheckCircle2=()=>null, AlertTriangle=()=>null, ArrowRight=()=>null, Plus=()=>null, Trash2=()=>null, Save=()=>null, Check=()=>null;" };
    });
  },
};

function elements(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(elements);
  return [node, ...node.children.flatMap(elements)];
}

async function render(mode, draft, overrides = {}) {
  const calls = [], toasts = [], pages = [];
  globalThis.sessionStorage = { getItem: () => JSON.stringify(draft), setItem() {} };
  globalThis.__importTest = {
    mode, store: { addToast: toast => toasts.push(toast), setCurrentPage: page => pages.push(page) },
    api: {
      uploadStatement: async value => { calls.push(["upload", value]); return { input: payload }; },
      validateManual: async value => { calls.push(["validate", value]); return { data: value }; },
      calculate: async (value, context) => { calls.push(["calculate", value, context]); },
      // Shaped like the real contract: the page reports the returned grade and
      // the number of missing evidence names, so it cannot be a bare success.
      analyze: async (value, shopName, context) => {
        calls.push(["analyze", value, context]);
        return { data: { grading: { grade: "B", score: "75.00" } }, missing: ["cash_forecast"], views: {} };
      }, ...overrides,
    },
  };
  const { ImportPage } = await load("src/features/import/ImportPage.tsx", { plugins: [hookPlugin] });
  return { nodes: elements(ImportPage()), calls, toasts, pages };
}

async function settle() { for (let i = 0; i < 5; i++) await setImmediate(); }
let test = await render("upload", {});
const zone = test.nodes.find(node => node.props.onDrop);
let prevented = false;
zone.props.onDrop({ preventDefault() { prevented = true; }, dataTransfer: { files: [file] } });
zone.props.onDrop({ preventDefault() {}, dataTransfer: { files: [file] } });
await settle();
assert.equal(prevented, true);
assert.deepEqual(test.calls.map(([name]) => name), ["upload", "validate", "analyze"]);
assert.deepEqual(test.pages, ["overview"]);

test = await render("upload", {}, { uploadStatement: async () => { throw new Error("bad workbook"); } });
test.nodes.find(node => node.props.onDrop).props.onDrop({ preventDefault() {}, dataTransfer: { files: [file] } });
await settle();
assert.equal(test.toasts[0].type, "error");
assert.equal(test.toasts[0].message, "bad workbook");
assert.deepEqual(test.pages, []);

const draft = Object.fromEntries(Object.entries(payload).filter(([, value]) => typeof value !== "object").map(([key, value]) => [key, String(value)]));
delete draft.interest_expense;
test = await render("manual", draft);
test.nodes.find(node => node.type === "button" && node.props.onClick && node.children.some(child => child?.type === "span" && child.children.includes("ยืนยันข้อมูลและเริ่มวิเคราะห์"))).props.onClick();
await settle();
const sent = test.calls.find(([name]) => name === "validate")[1];
assert.equal(typeof sent.units_sold, "number");
assert.equal(sent.units_sold, 2500);
assert.equal(sent.revenue, "250000.00");
assert.equal("interest_expense" in sent, false);
assert.deepEqual(test.calls.map(([name]) => name), ["validate", "calculate", "analyze"]);
assert.deepEqual(test.pages, ["overview"]);
delete globalThis.__importTest;
delete globalThis.sessionStorage;
console.log("PASS: real client HTTP, upload limits, strict units, mock isolation, drag/drop, duplicate submit, error path, manual serialization, shared data context, draft invalidation, no seed fallback, funding/forecast on the imported statement, declared capabilities and HTTP422/scope failures");
