import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const posts = read('posts/posts.json').items || [];
const expected = {
  articles: posts.filter((item) => item?.published !== false).length + 1,
  articleTranslations: 1,
  collections: (read('posts/issues.json').issues || []).filter((item) => item?.published !== false).length,
  projects: (read('posts/records.json').records || []).filter((item) => item?.published === true).length,
  pages: 1,
};
const api = process.argv[2];
if (!api) {
  console.log(JSON.stringify({ expected, instruction: 'Pass the deployed or local site origin to compare API counts.' }, null, 2));
  process.exit(0);
}
const origin = api.replace(/\/$/, '');
const [articles, translation, collections, projects, about] = await Promise.all([
  fetch(`${origin}/api/v1/articles?limit=200`).then((r) => r.json()),
  fetch(`${origin}/api/v1/articles/world-word-exploration-en`).then((r) => r.json()),
  fetch(`${origin}/api/v1/issues?limit=200`).then((r) => r.json()),
  fetch(`${origin}/api/v1/projects?limit=200`).then((r) => r.json()),
  fetch(`${origin}/api/v1/pages/about`).then((r) => r.json()),
]);
const actual = { articles: articles.count, articleTranslations: translation.item ? 1 : 0, collections: collections.count, projects: projects.count, pages: about.item ? 1 : 0 };
const mismatches = Object.keys(expected).filter((key) => expected[key] !== actual[key]);
console.log(JSON.stringify({ expected, actual, mismatches, ok: mismatches.length === 0 }, null, 2));
if (mismatches.length) process.exitCode = 1;
