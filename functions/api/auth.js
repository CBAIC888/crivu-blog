export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(request.url);
  const provider = url.searchParams.get('provider');
  if (!provider || provider !== 'github') {
    return new Response('Missing provider', { status: 400 });
  }

  const clientId = env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return new Response('Missing GITHUB_CLIENT_ID', { status: 500 });
  }

  const redirectUri = `${url.origin}/api/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'repo',
  });

  return Response.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`, 302);
}
