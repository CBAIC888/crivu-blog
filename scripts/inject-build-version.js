#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PLACEHOLDER = '__BUILD_VERSION__';
const VERSION_FILE = path.join(ROOT, 'shared', 'build-version.json');
const TARGETS = [
  'about.html',
  'articles.html',
  'category.html',
  'index.html',
  'issues.html',
  'issues-x.html',
  'post.html',
  path.join('shared', 'site-pages.js'),
  'tag.html',
  path.join('functions', 'articles', '[slug].js'),
];

const pad = (value) => String(value).padStart(2, '0');

const makeTimestamp = () => {
  const now = new Date();
  return [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
  ].join('') + `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
};

const shortSha = () => {
  const envSha = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || process.env.COMMIT_REF;
  if (envSha) return String(envSha).slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'devbuild';
  }
};

const buildVersion = process.env.BUILD_VERSION || `${shortSha()}-${makeTimestamp()}`;

fs.mkdirSync(path.dirname(VERSION_FILE), { recursive: true });
fs.writeFileSync(VERSION_FILE, `${JSON.stringify({ version: buildVersion }, null, 2)}\n`);

for (const relativePath of TARGETS) {
  const absolutePath = path.join(ROOT, relativePath);
  const source = fs.readFileSync(absolutePath, 'utf8');
  if (!source.includes(PLACEHOLDER)) {
    throw new Error(`Missing ${PLACEHOLDER} in ${relativePath}`);
  }
  fs.writeFileSync(absolutePath, source.replaceAll(PLACEHOLDER, buildVersion));
}

process.stdout.write(`${buildVersion}\n`);
