import { ensureArticleLikesTable, failure, handle, json, parseJson, requireDb, validSlug } from '../../_shared.js';

const publicArticle = async (db, slug) => db.prepare(
  `SELECT id FROM articles WHERE slug = ? AND ((status = 'published' AND (published_at IS NULL OR datetime(published_at) <= datetime('now'))) OR (status = 'scheduled' AND scheduled_at IS NOT NULL AND datetime(scheduled_at) <= datetime('now'))) LIMIT 1`
).bind(slug).first();

const countFor = async (db, articleId) => {
  const row = await db.prepare(`SELECT like_count AS likeCount FROM article_likes WHERE article_id = ?`).bind(articleId).first();
  return Math.max(0, Number(row?.likeCount || 0));
};

export const onRequestGet = handle(async ({ env, params }) => {
  if (!validSlug(params.slug)) return failure(404, 'not_found', 'Article not found');
  const db = requireDb(env), article = await publicArticle(db, params.slug);
  if (!article) return failure(404, 'not_found', 'Article not found');
  await ensureArticleLikesTable(db);
  return json({ count: await countFor(db, article.id) });
});

export const onRequestPost = handle(async ({ env, params, request }) => {
  if (!validSlug(params.slug)) return failure(404, 'not_found', 'Article not found');
  const db = requireDb(env), article = await publicArticle(db, params.slug);
  if (!article) return failure(404, 'not_found', 'Article not found');
  await ensureArticleLikesTable(db);
  const payload = await parseJson(request, 1_000), delta = Number(payload.delta);
  if (![1, -1].includes(delta)) return failure(400, 'validation_error', 'Like delta must be 1 or -1');
  await db.prepare(`INSERT INTO article_likes (article_id, like_count, updated_at) VALUES (?, ?, ?) ON CONFLICT(article_id) DO UPDATE SET like_count = MAX(0, article_likes.like_count + ?), updated_at = excluded.updated_at`).bind(article.id, delta > 0 ? 1 : 0, new Date().toISOString(), delta).run();
  return json({ count: await countFor(db, article.id) });
});
