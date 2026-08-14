import { handle, json, requireDb, validSlug } from '../_shared.js';
import { serializeProject } from './index.js';

export const onRequestGet = handle(async ({ env, params }) => {
  if (!validSlug(params.slug)) return json({ error: { code: 'not_found', message: 'Project not found' } }, 404);
  const db = requireDb(env);
  const row = await db.prepare(`SELECT p.*, m.public_url AS cover_public_url FROM projects p LEFT JOIN media m ON m.id = p.cover_media_id WHERE p.slug = ? AND p.status = 'published' LIMIT 1`).bind(params.slug).first();
  if (!row) return json({ error: { code: 'not_found', message: 'Project not found' } }, 404);
  const relations = await db.prepare(`SELECT relation_type AS relationType, target_id AS targetId, label, sort_order AS sortOrder FROM project_relations WHERE project_id = ? ORDER BY sort_order`).bind(row.id).all();
  return json({ item: { ...serializeProject(row), relations: relations.results || [] } });
});
