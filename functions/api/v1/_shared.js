const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

const encoder = new TextEncoder();

export const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });

export const failure = (status, code, message, details) =>
  json({ error: { code, message, ...(details ? { details } : {}) } }, status);

export const getDb = (env) => env?.CRIVU_DB || env?.CONTENT_DB || null;

export const requireDb = (env) => {
  const db = getDb(env);
  if (!db) throw Object.assign(new Error('CRIVU database binding is missing'), { status: 503, code: 'database_unavailable' });
  return db;
};

let articleLikesReady = false;
export const ensureArticleLikesTable = async (db) => {
  if (articleLikesReady) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS article_likes (article_id TEXT PRIMARY KEY, like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_article_likes_count ON article_likes (like_count DESC)`).run();
  articleLikesReady = true;
};

export const cleanText = (value, max = 10_000) =>
  String(value ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);

export const cleanSlug = (value) => cleanText(value, 120).toLowerCase();
export const validSlug = (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug(value));
export const validId = (value) => /^[a-z0-9][a-z0-9_-]{0,119}$/i.test(cleanText(value, 120));

export const parseJson = async (request, maxBytes = 2_000_000) => {
  if (!String(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
    throw Object.assign(new Error('Content-Type must be application/json'), { status: 415, code: 'unsupported_media_type' });
  }
  const length = Number(request.headers.get('content-length') || 0);
  if (length > maxBytes) throw Object.assign(new Error('Request body is too large'), { status: 413, code: 'payload_too_large' });
  const raw = await request.text();
  if (raw.length > maxBytes) throw Object.assign(new Error('Request body is too large'), { status: 413, code: 'payload_too_large' });
  try {
    return JSON.parse(raw || '{}');
  } catch {
    throw Object.assign(new Error('Request body is not valid JSON'), { status: 400, code: 'invalid_json' });
  }
};

export const safeJson = (value, fallback = {}) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export const makeId = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;

const base64Url = (bytes) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
};

const decodeBase64Url = (value) => {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const sign = async (value, secret) => {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
};

const verify = async (value, signature, secret) => {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  try { return crypto.subtle.verify('HMAC', key, decodeBase64Url(signature), encoder.encode(value)); } catch { return false; }
};

const ACCESS_TEAM_DOMAIN = 'https://broken-waterfall-0726.cloudflareaccess.com';
const ACCESS_AUD = '82d8d9f82ddf322a8b94627216725cea07b1369adc946cc50269e8cc8b15614f';
let accessKeys = { expiresAt: 0, items: [] };

const accessConfig = (env) => ({
  domain: cleanText(env?.CF_ACCESS_TEAM_DOMAIN || ACCESS_TEAM_DOMAIN, 300).replace(/\/$/, ''),
  aud: cleanText(env?.CF_ACCESS_AUD || ACCESS_AUD, 200),
});

const jwtJson = (value) => JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));

const loadAccessKeys = async (domain, force = false) => {
  if (!force && accessKeys.items.length && accessKeys.expiresAt > Date.now()) return accessKeys.items;
  const response = await fetch(`${domain}/cdn-cgi/access/certs`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Cloudflare Access keys are unavailable');
  const data = await response.json();
  accessKeys = { expiresAt: Date.now() + 5 * 60 * 1000, items: Array.isArray(data.keys) ? data.keys : [] };
  return accessKeys.items;
};

const accessSession = async (request, env) => {
  const token = cleanText(request.headers.get('cf-access-jwt-assertion'), 20_000);
  if (!token) return null;
  const { domain, aud } = accessConfig(env);
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = jwtJson(parts[0]), payload = jwtJson(parts[1]), now = Math.floor(Date.now() / 1000);
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (header.alg !== 'RS256' || !header.kid || payload.iss !== domain || !audiences.includes(aud)) return null;
    if (!payload.email || Number(payload.exp) <= now || (payload.nbf && Number(payload.nbf) > now)) return null;
    let keys = await loadAccessKeys(domain), jwk = keys.find((item) => item.kid === header.kid);
    if (!jwk) { keys = await loadAccessKeys(domain, true); jwk = keys.find((item) => item.kid === header.kid); }
    if (!jwk) return null;
    const algorithm = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
    const key = await crypto.subtle.importKey('jwk', jwk, algorithm, false, ['verify']);
    const valid = await crypto.subtle.verify(algorithm, key, decodeBase64Url(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`));
    if (!valid) return null;
    return { login: payload.email, name: '管理員', avatarUrl: '', exp: Number(payload.exp) * 1000 };
  } catch {
    return null;
  }
};

export const createSession = async ({ login, name, avatarUrl }, env) => {
  const secret = cleanText(env?.SESSION_SECRET, 500);
  if (!secret) throw new Error('SESSION_SECRET is missing');
  const payload = base64Url(encoder.encode(JSON.stringify({ login, name, avatarUrl, exp: Date.now() + 12 * 60 * 60 * 1000 })));
  return `${payload}.${await sign(payload, secret)}`;
};

