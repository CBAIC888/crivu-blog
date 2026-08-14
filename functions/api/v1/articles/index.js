import { handle, json, loadArticleRelations, parseLimit, publicArticle, requireDb } from '../_shared.js';

export const onRequestGet = handle(async ({ env, request }) => {
  const db = requireDb(env);
  const url = new URL(request.url);
  const limit = parseLimit(url);
  const type = url.searchParams.get('type');
  const values = [];
  let filter = `a.status = 'published' AND COALESCE(json_extract(a.metadata_json, '$.isTranslation'), 0) = 0 AND (a.published_at IS NULL OR a.published_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
  if (['general', 'research', 'script'].includes(type)) {
    filter += ' AND a.type = ?';
    values.push(type);
  }
  values.push(limit);
  const result = await db.prepare(
    `SELECT a.*, m.public_url AS cover_public_url FROM articles a LEFT JOIN media m ON m.id = a.cover_media_id WHERE ${filter} ORDER BY COALESCE(a.published_at, a.created_at) DESC LIMIT ?`
  ).bind(...values).all();
  const items = (result.results || []).map(publicArticle).map(({ bodyMarkdown, ...item }) => item);
  return json({ items, count: items.length });
});
