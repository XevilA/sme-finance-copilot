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
const client = (await load("src/api/client.ts")).apiClient;
const valid = await client.validateManual(payload);
assert.equal(valid.balanceSheetValid, true);
await client.calculate(valid.data);
const analyzed = await client.analyze(valid.data, "Synthetic client test");
assert.equal(analyzed.data.grading.grade, "B");
assert.equal((await client.getOverview()).data.netProfit, 50000);
assert.equal((await client.getCostBreakdown()).source, "supplied_input");
assert.equal((await client.getAIExplanation("health")).data.pageId, "health");
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
    build.onResolve({ filter: /^(react(?:\/jsx-runtime)?|lucide-react|@\/.*)$/ }, (args) => ({ path: args.path, namespace: "handler-test" }));
    build.onLoad({ filter: /.*/, namespace: "handler-test" }, ({ path }) => {
      if (path === "react/jsx-runtime") return { contents: "export const jsx=(type,props)=>({type,props:props||{},children:[props?.children].flat()}); export const jsxs=jsx;" };
      if (path === "react") return { contents: `
        export const useRef = value => ({current:value});
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
      calculate: async value => { calls.push(["calculate", value]); },
      analyze: async value => { calls.push(["analyze", value]); }, ...overrides,
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
console.log("PASS: real client HTTP, upload limits, strict units, mock isolation, drag/drop, duplicate submit, error path and manual serialization");
