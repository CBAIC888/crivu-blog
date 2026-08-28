import { cleanText, failure, getDb, handle, json, makeId, parseJson } from './_shared.js';

const encoder = new TextEncoder();
const hex = (buffer) => Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
const hash = async (value, salt) => hex(await crypto.subtle.digest('SHA-256', encoder.encode(`${salt}:${value}`)));
const ip = (request) => request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || '';
const local = (request) => ['localhost', '127.0.0.1'].includes(new URL(request.url).hostname);

const verifyTurnstile = async (request, env, token) => {
  if (local(request) && env.GUESTBOOK_ALLOW_UNVERIFIED === 'true') return true;
  if (!env.TURNSTILE_SECRET_KEY || !token) return false;
  const body = new FormData();
  body.append('secret', env.TURNSTILE_SECRET_KEY);
  body.append('response', token);
  if (ip(request)) body.append('remoteip', ip(request));
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  if (!response.ok) return false;
  const result = await response.json();
  return result.success === true && (!result.action || result.action === 'guestbook_submit');
};

export const onRequestGet = handle(async ({ env }) => {
  const db = getDb(env);
  if (!db) return json({ enabled: false, entries: [] });
  const result = await db.prepare(`SELECT id, author_name AS authorName, body, admin_reply AS adminReply, created_at AS createdAt FROM guestbook_entries WHERE status = 'approved' ORDER BY created_at ASC LIMIT 200`).all();
  return json({ enabled: true, entries: result.results || [], turnstileSiteKey: env.TURNSTILE_SITE_KEY || '' });
});

export const onRequestPost = handle(async (context) => {
  const { env, request } = context;
  const db = getDb(env);
  if (!db) return failure(503, 'database_unavailable', 'Guestbook is not configured');
  const salt = cleanText(env.GUESTBOOK_HASH_SALT, 500);
  if (!salt) return failure(503, 'privacy_unavailable', 'Guestbook privacy hashing is not configured');
  const payload = await parseJson(request, 16_000);
  if (payload.website) return json({ accepted: true }, 202);
  const authorName = cleanText(payload.authorName, 32);
  const email = cleanText(payload.email, 160).toLowerCase();
  const body = cleanText(payload.body, 1200);
  if (!authorName || !body) return failure(400, 'validation_error', 'Name and message are required');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return failure(400, 'validation_error', 'Email is invalid');
  if (!(await verifyTurnstile(request, env, payload.turnstileToken))) return failure(400, 'verification_failed', 'Verification failed');
  const ipHash = await hash(ip(request), salt);
  const recent = await db.prepare(`SELECT COUNT(*) AS count FROM guestbook_entries WHERE ip_hash = ? AND created_at >= datetime('now', '-15 minutes')`).bind(ipHash).first();
  if (Number(recent?.count || 0) >= 5) return failure(429, 'rate_limited', 'Please wait before posting again');
  await db.prepare(`INSERT INTO guestbook_entries (id, author_name, author_email_hash, body, ip_hash, user_agent_hash) VALUES (?, ?, ?, ?, ?, ?)`).bind(
    makeId('g'), authorName, email ? await hash(email, salt) : '', body, ipHash, await hash(request.headers.get('user-agent') || '', salt)
  ).run();
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    context.waitUntil(fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `CRIVU 留言板有新留言待審核\n\n${authorName}：${body.slice(0, 280)}` }) }));
  }
  return json({ accepted: true, moderation: 'pending' }, 202);
});
