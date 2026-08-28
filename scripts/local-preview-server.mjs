import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { createSession } from '../functions/api/v1/_shared.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const db = new DatabaseSync(':memory:');

for (const file of ['migrations/0001_comments.sql', 'migrations/0002_comments_source.sql', 'migrations/0003_content_platform.sql', 'migrations/0004_remove_article_comments.sql']) {
  db.exec(fs.readFileSync(path.join(root, file), 'utf8'));
}

const seedSql = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [path.join(root, 'scripts/build-content-seed.mjs')]);
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.on('error', reject);
  child.on('close', (code) => code ? reject(new Error('Seed generation failed')) : resolve(output));
});
db.exec(seedSql);

class Statement {
  constructor(sql) { this.sql = sql; this.values = []; }
  bind(...values) { this.values = values; return this; }
  first() { return db.prepare(this.sql).get(...this.values) || null; }
  all() { return { results: db.prepare(this.sql).all(...this.values) }; }
  run() {
    const result = db.prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: result.changes } };
  }
}

const D1 = {
  prepare: (sql) => new Statement(sql),
  batch: async (statements) => Promise.all(statements.map((statement) => statement.run())),
};
const mediaObjects = new Map();
const MEDIA_BUCKET = {
  put: async (key, body, options={}) => {
    const bytes=Buffer.from(await body.arrayBuffer());
    const httpEtag=`"local-${bytes.length}-${Date.now()}"`;
    mediaObjects.set(key,{bytes,httpEtag,contentType:options.httpMetadata?.contentType||'application/octet-stream'});
    return {httpEtag};
  },
  get: async (key) => {
    const object=mediaObjects.get(key);if(!object)return null;
    return {body:object.bytes,httpEtag:object.httpEtag,writeHttpMetadata:(headers)=>headers.set('content-type',object.contentType)};
  },
  head: async (key) => {
    const object=mediaObjects.get(key);if(!object)return null;
    return {httpEtag:object.httpEtag,size:object.bytes.length,httpMetadata:{contentType:object.contentType}};
  },
  delete: async (key) => mediaObjects.delete(key),
};

const modules = {
  '/articles': await import('../functions/articles.js'),
  '/issues': await import('../functions/issues.js'),
  '/records': await import('../functions/records.js'),
  '/about': await import('../functions/about.js'),
  '/rss.xml': await import('../functions/rss.xml.js'),
  '/sitemap.xml': await import('../functions/sitemap.xml.js'),
  apiArticles: await import('../functions/api/v1/articles/index.js'),
  apiArticle: await import('../functions/api/v1/articles/[slug].js'),
  apiIssues: await import('../functions/api/v1/issues/index.js'),
  apiIssue: await import('../functions/api/v1/issues/[id].js'),
  apiProjects: await import('../functions/api/v1/projects/index.js'),
  apiProject: await import('../functions/api/v1/projects/[slug].js'),
  apiAbout: await import('../functions/api/v1/pages/[slug].js'),
  apiSettings: await import('../functions/api/v1/settings/public.js'),
  guestbook: await import('../functions/api/v1/guestbook.js'),
  article: await import('../functions/articles/[slug].js'),
  issue: await import('../functions/issues/[id].js'),
  project: await import('../functions/records/[id].js'),
  admin: await import('../functions/api/v1/admin/[[path]].js'),
  media: await import('../functions/media/[[key]].js'),
};

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.xml': 'application/xml; charset=utf-8',
};

const redirects = new Map([
  ['/index.html', '/articles'],
  ['/articles.html', '/articles'],
  ['/issues.html', '/issues'],
  ['/records.html', '/issues'],
  ['/about.html', '/about'],
  ['/preview', '/articles'],
  ['/preview/index.html', '/articles'],
  ['/preview/articles.html', '/articles'],
  ['/preview/issues.html', '/issues'],
  ['/preview/records.html', '/issues'],
  ['/preview/about.html', '/about'],
  ['/preview/research.html', '/articles/world-word-exploration'],
  ['/preview/research-en.html', '/articles/world-word-exploration-en'],
  ['/preview/research-gallery.html', '/records/world-word-history/gallery'],
  ['/records/world-word-exploration', '/articles/world-word-exploration'],
  ['/records/world-word-history', '/articles/world-word-exploration'],
  ['/records/world-word-history/', '/articles/world-word-exploration'],
]);

const bodyFor = (request) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  request.on('data', (chunk) => {
    size += chunk.length;
    if (size > 26 * 1024 * 1024) {
      reject(Object.assign(new Error('Request body too large'), { status: 413 }));
      request.destroy();
      return;
    }
    chunks.push(chunk);
  });
  request.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
  request.on('error', reject);
});

