import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const posts = readJson('posts/posts.json').items || [];
const issues = readJson('posts/issues.json').issues || [];
const records = readJson('posts/records.json').records || [];
const site = readJson('posts/site.json');
const researchZh = fs.readFileSync(path.join(root, 'src/content/world-research.html'), 'utf8');
const researchEn = fs.readFileSync(path.join(root, 'src/content/world-research-en.md'), 'utf8');

const q = (value) => value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
const idPart = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 80) || crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 16);
const iso = (value) => {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) return null;
  const parsed = new Date(raw.length === 10 ? `${raw}T00:00:00+08:00` : raw);
  return Number.isNaN(parsed.getTime()) ? raw.slice(0, 10) : parsed.toISOString();
};
const published = (item) => item.published !== false;
const statements = ['PRAGMA foreign_keys = ON;'];
const add = (sql) => statements.push(`${sql};`);
const articleIds = new Map();
const media = new Map();

const rememberMedia = (url, title = '') => {
  if (!url || !String(url).startsWith('/')) return null;
  const filename = decodeURIComponent(String(url).split('/').pop() || 'media');
  const key = String(url).replace(/^\/+/, '');
  const id = `media_${crypto.createHash('sha1').update(key).digest('hex').slice(0, 20)}`;
  media.set(id, { id, filename, key, publicUrl: url, title });
  return id;
};

for (const post of posts) rememberMedia(post.cover, post.title);
const researchCover = '/assets/img/uploads/20260723/world-word-exploration-cover.png';
rememberMedia(researchCover, '對「世界」的探索');
for (const issue of issues) rememberMedia(issue.cover, issue.title);
for (const record of records) {
  rememberMedia(record.cover, record.title);
  for (const video of record.videos || []) rememberMedia(video.cover, video.title);
  for (const photo of record.photos || []) rememberMedia(photo.image, photo.alt);
}
for (let index = 1; index <= 17; index += 1) {
  const filename = `world-${String(index).padStart(2, '0')}.webp`;
  const id = `media_world_${String(index).padStart(2, '0')}`;
  media.set(id, { id, filename, key: `research/world-gallery/${filename}`, publicUrl: `/assets/world-gallery/${filename}`, title: `世界研究圖庫 ${index}` });
}
for (const item of media.values()) add(`INSERT INTO media (id,filename,mime_type,title,r2_key,public_url) VALUES (${q(item.id)},${q(item.filename)},${q(item.filename.endsWith('.webp')?'image/webp':'application/octet-stream')},${q(item.title)},${q(item.key)},${q(item.publicUrl)}) ON CONFLICT(id) DO UPDATE SET filename=excluded.filename,title=excluded.title,r2_key=excluded.r2_key,public_url=excluded.public_url`);

add(`INSERT INTO authors (id,name,bio) VALUES ('author_crivu','CRIVU','') ON CONFLICT(id) DO UPDATE SET name=excluded.name`);

for (const post of posts) {
  const id = `article_${idPart(post.slug)}`;
  articleIds.set(post.slug, id);
  const type = post.issue === 'opera' ? 'script' : 'general';
  const status = published(post) ? 'published' : 'draft';
  const coverId = rememberMedia(post.cover, post.title);
  const metadata = { category: post.category || '', legacyIssue: post.issue || '', standaloneHtml: Boolean(post.standaloneHtml) };
  add(`INSERT INTO articles (id,type,status,slug,title,summary,body_markdown,language,cover_media_id,cover_url,published_at,metadata_json) VALUES (${q(id)},${q(type)},${q(status)},${q(post.slug)},${q(post.title)},${q(post.excerpt || '')},${q(post.body || '')},'zh-Hant',${q(coverId)},${q(post.cover || '')},${q(iso(post.date))},${q(JSON.stringify(metadata))}) ON CONFLICT(id) DO UPDATE SET type=excluded.type,status=excluded.status,slug=excluded.slug,title=excluded.title,summary=excluded.summary,body_markdown=excluded.body_markdown,cover_media_id=excluded.cover_media_id,cover_url=excluded.cover_url,published_at=excluded.published_at,metadata_json=excluded.metadata_json`);
  add(`INSERT OR IGNORE INTO article_authors (article_id,author_id,sort_order) VALUES (${q(id)},'author_crivu',0)`);
  for (const tagName of Array.isArray(post.tags) ? post.tags : []) {
    const tagId = `tag_${idPart(tagName)}`;
    add(`INSERT INTO tags (id,slug,name) VALUES (${q(tagId)},${q(idPart(tagName).replaceAll('_','-'))},${q(tagName)}) ON CONFLICT(name) DO NOTHING`);
    add(`INSERT OR IGNORE INTO article_tags (article_id,tag_id) SELECT ${q(id)},id FROM tags WHERE name=${q(tagName)}`);
  }
}

