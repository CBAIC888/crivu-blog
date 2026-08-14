import { handle, json, parseLimit, requireDb, safeJson } from '../_shared.js';

const serialize = (row) => ({
  id: row.id, slug: row.slug, type: row.type, title: row.title, summary: row.summary || '', bodyMarkdown: row.body_markdown || '',
  startDate: row.start_date || '', endDate: row.end_date || '', location: row.location || '', participants: row.participants || '',
  editor: row.editor || '', coverUrl: row.cover_public_url || row.cover_url || '', metadata: safeJson(row.metadata_json), version: row.version,
});

export const onRequestGet = handle(async ({ env, request }) => {
  const db = requireDb(env);
  const limit = parseLimit(new URL(request.url));
  const result = await db.prepare(`SELECT p.*, m.public_url AS cover_public_url FROM projects p LEFT JOIN media m ON m.id = p.cover_media_id WHERE p.status = 'published' ORDER BY COALESCE(p.start_date, p.created_at) DESC LIMIT ?`).bind(limit).all();
  const items = (result.results || []).map(serialize).map(({ bodyMarkdown, ...item }) => item);
  return json({ items, count: items.length });
});

export { serialize as serializeProject };
