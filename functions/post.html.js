import { articlePath, normalizeText } from '../shared/content.js';

const REDIRECT_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy':
    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; img-src 'self' data: https:; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; connect-src 'self' https://cloudflareinsights.com",
};

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const slug = normalizeText(url.searchParams.get('slug'), { allowPlaceholder: true });
  const destination = slug ? articlePath(slug) : '/articles.html';
  return new Response(null, {
    status: 301,
    headers: {
      ...REDIRECT_HEADERS,
      Location: destination,
    },
  });
}