const researchCoverId = rememberMedia(researchCover, '對「世界」的探索');
const researchPublishedAt = iso(records.find((record) => record.id === 'world-word-history')?.date) || '2026-07-22T20:00:00.000Z';
add(`INSERT INTO articles (id,type,status,slug,title,summary,body_markdown,language,cover_media_id,cover_url,published_at,metadata_json) VALUES ('article_world_zh','research','published','world-word-exploration','對『世界』的探索','從先秦兩漢的舊字、東漢譯經與佛教宇宙論出發，追索「世界」一詞近兩千年的形成與變化。',${q(researchZh)},'zh-Hant',${q(researchCoverId)},${q(researchCover)},${q(researchPublishedAt)},${q(JSON.stringify({ format: 'html', projectSlug: 'world-word-history', gallery: '/records/world-word-history/gallery', exhibition: '/records/world-word-history/museum' }))}) ON CONFLICT(id) DO UPDATE SET body_markdown=excluded.body_markdown,metadata_json=excluded.metadata_json`);
add(`INSERT INTO articles (id,type,status,slug,title,summary,body_markdown,language,cover_media_id,cover_url,published_at,metadata_json) VALUES ('article_world_en','research','published','world-word-exploration-en','An Exploration of Shijie 世界 (“World”)','Tracing nearly two millennia in the formation and transformation of shijie.',${q(researchEn)},'en',${q(researchCoverId)},${q(researchCover)},${q(researchPublishedAt)},${q(JSON.stringify({ format: 'markdown', isTranslation: true, projectSlug: 'world-word-history', gallery: '/records/world-word-history/gallery?lang=en', exhibition: '/records/world-word-history/museum' }))}) ON CONFLICT(id) DO UPDATE SET body_markdown=excluded.body_markdown,metadata_json=excluded.metadata_json`);
add(`INSERT OR IGNORE INTO article_authors (article_id,author_id,sort_order) VALUES ('article_world_zh','author_crivu',0)`);
add(`INSERT OR IGNORE INTO article_authors (article_id,author_id,sort_order) VALUES ('article_world_en','author_crivu',0)`);
add(`INSERT INTO article_translations (article_id,language,translation_article_id,hreflang) VALUES ('article_world_zh','en','article_world_en','en') ON CONFLICT(article_id,language) DO UPDATE SET translation_article_id=excluded.translation_article_id`);
add(`INSERT INTO article_translations (article_id,language,translation_article_id,hreflang) VALUES ('article_world_en','zh-Hant','article_world_zh','zh-Hant') ON CONFLICT(article_id,language) DO UPDATE SET translation_article_id=excluded.translation_article_id`);

for (const issue of issues) {
  const coverId = rememberMedia(issue.cover, issue.title);
  add(`INSERT INTO collections (id,type,status,title,theme,cover_media_id,cover_url,editor_note,year,published_at) VALUES (${q(issue.id)},'collection',${q(published(issue)?'published':'draft')},${q(issue.title)},${q(issue.theme||'')},${q(coverId)},${q(issue.cover||'')},${q(issue.editorNote||'')},${q(Number(iso(issue.publishDate)?.slice(0,4))||null)},${q(iso(issue.publishDate))}) ON CONFLICT(id) DO UPDATE SET status=excluded.status,title=excluded.title,theme=excluded.theme,cover_media_id=excluded.cover_media_id,cover_url=excluded.cover_url,editor_note=excluded.editor_note,year=excluded.year,published_at=excluded.published_at`);
  add(`DELETE FROM collection_articles WHERE collection_id=${q(issue.id)}`);
  (issue.posts || []).forEach((item, index) => { const slug = typeof item === 'string' ? item : item?.slug; if (articleIds.has(slug)) add(`INSERT INTO collection_articles (collection_id,article_id,sort_order) VALUES (${q(issue.id)},${q(articleIds.get(slug))},${index})`); });
}

