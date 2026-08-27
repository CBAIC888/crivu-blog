import { handle, json, loadArticleRelations, parseLimit, publicArticle, requireDb } from '../_shared.js';
import { stripMarkdown } from '../../../../shared/content.js';

export const onRequestGet = handle(async ({ env, request }) => {
  const db = requireDb(env);
  const url = new URL(request.url);
  const limit = parseLimit(url);
  const type = url.searchParams.get('type');
  const values = [];
  let filter = `((a.status = 'published' AND (a.published_at IS NULL OR datetime(a.published_at) <= datetime('now'))) OR (a.status = 'scheduled' AND a.scheduled_at IS NOT NULL AND datetime(a.scheduled_at) <= datetime('now'))) AND COALESCE(json_extract(a.metadata_json, '$.isTranslation'), 0) = 0`;
  if (['general', 'research', 'script'].includes(type)) {
    filter += ' AND a.type = ?';
    values.push(type);
  }
  values.push(limit);
  const result = await db.prepare(
    `SELECT a.*, m.public_url AS cover_public_url FROM articles a LEFT JOIN media m ON m.id = a.cover_media_id WHERE ${filter} ORDER BY COALESCE(a.published_at, a.scheduled_at, a.created_at) DESC LIMIT ?`
  ).bind(...values).all();
  const items = (result.results || []).map(publicArticle).map(({ bodyMarkdown, ...item }) => ({
    ...item,
    searchText: stripMarkdown(bodyMarkdown).replace(/\s+/g, ' ').trim(),
  }));
  return json({ items, count: items.length });
});
