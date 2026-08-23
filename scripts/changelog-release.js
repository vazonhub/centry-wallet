#!/usr/bin/env node
/**
 * Cuts a CHANGELOG.md release section from the running "Unreleased" notes.
 *
 * Called by the `bump:patch|minor|major` scripts AFTER `npm version` has already
 * written the new version into package.json. It renames the "## [Unreleased]"
 * body into "## [<version>] - <today>" and leaves a fresh, empty Unreleased on
 * top so the next cycle has somewhere to accumulate.
 *
 * Idempotent: if a section for the current version already exists (e.g. a
 * standalone `bump:build` rerun), it does nothing. If Unreleased is empty, it
 * warns and leaves the file untouched rather than creating a hollow section.
 */
const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const version = pkg.version;

const clPath = path.join(__dirname, '..', 'CHANGELOG.md');
if (!fs.existsSync(clPath)) {
  console.error('CHANGELOG.md not found — create it before bumping.');
  process.exit(1);
}
const text = fs.readFileSync(clPath, 'utf8');

const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
if (new RegExp(`^## \\[${escaped}\\]`, 'm').test(text)) {
  console.log(`CHANGELOG: [${version}] already present — skipping.`);
  process.exit(0);
}

const heading = text.match(/## \[Unreleased\]/);
if (!heading || heading.index === undefined) {
  console.error('CHANGELOG: no "## [Unreleased]" section found.');
  process.exit(1);
}

const bodyStart = heading.index + heading[0].length;
const rest = text.slice(bodyStart);
const next = rest.match(/\n## \[/); // start of the previous release, if any
const bodyEnd = next && next.index !== undefined ? bodyStart + next.index : text.length;

const body = text.slice(bodyStart, bodyEnd).trim();
if (!body) {
  console.log('CHANGELOG: Unreleased is empty — nothing to release.');
  process.exit(0);
}

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

const before = text.slice(0, bodyStart); // "…## [Unreleased]"
const after = text.slice(bodyEnd); // "\n## [x.y.z]…" or ""

const newText = `${before}\n\n## [${version}] - ${date}\n\n${body}\n${after}`;
fs.writeFileSync(clPath, newText);

console.log(`CHANGELOG: released [${version}] - ${date}.`);