const redirectFor = (pathname) => {
  if (redirects.has(pathname)) return redirects.get(pathname);
  const article = pathname.match(/^\/preview\/articles\/([^/]+)\.html$/);
  if (article) return `/articles/${article[1]}`;
  const issue = pathname.match(/^\/preview\/issues\/([^/]+)\.html$/);
  if (issue) return `/issues/${issue[1]}`;
  const record = pathname.match(/^\/preview\/records\/([^/]+)\.html$/);
  if (record) return `/records/${record[1]}`;
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return '';
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:8788');
    const rawPathname = decodeURIComponent(url.pathname);
    const pathname = rawPathname.replace(/\/$/, '') || '/';
    const legacySlug=['/post','/post.html'].includes(pathname)?String(url.searchParams.get('slug')||'').trim().toLowerCase():'';
    const legacyPostRedirect=['/post','/post.html'].includes(pathname)?(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(legacySlug)?`/articles/${encodeURIComponent(legacySlug)}`:'/articles'):'';
    const redirect = pathname === '/' ? '/articles' : legacyPostRedirect||redirectFor(rawPathname);
    if (redirect) {
      res.writeHead(pathname === '/' ? 308 : 301, { Location: legacyPostRedirect?redirect:`${redirect}${url.search}` });
      res.end();
      return;
    }

    const env = {
      CRIVU_DB: D1,
      MEDIA_BUCKET,
      SESSION_SECRET: 'local-preview-only',
      GUESTBOOK_HASH_SALT: 'local-preview-only',
      GUESTBOOK_ALLOW_UNVERIFIED: 'true',
      BUILD_VERSION: 'local-preview',
    };
    let mod;
    const params = {};

    if (pathname === '/__dev/login') {
      const session = await createSession({ login: 'local', name: '本機預覽', avatarUrl: '' }, env);
      res.writeHead(302, { Location: '/admin/', 'Set-Cookie': `crivu_admin=${session}; HttpOnly; Path=/; SameSite=Lax` });
      res.end();
      return;
    }

    if (modules[pathname]) mod = modules[pathname];
    else if (pathname === '/api/v1/articles') mod = modules.apiArticles;
    else if (pathname.startsWith('/api/v1/articles/')) { mod = modules.apiArticle; params.slug = pathname.slice(17); }
    else if (pathname === '/api/v1/issues') mod = modules.apiIssues;
    else if (pathname.startsWith('/api/v1/issues/')) { mod = modules.apiIssue; params.id = pathname.slice(15); }
    else if (pathname === '/api/v1/projects') mod = modules.apiProjects;
    else if (pathname.startsWith('/api/v1/projects/')) { mod = modules.apiProject; params.slug = pathname.slice(17); }
    else if (pathname === '/api/v1/pages/about') { mod = modules.apiAbout; params.slug = 'about'; }
    else if (pathname === '/api/v1/settings/public') mod = modules.apiSettings;
    else if (pathname === '/api/v1/guestbook') mod = modules.guestbook;
    else if (pathname.startsWith('/api/v1/admin/')) { mod = modules.admin; params.path = pathname.slice(14).split('/').filter(Boolean); }
    else if (pathname.startsWith('/media/')) { mod = modules.media; params.key = pathname.slice('/media/'.length).split('/'); }
    else if (pathname.startsWith('/articles/')) { mod = modules.article; params.slug = pathname.slice(10); }
    else if (pathname.startsWith('/issues/')) { mod = modules.issue; params.id = pathname.slice(8); }
    else if (pathname.startsWith('/records/') && !pathname.includes('/world-word-history/gallery') && !pathname.includes('/world-word-history/museum')) { mod = modules.project; params.id = pathname.slice(9); }

    if (mod) {
      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await bodyFor(req);
      const request = new Request(url, { method: req.method, headers: req.headers, body, duplex: body ? 'half' : undefined });
      const handler = mod[`onRequest${req.method[0]}${req.method.slice(1).toLowerCase()}`] || mod.onRequest;
      if (!handler) {
        res.writeHead(405, { Allow: Object.keys(mod).filter((key) => key.startsWith('onRequest')).join(', ') });
        res.end('Method not allowed');
        return;
      }
      const response = await handler({ env, request, params, waitUntil: () => {} });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }

    const staticRoot = rawPathname.startsWith('/preview/') ? root : dist;
    let file = path.resolve(staticRoot, `.${rawPathname}`);
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (path.relative(staticRoot, file).startsWith('..') || !fs.existsSync(file)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (error) {
    console.error(error);
    res.writeHead(error.status || 500);
    res.end(error.status === 413 ? 'Request body too large' : 'Server error');
  }
});

server.listen(8788, '127.0.0.1', () => console.log('CRIVU local preview: http://127.0.0.1:8788/articles'));
