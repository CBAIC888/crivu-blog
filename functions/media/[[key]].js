export async function onRequestGet({ env, params, request }) {
  if (!env.MEDIA_BUCKET) return new Response('Media storage unavailable', { status: 503 });
  const parts = Array.isArray(params.key) ? params.key : [params.key];
  const key = parts.map((part) => decodeURIComponent(String(part || ''))).join('/');
  if (!key || key.includes('..') || !key.startsWith('media/')) return new Response('Not found', { status: 404 });
  const object = await env.MEDIA_BUCKET.get(key, { onlyIf: request.headers });
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  if (!object.body) return new Response(null, { status: 304, headers });
  return new Response(object.body, { headers });
}
