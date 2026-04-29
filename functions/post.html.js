import { articlePath, normalizeText } from '../shared/content.js';

const REDIRECT_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Content-Security-Policy':
    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; img-src 'self' data: https:; script-src 'self'; style-src 'self'; connect-src 'self'",
};

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const slug = normalizeText(url.searchParams.get('slug'), { allowPlaceholder: true });
  const destination = slug ? articlePath(slug) : '/articles.html';
  return new Response(null, {
    status: 302,
    headers: {
      ...REDIRECT_HEADERS,
      Location: destination,
    },
  });
}