for (const record of records) {
  const id = `project_${idPart(record.id)}`;
  const coverId = rememberMedia(record.cover, record.title);
  const metadata = { videos: record.videos || [], photos: record.photos || [], legacyPage: record.page || '' };
  for (const video of record.videos || []) rememberMedia(video.cover, video.title);
  for (const photo of record.photos || []) rememberMedia(photo.image, photo.alt);
  add(`INSERT INTO projects (id,slug,type,status,title,summary,start_date,cover_media_id,cover_url,metadata_json) VALUES (${q(id)},${q(record.id)},'project',${q(record.published===true?'published':'draft')},${q(record.title)},${q(record.summary||'')},${q(iso(record.date))},${q(coverId)},${q(record.cover||'')},${q(JSON.stringify(metadata))}) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,status=excluded.status,title=excluded.title,summary=excluded.summary,start_date=excluded.start_date,cover_media_id=excluded.cover_media_id,cover_url=excluded.cover_url,metadata_json=excluded.metadata_json`);
  if (record.id === 'world-word-history') {
    add(`INSERT OR REPLACE INTO project_relations (project_id,relation_type,target_id,label,sort_order) VALUES (${q(id)},'article','article_world_zh','中文研究',0)`);
    add(`INSERT OR REPLACE INTO project_relations (project_id,relation_type,target_id,label,sort_order) VALUES (${q(id)},'translation','article_world_en','English',1)`);
    add(`INSERT OR REPLACE INTO project_relations (project_id,relation_type,target_id,label,sort_order) VALUES (${q(id)},'gallery','world-gallery','圖片展示',2)`);
    add(`INSERT OR REPLACE INTO project_relations (project_id,relation_type,target_id,label,sort_order) VALUES (${q(id)},'exhibition','/records/world-word-history/museum','展覽',3)`);
  }
}

add(`INSERT INTO pages (id,slug,title,body_markdown,status,seo_description) VALUES ('page_about','about',${q(site.aboutTitle||'關於')},${q(site.aboutBody||'')},'published',${q(site.siteDescription||'')}) ON CONFLICT(id) DO UPDATE SET title=excluded.title,body_markdown=excluded.body_markdown,status=excluded.status,seo_description=excluded.seo_description`);
const publicSettings = {
  siteName: site.siteName || 'CRIVU', siteDescription: site.siteDescription || '', footerText: site.footerText || '© 2026 CRIVU',
  searchPlaceholder: site.searchPlaceholder || '搜尋', themeToggleEnabled: site.themeToggleEnabled !== false,
  navigation: [
    { label: '全部', href: '/articles' }, { label: '期刊', href: '/issues' }, { label: '紀錄', href: '/records' },
    { label: '關於', href: '/about' }, { label: 'RSS', href: '/rss.xml' },
  ],
};
for (const [key, value] of Object.entries(publicSettings)) add(`INSERT INTO site_settings (key,value_json,is_public) VALUES (${q(key)},${q(JSON.stringify(value))},1) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,is_public=1`);

const sourceHash = crypto.createHash('sha256').update(JSON.stringify({ posts, issues, records, site }) + researchZh + researchEn).digest('hex');
const summary = { articles: posts.length + 2, collections: issues.length, projects: records.length, pages: 1, media: media.size };
add(`INSERT INTO import_runs (id,source_hash,summary_json) VALUES (${q(`legacy_${sourceHash.slice(0,16)}`)},${q(sourceHash)},${q(JSON.stringify(summary))}) ON CONFLICT(source_hash) DO NOTHING`);

const sql = `${statements.join('\n')}\n`;
const outputIndex = process.argv.indexOf('--output');
if (outputIndex >= 0) {
  const target = path.resolve(process.cwd(), process.argv[outputIndex + 1]);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, sql);
  console.log(JSON.stringify({ output: target, sourceHash, ...summary }));
} else {
  process.stdout.write(sql);
}
