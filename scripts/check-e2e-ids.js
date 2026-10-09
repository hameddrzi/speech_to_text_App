#!/usr/bin/env node
/**
 * Checks that every element id the Maestro flows (.maestro/**\/*.yaml) look for is defined in
 * src/constants/test-ids.ts, and that every flow file is valid YAML.
 *
 *   node scripts/check-e2e-ids.js
 *
 * Understands the dynamic ids built by the helpers in test-ids.ts:
 *   recording-row-<id>, transcript-segment-<n>, <prefix>-sheet, <prefix>-sheet-done, <prefix>-option-<value>
 * and regex selectors such as "recording-row-.*". System ids containing ":" (android:id/button1,
 * com.android.permissioncontroller:id/...) belong to the OS and are skipped.
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '..');
const flowsDir = path.join(root, '.maestro');
const idsFile = path.join(root, 'src/constants/test-ids.ts');

// ── Known ids ──
const idsSource = fs.readFileSync(idsFile, 'utf8');
const literals = new Set([...idsSource.matchAll(/:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]));

// Prefixes ("recording-row-") take any suffix; option-sheet prefixes expand to sheet ids.
const prefixes = [...literals].filter((id) => id.endsWith('-'));
const sheetBlock = /optionSheet:\s*\{([^}]*)\}/.exec(idsSource);
const sheetPrefixes = sheetBlock ? [...sheetBlock[1].matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]) : [];

// Valid option values per sheet, read from the option lists the sheets render.
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const quotedValues = (src) => new Set([...src.matchAll(/value:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]));
const optionValues = {
  model: quotedValues(read('src/stt/models.ts')),
  'auto-delete': quotedValues(/AUTO_DELETE_OPTIONS[^=]*=\s*\[([\s\S]*?)\];/.exec(read('src/store/settings.tsx'))?.[1] ?? ''),
};

const exact = new Set(literals);
for (const p of sheetPrefixes) {
  exact.add(`${p}-sheet`);
  exact.add(`${p}-sheet-done`);
  for (const v of optionValues[p] ?? []) exact.add(`${p}-option-${v}`);
}
for (const p of sheetPrefixes) exact.delete(p); // bare prefixes are not ids

const REGEX_CHARS = /[.*+?^${}()|[\]\\]/;

function isKnown(id) {
  if (exact.has(id)) return true;
  if (REGEX_CHARS.test(id)) {
    // Regex selector: its literal head must be a known prefix or the start of a known id.
    const head = id.slice(0, id.search(REGEX_CHARS));
    return head.length > 0 && (prefixes.includes(head) || [...exact].some((e) => e.startsWith(head)));
  }
  return prefixes.some((p) => id.startsWith(p) && id.length > p.length);
}

// ── Flows ──
function yamlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return yamlFiles(full);
    return /\.ya?ml$/.test(e.name) ? [full] : [];
  });
}

function collectIds(node, out) {
  if (Array.isArray(node)) node.forEach((n) => collectIds(n, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'id' && typeof v === 'string') out.push(v);
      else collectIds(v, out);
    }
  }
  return out;
}

let errors = 0;
let checked = 0;
const files = yamlFiles(flowsDir);
for (const file of files) {
  const rel = path.relative(root, file);
  let docs;
  try {
    docs = yaml.loadAll(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`✗ ${rel}: invalid YAML: ${e.message}`);
    errors++;
    continue;
  }
  for (const id of collectIds(docs, [])) {
    if (id.includes(':')) continue; // OS-owned ids
    checked++;
    if (!isKnown(id)) {
      console.error(`✗ ${rel}: id "${id}" is not defined in src/constants/test-ids.ts`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\n${errors} problem(s) in ${files.length} flow file(s).`);
  process.exit(1);
}
console.log(`✓ ${files.length} flow files parse; all ${checked} id selectors exist in src/constants/test-ids.ts.`);
