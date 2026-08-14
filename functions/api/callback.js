import { createSession } from './v1/_shared.js';

const getCookie = (request, name) => {
  const item = String(request.headers.get('cookie') || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : '';
};

const clearOauth = (headers, secure) => {
  headers.append('Set-Cookie', `oauth_state=; HttpOnly; Path=/api/callback; SameSite=Lax; Max-Age=0${secure}`);
  headers.append('Set-Cookie', `oauth_return=; HttpOnly; Path=/api/callback; SameSite=Lax; Max-Age=0${secure}`);
};

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state || state !== getCookie(request, 'oauth_state')) return new Response('Invalid OAuth callback', { status: 400 });
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.SESSION_SECRET) return new Response('Admin authentication is not configured', { status: 503 });

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'crivu-admin' },
    body: new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code }),
  });
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) return new Response('GitHub sign-in failed', { status: 502 });
  const userResponse = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'crivu-admin' },
  });
  const user = await userResponse.json();
  if (!userResponse.ok || !user.login) return new Response('GitHub profile lookup failed', { status: 502 });
  const allowed = String(env.ADMIN_GITHUB_LOGINS || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length || !allowed.includes(String(user.login).toLowerCase())) return new Response('This GitHub account is not allowed to manage CRIVU', { status: 403 });

  const session = await createSession({ login: user.login, name: user.name || user.login, avatarUrl: user.avatar_url || '' }, env);
  const returnTo = getCookie(request, 'oauth_return') || '/admin/';
  const headers = new Headers({ Location: returnTo.startsWith('/') ? returnTo : '/admin/', 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', `crivu_admin=${session}; HttpOnly; Path=/; SameSite=Lax; Max-Age=43200${secure}`);
  clearOauth(headers, secure);
  return new Response(null, { status: 302, headers });
}

export function onRequest() {
  return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
}
