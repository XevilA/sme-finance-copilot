// Run against backend\run.cmd. Tests actual client code and preserves design guards.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const { build } = createRequire(require.resolve('vite/package.json'))('esbuild');

// Design guard over every page touched by integration wiring. Compares the
// className/style JSX attributes against the 269e3d2 baseline, so changing a
// Tailwind class, adding an element or moving the hierarchy fails the run.
for (const file of ['overview/OverviewPage', 'simulator/SimulatorPage', 'swarm/SwarmPage', 'import/ImportPage',
  'cost/CostPage', 'funding/FundingPage', 'health/HealthPage', 'cashflow/CashflowPage', 'unlock/UnlockPage',
  'shop-finance/ShopFinancePage', 'funder/FunderPage', 'projects/ProjectsPage', 'ai-panel/AIPanel',
  'simulator/ChaosPlayback', 'sales/SalesPage']) {
  const name = `src/features/${file}.tsx`;
  const before = execFileSync('git', ['show', `269e3d2:${name}`], { encoding:'utf8' });
  const after = await readFile(name, 'utf8');
  const styles = (text) => {
    const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const values = [];
    const visit = (node) => {
      if (ts.isJsxAttribute(node) && ['className', 'style'].includes(node.name.text)) {
        values.push(node.getText(source).replace(/\s/g, '').replace('Number(simMinCash)', 'simMinCash'));
      }
      ts.forEachChild(node, visit);
    };
    visit(source); return values;
  };
  assert.deepEqual(styles(after), styles(before), `${name}: styling changed`);
}
await mkdir('backend/uploads/page-tests', { recursive: true });
async function load(demo) {
  const bundle = await build({ entryPoints:['src/api/client.ts'], bundle:true, write:false, platform:'node', format:'esm',
    define:{'import.meta.env':JSON.stringify({VITE_USE_MOCK: demo ? 'true':'false',VITE_API_BASE_URL:'http://127.0.0.1:8000/api/v1'})} });
  const output = path.resolve(`backend/uploads/page-tests/client-${demo}.mjs`);
  await writeFile(output, bundle.outputFiles[0].text);
  return (await import(`${pathToFileURL(output).href}?v=${Date.now()}`)).apiClient;
}
const client = await load(false);
const context = await client.getOrderContext();
assert.equal(context.source, 'database');
assert.equal(context.data.order_ref, 'PO-STP-2026-091');
const before = JSON.stringify(context.data);
const assembled = await client.assembleSwarm(context.data);
assert.equal(assembled.source, 'supplied_input');
assert.equal(assembled.persisted, false);
assert.equal(assembled.status, 'insufficient_data');
assert.ok(assembled.missing.includes('required_business_types'));
assert.equal(assembled.data.totalCapacityAssigned, 450);
assert.equal(assembled.data.deficitBoxesPerDay, 550);
assert.equal(assembled.audit.eligibility['11111111-1111-4111-8111-111111111111'].eligible, false);
const scenario = {unit_price:'120',cost_per_unit:'50',deposit_ratio:'0.5',payment_terms_days:10};
const simulation = await client.simulateOrder(context.data, scenario);
assert.equal(simulation.data.scope, 'order_only');
assert.equal(simulation.data.planB.totalRevenue, 1620000);
assert.equal(simulation.data.planB.totalCost, 675000);
assert.equal(simulation.data.planB.totalProfit, 945000);
assert.equal(simulation.data.planB.totalFundingGap, 0);
assert.equal(simulation.data.planB.minimumShopCash, '1200000.00');
assert.ok(simulation.missing.includes('buyer_coordinates'));
assert.equal(simulation.status, 'insufficient_data');
assert.equal(JSON.stringify(context.data), before);
await assert.rejects(client.simulateOrder(context.data, {...scenario,payment_terms_days:1.5}), /payment_terms_days/);
const demo = await load(true);
assert.equal((await demo.getSwarmProposal()).source, 'demo_dataset');
await assert.rejects(demo.assembleSwarm(context.data), /โหมดตัวอย่าง/);
await assert.rejects(demo.simulateOrder(context.data, scenario, true), /โหมดตัวอย่าง/);
console.log('PASS: fifteen page style guards, real order context, SWARM resource exclusion, four simulation controls, source/missing, validation, demo write rejection');
