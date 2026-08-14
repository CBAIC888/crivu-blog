import { handle, json, parseLimit, requireDb, safeJson } from '../_shared.js';

const serialize = (row) => ({
  id: row.id, type: row.type, title: row.title, theme: row.theme || '', coverUrl: row.cover_public_url || row.cover_url || '',
  editorNote: row.editor_note || '', year: row.year, volume: row.volume || '', issueNumber: row.issue_number || '',
  publishedAt: row.published_at || '', pdfUrl: row.pdf_public_url || '', metadata: safeJson(row.metadata_json), version: row.version,
});

export const onRequestGet = handle(async ({ env, request }) => {
  const db = requireDb(env);
  const limit = parseLimit(new URL(request.url));
  const result = await db.prepare(`SELECT c.*, cover.public_url AS cover_public_url, pdf.public_url AS pdf_public_url FROM collections c LEFT JOIN media cover ON cover.id = c.cover_media_id LEFT JOIN media pdf ON pdf.id = c.pdf_media_id WHERE c.status = 'published' ORDER BY COALESCE(c.published_at, c.created_at) DESC LIMIT ?`).bind(limit).all();
  const items = (result.results || []).map(serialize);
  return json({ items, count: items.length });
});

export { serialize as serializeCollection };
