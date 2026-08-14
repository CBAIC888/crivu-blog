import { handle, json, requireDb, validSlug } from '../_shared.js';

export const onRequestGet = handle(async ({ env, params }) => {
  if (!validSlug(params.slug)) return json({ error: { code: 'not_found', message: 'Page not found' } }, 404);
  const db = requireDb(env);
  const row = await db.prepare(`SELECT id, slug, title, body_markdown AS bodyMarkdown, seo_title AS seoTitle, seo_description AS seoDescription, updated_at AS updatedAt FROM pages WHERE slug = ? AND status = 'published' LIMIT 1`).bind(params.slug).first();
  return row ? json({ item: row }) : json({ error: { code: 'not_found', message: 'Page not found' } }, 404);
});
