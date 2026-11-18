// Compares a Lighthouse JSON report with budget.json. Usage: node check.mjs report.json budget.json <url>
/* global process, console, URL */
import { readFileSync } from 'node:fs';

const [reportPath, budgetPath, url] = process.argv.slice(2);
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const budget = JSON.parse(readFileSync(budgetPath, 'utf8'));
const origin = new URL(url).origin;
let failures = 0;

function check(label, value, limit, higherIsBetter = false) {
  const ok = higherIsBetter ? value >= limit : value <= limit;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${Number(value.toFixed(3))} (budget ${limit})`);
  if (!ok) failures += 1;
}

for (const [key, { budget: limit }] of Object.entries(budget.scores)) {
  check(`score ${key}`, report.categories[key].score, limit, true);
}
for (const [key, { budget: limit }] of Object.entries(budget.metrics)) {
  check(key, report.audits[key].numericValue, limit);
}
const requests = report.audits['network-requests'].details.items;
const scriptBytes = requests
  .filter((r) => r.resourceType === 'Script')
  .reduce((n, r) => n + r.transferSize, 0);
check('script bytes', scriptBytes, budget.scriptBytes.budget);
const thirdParty = requests.filter(
  (r) => !r.url.startsWith(origin) && !r.url.startsWith('data:'),
).length;
check('third party requests', thirdParty, budget.thirdPartyRequests.budget);

process.exit(failures ? 1 : 0);
