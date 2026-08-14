const cookieValue = (value) => encodeURIComponent(String(value || ''));

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!env.GITHUB_CLIENT_ID) return new Response('GitHub OAuth is not configured', { status: 503 });
  const state = crypto.randomUUID().replaceAll('-', '');
  const returnTo = url.searchParams.get('returnTo')?.startsWith('/') ? url.searchParams.get('returnTo') : '/admin/';
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${url.origin}/api/callback`,
    scope: 'read:user user:email',
    state,
  });
  const headers = new Headers({
    Location: `https://github.com/login/oauth/authorize?${params}`,
    'Cache-Control': 'no-store',
  });
  headers.append('Set-Cookie', `oauth_state=${state}; HttpOnly; Path=/api/callback; SameSite=Lax; Max-Age=600${secure}`);
  headers.append('Set-Cookie', `oauth_return=${cookieValue(returnTo)}; HttpOnly; Path=/api/callback; SameSite=Lax; Max-Age=600${secure}`);
  return new Response(null, { status: 302, headers });
}

export function onRequest() {
  return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
}
