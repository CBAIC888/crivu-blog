import { handle, json, publicArticle, requireDb, validId } from '../_shared.js';
import { serializeCollection } from './index.js';

export const onRequestGet = handle(async ({ env, params }) => {
  if (!validId(params.id)) return json({ error: { code: 'not_found', message: 'Collection not found' } }, 404);
  const db = requireDb(env);
  const row = await db.prepare(`SELECT c.*, cover.public_url AS cover_public_url, pdf.public_url AS pdf_public_url FROM collections c LEFT JOIN media cover ON cover.id = c.cover_media_id LEFT JOIN media pdf ON pdf.id = c.pdf_media_id WHERE c.id = ? AND c.status = 'published' LIMIT 1`).bind(params.id).first();
  if (!row) return json({ error: { code: 'not_found', message: 'Collection not found' } }, 404);
  const linked = await db.prepare(`SELECT a.*, m.public_url AS cover_public_url FROM collection_articles ca JOIN articles a ON a.id = ca.article_id LEFT JOIN media m ON m.id = a.cover_media_id WHERE ca.collection_id = ? AND a.status = 'published' ORDER BY ca.sort_order`).bind(params.id).all();
  return json({ item: { ...serializeCollection(row), articles: (linked.results || []).map(publicArticle).map(({ bodyMarkdown, ...item }) => item) } });
});
