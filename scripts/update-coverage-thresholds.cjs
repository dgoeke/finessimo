#!/usr/bin/env node
/*
  Update config/coverage-thresholds.json using coverage/coverage-summary.json.
  Run after `npm run test:coverage` to lock current per-file coverage.
*/
const fs = require('node:fs');
const path = require('node:path');

const summaryPath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
const outPath = path.join(process.cwd(), 'config', 'coverage-thresholds.json');

if (!fs.existsSync(summaryPath)) {
  console.error('coverage/coverage-summary.json not found. Run `npm run test:coverage` first.');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const out = {};
for (const [abs, data] of Object.entries(raw)) {
  if (abs === 'total') continue;
  if (typeof abs !== 'string' || !abs.includes(`${path.sep}src${path.sep}`)) continue;
  const rel = abs.slice(abs.indexOf(`${path.sep}src${path.sep}`) + 1).replace(/\\/g, '/');
  out[rel] = {
    statements: Math.floor(data.statements.pct),
    branches: Math.floor(data.branches.pct),
    functions: Math.floor(data.functions.pct),
    lines: Math.floor(data.lines.pct),
  };
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log('Updated', outPath, 'with', Object.keys(out).length, 'files.');

