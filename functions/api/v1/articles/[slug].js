import { handle, json, loadArticleRelations, publicArticle, requireDb, validSlug } from '../_shared.js';

export const onRequestGet = handle(async ({ env, params }) => {
  if (!validSlug(params.slug)) return json({ error: { code: 'not_found', message: 'Article not found' } }, 404);
  const db = requireDb(env);
  const row = await db.prepare(
    `SELECT a.*, m.public_url AS cover_public_url FROM articles a LEFT JOIN media m ON m.id = a.cover_media_id WHERE a.slug = ? AND a.status = 'published' AND (a.published_at IS NULL OR a.published_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) LIMIT 1`
  ).bind(params.slug).first();
  if (!row) return json({ error: { code: 'not_found', message: 'Article not found' } }, 404);
  return json({ item: await loadArticleRelations(db, publicArticle(row)) });
});
