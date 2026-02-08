export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) {
    return new Response('Missing code', { status: 400 });
  }

  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return new Response('Missing GitHub OAuth env vars', { status: 500 });
  }

  const redirectUri = `${url.origin}/api/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  });

  let tokenJson;
  try {
    tokenJson = await tokenRes.json();
  } catch {
    return new Response('Invalid token response from GitHub', { status: 502 });
  }

  if (!tokenJson.access_token) {
    const message = tokenJson.error_description || tokenJson.error || 'No access token';
    return new Response(`No access token: ${message}`, { status: 400 });
  }

  const token = tokenJson.access_token;
  const response = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body>
<script>
  (function() {
    function receiveMessage(e) {
      if (!e.data || e.data.type !== 'authorization:github') return;
      const code = '${token}';
      const message = {
        type: 'authorization:github',
        token: code,
      };
      if (e.source) {
        e.source.postMessage(message, e.origin);
      }
      window.removeEventListener('message', receiveMessage, false);
    }
    window.addEventListener('message', receiveMessage, false);
    window.opener.postMessage('authorizing:github', '*');
  })();
</script>
</body>
</html>`;

  return new Response(response, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