const cookie = (request, name) => {
  const pair = String(request.headers.get('cookie') || '').split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return pair ? pair.slice(name.length + 1) : '';
};

export const readSession = async (request, env) => {
  const cloudflareSession = await accessSession(request, env);
  if (request.headers.get('cf-access-jwt-assertion')) return cloudflareSession;
  const token = cookie(request, 'crivu_admin');
  const secret = cleanText(env?.SESSION_SECRET, 500);
  if (!token || !secret) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !(await verify(payload, signature, secret))) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
    if (!data?.login || Number(data.exp) <= Date.now()) return null;
    return data;
  } catch {
    return null;
  }
};

export const requireAdmin = async (context) => {
  const session = await readSession(context.request, context.env);
  if (!session) throw Object.assign(new Error('Please sign in'), { status: 401, code: 'unauthorized' });
  return session;
};

export const handle = (handler) => async (context) => {
  try {
    return await handler(context);
  } catch (error) {
    console.error(JSON.stringify({ event: 'api_error', code: error?.code || 'internal_error', message: String(error?.message || error) }));
    return failure(error?.status || 500, error?.code || 'internal_error', error?.status ? error.message : 'Unexpected server error');
  }
};

export const parseLimit = (url, fallback = 50, maximum = 200) =>
  Math.min(maximum, Math.max(1, Number.parseInt(url.searchParams.get('limit') || fallback, 10) || fallback));

export const publicArticle = (row) => ({
  id: row.id,
  type: row.type,
  slug: row.slug,
  title: row.title,
  subtitle: row.subtitle || '',
  summary: row.summary || '',
  bodyMarkdown: row.body_markdown || '',
  language: row.language || 'zh-Hant',
  coverUrl: row.cover_public_url || row.cover_url || '',
  publishedAt: row.published_at || row.scheduled_at || '',
  updatedAt: row.updated_at || '',
  seoTitle: row.seo_title || '',
  seoDescription: row.seo_description || '',
  canonicalUrl: row.canonical_url || '',
  license: row.license || '',
  metadata: safeJson(row.metadata_json),
  version: row.version,
});

export const loadArticleRelations = async (db, article) => {
  const [authors, tags, translations, sections, notes, collections, project] = await Promise.all([
    db.prepare(`SELECT a.id, a.name, a.orcid, a.institution, aa.is_corresponding AS isCorresponding FROM article_authors aa JOIN authors a ON a.id = aa.author_id WHERE aa.article_id = ? ORDER BY aa.sort_order`).bind(article.id).all(),
    db.prepare(`SELECT t.id, t.slug, t.name FROM article_tags at JOIN tags t ON t.id = at.tag_id WHERE at.article_id = ? ORDER BY t.name`).bind(article.id).all(),
    db.prepare(`SELECT at.language, at.hreflang, a.slug, a.title FROM article_translations at JOIN articles a ON a.id = at.translation_article_id WHERE at.article_id = ?`).bind(article.id).all(),
    db.prepare(`SELECT id, section_key AS sectionKey, title, body_markdown AS bodyMarkdown, sort_order AS sortOrder FROM research_sections WHERE article_id = ? ORDER BY sort_order`).bind(article.id).all(),
    db.prepare(`SELECT id, note_number AS noteNumber, body_markdown AS bodyMarkdown, citation_json AS citationJson, sort_order AS sortOrder FROM research_notes WHERE article_id = ? ORDER BY sort_order`).bind(article.id).all(),
    db.prepare(`SELECT c.id, c.title FROM collection_articles ca JOIN collections c ON c.id = ca.collection_id WHERE ca.article_id = ? AND c.status = 'published' ORDER BY ca.sort_order, c.published_at DESC`).bind(article.id).all(),
    article.metadata?.projectSlug
      ? db.prepare(`SELECT slug, title FROM projects WHERE slug = ? AND status = 'published' LIMIT 1`).bind(article.metadata.projectSlug).first()
      : Promise.resolve(null),
  ]);
  return {
    ...article,
    authors: authors.results || [],
    tags: tags.results || [],
    translations: translations.results || [],
    sections: sections.results || [],
    notes: (notes.results || []).map((item) => ({ ...item, citation: safeJson(item.citationJson) })),
    sources: [
      ...(project ? [{ title: project.title, href: project.slug === 'world-word-history' ? '/articles/world-word-exploration' : `/records/${encodeURIComponent(project.slug)}` }] : []),
      ...(collections.results || []).map((item) => ({ title: item.title, href: `/issues/${encodeURIComponent(item.id)}` })),
    ],
  };
};

export const getPublicSettings = async (db) => {
  const result = await db.prepare(`SELECT key, value_json FROM site_settings WHERE is_public = 1`).all();
  return Object.fromEntries((result.results || []).map((row) => [row.key, safeJson(row.value_json, null)]));
};
