import {
  cleanSlug, cleanText, failure, handle, json, makeId, parseJson, readSession,
  requireAdmin, requireDb, safeJson, validId, validSlug,
} from '../_shared.js';

const pathParts = (params) => Array.isArray(params.path) ? params.path : String(params.path || '').split('/').filter(Boolean);
const now = () => new Date().toISOString();
const rows = (result) => result.results || [];
const serializeGuestbook = (row) => ({ id: row.id, authorName: row.author_name, body: row.body, status: row.status, source: row.source, adminReply: row.admin_reply || '', createdAt: row.created_at, updatedAt: row.updated_at });
const allowed = (value, values, fallback) => values.includes(value) ? value : fallback;
const etag = (version) => ({ ETag: `"${version}"` });
const expectedVersion = (request, fallback) => Number(String(request.headers.get('if-match') || fallback || '').replaceAll('"', ''));
const conflict = () => failure(409, 'version_conflict', 'This item changed after you opened it. Reload before saving.');
const timestamp = (value) => {
  const raw = cleanText(value, 40);
  if (!raw) return null;
  const source = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? `${raw}T00:00:00+08:00`
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(raw)
      ? `${raw}+08:00`
      : raw;
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) throw Object.assign(new Error('Invalid date or time'), { status: 400, code: 'validation_error' });
  return parsed.toISOString();
};

const articleFields = (payload) => ({
  type: allowed(payload.type, ['general', 'research', 'script'], 'general'),
  status: allowed(payload.status, ['draft', 'review', 'scheduled', 'published', 'archived'], 'draft'),
  slug: cleanSlug(payload.slug), title: cleanText(payload.title, 300), subtitle: cleanText(payload.subtitle, 500),
  summary: cleanText(payload.summary, 3000), body: String(payload.bodyMarkdown ?? payload.body ?? '').replace(/\r\n/g, '\n').slice(0, 2_000_000),
  language: cleanText(payload.language || 'zh-Hant', 20), coverMediaId: cleanText(payload.coverMediaId, 120) || null,
  coverUrl: cleanText(payload.coverUrl, 1000) || null, publishedAt: timestamp(payload.publishedAt),
  scheduledAt: timestamp(payload.scheduledAt), seoTitle: cleanText(payload.seoTitle, 300),
  seoDescription: cleanText(payload.seoDescription, 1000), canonicalUrl: cleanText(payload.canonicalUrl, 1000),
  license: cleanText(payload.license, 300), metadata: JSON.stringify(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
});

const serializeArticle = (row) => ({
  id: row.id, type: row.type, status: row.status, slug: row.slug, title: row.title, subtitle: row.subtitle || '', summary: row.summary || '',
  bodyMarkdown: row.body_markdown || '', language: row.language, coverMediaId: row.cover_media_id || '', coverUrl: row.cover_url || '',
  publishedAt: row.published_at || '', scheduledAt: row.scheduled_at || '', updatedAt: row.updated_at, seoTitle: row.seo_title || '',
  seoDescription: row.seo_description || '', canonicalUrl: row.canonical_url || '', license: row.license || '', metadata: safeJson(row.metadata_json), version: row.version,
});

const hydrateArticle = async (db, row) => {
  const [tags, authors, translations, revisions] = await Promise.all([
    db.prepare(`SELECT t.id, t.slug, t.name FROM article_tags x JOIN tags t ON t.id = x.tag_id WHERE x.article_id = ? ORDER BY t.name`).bind(row.id).all(),
    db.prepare(`SELECT a.id, a.name, a.orcid, a.institution, x.is_corresponding AS isCorresponding FROM article_authors x JOIN authors a ON a.id = x.author_id WHERE x.article_id = ? ORDER BY x.sort_order`).bind(row.id).all(),
    db.prepare(`SELECT x.language, x.hreflang, x.translation_article_id AS translationArticleId, a.title, a.slug FROM article_translations x JOIN articles a ON a.id = x.translation_article_id WHERE x.article_id = ?`).bind(row.id).all(),
    db.prepare(`SELECT id, version, changed_by AS changedBy, created_at AS createdAt FROM article_revisions WHERE article_id = ? ORDER BY version DESC LIMIT 30`).bind(row.id).all(),
  ]);
  return { ...serializeArticle(row), tags: rows(tags), authors: rows(authors), translations: rows(translations), revisions: rows(revisions) };
};

const replaceArticleTags = async (db, articleId, tags) => {
  const statements = [db.prepare(`DELETE FROM article_tags WHERE article_id = ?`).bind(articleId)];
  for (const raw of Array.isArray(tags) ? tags : []) {
    const name = cleanText(typeof raw === 'string' ? raw : raw?.name, 80);
    if (!name) continue;
    let tag = await db.prepare(`SELECT id FROM tags WHERE name = ?`).bind(name).first();
    if (!tag) {
      const id = makeId('tag');
      const slug = cleanSlug(name.normalize('NFKD').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')) || id;
      await db.prepare(`INSERT INTO tags (id, slug, name) VALUES (?, ?, ?)`).bind(id, slug, name).run();
      tag = { id };
    }
    statements.push(db.prepare(`INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)`).bind(articleId, tag.id));
  }
  await db.batch(statements);
};

const listArticles = async (db, url) => {
  const status = url.searchParams.get('status');
  const type = url.searchParams.get('type');
  const values = [];
  const clauses = [];
  if (['draft', 'review', 'scheduled', 'published', 'archived'].includes(status)) { clauses.push('status = ?'); values.push(status); }
  if (['general', 'research', 'script'].includes(type)) { clauses.push('type = ?'); values.push(type); }
  const result = await db.prepare(`SELECT * FROM articles ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY updated_at DESC LIMIT 300`).bind(...values).all();
  return rows(result).map(serializeArticle).map(({ bodyMarkdown, ...item }) => item);
};

const createArticle = async (db, payload, session) => {
  const item = articleFields(payload);
  if (!validSlug(item.slug) || !item.title) throw Object.assign(new Error('Title and a valid slug are required'), { status: 400, code: 'validation_error' });
  if (item.status === 'scheduled' && !item.scheduledAt) throw Object.assign(new Error('Scheduled articles require a scheduled time'), { status: 400, code: 'validation_error' });
  const id = validId(payload.id) ? payload.id : makeId('article');
  await db.prepare(`INSERT INTO articles (id,type,status,slug,title,subtitle,summary,body_markdown,language,cover_media_id,cover_url,published_at,scheduled_at,seo_title,seo_description,canonical_url,license,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    id, item.type, item.status, item.slug, item.title, item.subtitle, item.summary, item.body, item.language, item.coverMediaId, item.coverUrl, item.publishedAt, item.scheduledAt, item.seoTitle, item.seoDescription, item.canonicalUrl, item.license, item.metadata
  ).run();
  await replaceArticleTags(db, id, payload.tags);
  const created = await db.prepare(`SELECT * FROM articles WHERE id = ?`).bind(id).first();
  await db.prepare(`INSERT INTO article_revisions (id, article_id, version, snapshot_json, changed_by) VALUES (?, ?, 1, ?, ?)`).bind(makeId('rev'), id, JSON.stringify(serializeArticle(created)), session.login).run();
  return hydrateArticle(db, created);
};

const updateArticle = async (db, id, payload, request, session) => {
  const existing = await db.prepare(`SELECT * FROM articles WHERE id = ?`).bind(id).first();
  if (!existing) return null;
  if (expectedVersion(request, payload.version) !== Number(existing.version)) return conflict();
  const item = articleFields({ ...serializeArticle(existing), ...payload });
  if (!validSlug(item.slug) || !item.title) throw Object.assign(new Error('Title and a valid slug are required'), { status: 400, code: 'validation_error' });
  if (item.status === 'scheduled' && !item.scheduledAt) throw Object.assign(new Error('Scheduled articles require a scheduled time'), { status: 400, code: 'validation_error' });
  const nextVersion = Number(existing.version) + 1;
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO article_revisions (id, article_id, version, snapshot_json, changed_by) VALUES (?, ?, ?, ?, ?)`).bind(makeId('rev'), id, existing.version, JSON.stringify(serializeArticle(existing)), session.login),
    db.prepare(`UPDATE articles SET type=?,status=?,slug=?,title=?,subtitle=?,summary=?,body_markdown=?,language=?,cover_media_id=?,cover_url=?,published_at=?,scheduled_at=?,seo_title=?,seo_description=?,canonical_url=?,license=?,metadata_json=?,version=?,updated_at=? WHERE id=? AND version=?`).bind(
      item.type,item.status,item.slug,item.title,item.subtitle,item.summary,item.body,item.language,item.coverMediaId,item.coverUrl,item.publishedAt,item.scheduledAt,item.seoTitle,item.seoDescription,item.canonicalUrl,item.license,item.metadata,nextVersion,now(),id,existing.version
    ),
  ]);
  await replaceArticleTags(db, id, payload.tags ?? []);
  return hydrateArticle(db, await db.prepare(`SELECT * FROM articles WHERE id = ?`).bind(id).first());
};

const restoreArticle = async (db, articleId, revisionId, session) => {
  const revision = await db.prepare(`SELECT snapshot_json FROM article_revisions WHERE id = ? AND article_id = ?`).bind(revisionId, articleId).first();
  if (!revision) return null;
  const snapshot = safeJson(revision.snapshot_json);
  const existing = await db.prepare(`SELECT * FROM articles WHERE id = ?`).bind(articleId).first();
  const payload = { ...snapshot, version: existing.version };
  return updateArticle(db, articleId, payload, new Request('https://local', { headers: { 'If-Match': String(existing.version) } }), session);
};

const serializeCollection = (row) => ({ id: row.id, type: row.type, status: row.status, title: row.title, theme: row.theme || '', coverMediaId: row.cover_media_id || '', coverUrl: row.cover_url || '', editorNote: row.editor_note || '', year: row.year || '', volume: row.volume || '', issueNumber: row.issue_number || '', publishedAt: row.published_at || '', pdfMediaId: row.pdf_media_id || '', metadata: safeJson(row.metadata_json), version: row.version, updatedAt: row.updated_at });
const collectionFields = (payload) => ({ id: cleanText(payload.id,120), type: allowed(payload.type,['collection','journal_issue'],'collection'), status: allowed(payload.status,['draft','published','archived'],'draft'), title: cleanText(payload.title,300), theme: cleanText(payload.theme,500), coverMediaId: cleanText(payload.coverMediaId,120)||null, coverUrl: cleanText(payload.coverUrl,1000)||null, editorNote: cleanText(payload.editorNote,20_000), year: Number(payload.year)||null, volume: cleanText(payload.volume,50), issueNumber: cleanText(payload.issueNumber,50), publishedAt: timestamp(payload.publishedAt), pdfMediaId: cleanText(payload.pdfMediaId,120)||null, metadata: JSON.stringify(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}) });
const replaceCollectionArticles = async (db, id, ids) => db.batch([db.prepare(`DELETE FROM collection_articles WHERE collection_id=?`).bind(id), ...(Array.isArray(ids)?ids:[]).filter(validId).map((articleId,index)=>db.prepare(`INSERT INTO collection_articles (collection_id,article_id,sort_order) VALUES (?,?,?)`).bind(id,articleId,index))]);
const hydrateCollection = async (db,row) => ({ ...serializeCollection(row), articleIds: rows(await db.prepare(`SELECT article_id AS articleId FROM collection_articles WHERE collection_id=? ORDER BY sort_order`).bind(row.id).all()).map(x=>x.articleId) });

const serializeProject = (row) => ({ id:row.id,slug:row.slug,type:row.type,status:row.status,title:row.title,summary:row.summary||'',bodyMarkdown:row.body_markdown||'',startDate:row.start_date||'',endDate:row.end_date||'',location:row.location||'',participants:row.participants||'',editor:row.editor||'',coverMediaId:row.cover_media_id||'',coverUrl:row.cover_url||'',metadata:safeJson(row.metadata_json),version:row.version,updatedAt:row.updated_at });
const projectFields = (p) => ({ id:cleanText(p.id,120),slug:cleanSlug(p.slug),type:cleanText(p.type||'project',80),status:allowed(p.status,['draft','published','archived'],'draft'),title:cleanText(p.title,300),summary:cleanText(p.summary,3000),body:String(p.bodyMarkdown??'').slice(0,2_000_000),startDate:cleanText(p.startDate,40)||null,endDate:cleanText(p.endDate,40)||null,location:cleanText(p.location,500),participants:cleanText(p.participants,3000),editor:cleanText(p.editor,500),coverMediaId:cleanText(p.coverMediaId,120)||null,coverUrl:cleanText(p.coverUrl,1000)||null,metadata:JSON.stringify(p.metadata&&typeof p.metadata==='object'?p.metadata:{}) });
const replaceProjectRelations = async (db,id,relations) => db.batch([db.prepare(`DELETE FROM project_relations WHERE project_id=?`).bind(id), ...(Array.isArray(relations)?relations:[]).filter(x=>x?.targetId&&['article','translation','gallery','exhibition','collection','media'].includes(x.relationType)).map((x,index)=>db.prepare(`INSERT INTO project_relations (project_id,relation_type,target_id,label,sort_order) VALUES (?,?,?,?,?)`).bind(id,x.relationType,cleanText(x.targetId,500),cleanText(x.label,300),index))]);
const hydrateProject = async (db,row) => ({...serializeProject(row),relations:rows(await db.prepare(`SELECT relation_type AS relationType,target_id AS targetId,label,sort_order AS sortOrder FROM project_relations WHERE project_id=? ORDER BY sort_order`).bind(row.id).all())});

const upsertSimpleResource = async (db, resource, id, payload, request) => {
  if (resource === 'collections') {
    const item=collectionFields({...payload,id:id||payload.id}); if(!validId(item.id)||!item.title) throw Object.assign(new Error('ID and title are required'),{status:400,code:'validation_error'});
    const existing=await db.prepare(`SELECT * FROM collections WHERE id=?`).bind(item.id).first();
    if(existing&&expectedVersion(request,payload.version)!==Number(existing.version)) return conflict();
    if(existing) await db.prepare(`UPDATE collections SET type=?,status=?,title=?,theme=?,cover_media_id=?,cover_url=?,editor_note=?,year=?,volume=?,issue_number=?,published_at=?,pdf_media_id=?,metadata_json=?,version=version+1,updated_at=? WHERE id=?`).bind(item.type,item.status,item.title,item.theme,item.coverMediaId,item.coverUrl,item.editorNote,item.year,item.volume,item.issueNumber,item.publishedAt,item.pdfMediaId,item.metadata,now(),item.id).run();
    else await db.prepare(`INSERT INTO collections (id,type,status,title,theme,cover_media_id,cover_url,editor_note,year,volume,issue_number,published_at,pdf_media_id,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(item.id,item.type,item.status,item.title,item.theme,item.coverMediaId,item.coverUrl,item.editorNote,item.year,item.volume,item.issueNumber,item.publishedAt,item.pdfMediaId,item.metadata).run();
    await replaceCollectionArticles(db,item.id,payload.articleIds); return hydrateCollection(db,await db.prepare(`SELECT * FROM collections WHERE id=?`).bind(item.id).first());
  }
  if(resource==='projects'){
    const item=projectFields({...payload,id:id||payload.id}); if(!validId(item.id)||!validSlug(item.slug)||!item.title) throw Object.assign(new Error('ID, title and a valid slug are required'),{status:400,code:'validation_error'});
    const existing=await db.prepare(`SELECT * FROM projects WHERE id=?`).bind(item.id).first(); if(existing&&expectedVersion(request,payload.version)!==Number(existing.version)) return conflict();
    if(existing) await db.prepare(`UPDATE projects SET slug=?,type=?,status=?,title=?,summary=?,body_markdown=?,start_date=?,end_date=?,location=?,participants=?,editor=?,cover_media_id=?,cover_url=?,metadata_json=?,version=version+1,updated_at=? WHERE id=?`).bind(item.slug,item.type,item.status,item.title,item.summary,item.body,item.startDate,item.endDate,item.location,item.participants,item.editor,item.coverMediaId,item.coverUrl,item.metadata,now(),item.id).run();
    else await db.prepare(`INSERT INTO projects (id,slug,type,status,title,summary,body_markdown,start_date,end_date,location,participants,editor,cover_media_id,cover_url,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(item.id,item.slug,item.type,item.status,item.title,item.summary,item.body,item.startDate,item.endDate,item.location,item.participants,item.editor,item.coverMediaId,item.coverUrl,item.metadata).run();
    await replaceProjectRelations(db,item.id,payload.relations); return hydrateProject(db,await db.prepare(`SELECT * FROM projects WHERE id=?`).bind(item.id).first());
  }
  const pageId=cleanText(id||payload.id||makeId('page'),120), slug=cleanSlug(payload.slug), title=cleanText(payload.title,300), status=allowed(payload.status,['draft','published','archived'],'draft');
  if(!validId(pageId)||!validSlug(slug)||!title) throw Object.assign(new Error('Title and a valid slug are required'),{status:400,code:'validation_error'});
  const existing=await db.prepare(`SELECT * FROM pages WHERE id=?`).bind(pageId).first(); if(existing&&expectedVersion(request,payload.version)!==Number(existing.version)) return conflict();
  if(existing) await db.prepare(`UPDATE pages SET slug=?,title=?,body_markdown=?,status=?,seo_title=?,seo_description=?,version=version+1,updated_at=? WHERE id=?`).bind(slug,title,String(payload.bodyMarkdown||''),status,cleanText(payload.seoTitle,300),cleanText(payload.seoDescription,1000),now(),pageId).run();
  else await db.prepare(`INSERT INTO pages (id,slug,title,body_markdown,status,seo_title,seo_description) VALUES (?,?,?,?,?,?,?)`).bind(pageId,slug,title,String(payload.bodyMarkdown||''),status,cleanText(payload.seoTitle,300),cleanText(payload.seoDescription,1000)).run();
  return await db.prepare(`SELECT id,slug,title,body_markdown AS bodyMarkdown,status,seo_title AS seoTitle,seo_description AS seoDescription,version,updated_at AS updatedAt FROM pages WHERE id=?`).bind(pageId).first();
};

const mediaUpload = async (context, db, session) => {
  const bucket=context.env.MEDIA_BUCKET; if(!bucket) return failure(503,'media_unavailable','R2 media binding is missing');
  const form=await context.request.formData(); const file=form.get('file'); if(!(file instanceof File)||!file.size) return failure(400,'validation_error','Choose a file to upload');
  if(file.size>25*1024*1024) return failure(413,'payload_too_large','File exceeds 25 MB');
  const safeName=file.name.normalize('NFKC').replace(/[^\p{L}\p{N}._-]+/gu,'-').replace(/^-+|-+$/g,'').slice(-180)||'upload';
  const key=`media/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}-${safeName}`;
  const object=await bucket.put(key,file,{httpMetadata:{contentType:file.type||'application/octet-stream'},customMetadata:{uploadedBy:session.login}});
  const id=makeId('media'), publicUrl=`/media/${key}`;
  await db.prepare(`INSERT INTO media (id,filename,mime_type,size_bytes,title,alt_text,caption,creator,source,license,r2_key,public_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,file.name,file.type||'application/octet-stream',file.size,cleanText(form.get('title'),300),cleanText(form.get('altText'),500),cleanText(form.get('caption'),2000),cleanText(form.get('creator'),500),cleanText(form.get('source'),1000),cleanText(form.get('license'),500),key,publicUrl).run();
  return json({item:{id,filename:file.name,mimeType:file.type,sizeBytes:file.size,r2Key:key,publicUrl,etag:object?.httpEtag||''}},201);
};

const archiveResource = async (db, table, id) => {
  const result = await db.prepare(`UPDATE ${table} SET status='archived',version=version+1,updated_at=? WHERE id=?`).bind(now(),id).run();
  return Number(result.meta?.changes || 0) ? json({archived:true}) : failure(404,'not_found','Item not found');
};

const purgeResource = async (db, resource, id) => {
  const table = resource;
  const item = await db.prepare(`SELECT id,status FROM ${table} WHERE id=?`).bind(id).first();
  if (!item) return failure(404,'not_found','Item not found');
  if (item.status !== 'archived') return failure(409,'archive_required','Archive the item before permanently deleting it');
  const statements = [];
  if (resource === 'articles') statements.push(
    db.prepare(`DELETE FROM article_translations WHERE article_id=? OR translation_article_id=?`).bind(id,id),
    db.prepare(`DELETE FROM research_sections WHERE article_id=?`).bind(id),
    db.prepare(`DELETE FROM research_notes WHERE article_id=?`).bind(id),
    db.prepare(`DELETE FROM article_authors WHERE article_id=?`).bind(id),
    db.prepare(`DELETE FROM article_tags WHERE article_id=?`).bind(id),
    db.prepare(`DELETE FROM collection_articles WHERE article_id=?`).bind(id),
    db.prepare(`DELETE FROM article_revisions WHERE article_id=?`).bind(id),
    db.prepare(`DELETE FROM project_relations WHERE relation_type IN ('article','translation') AND target_id=?`).bind(id),
  );
  if (resource === 'collections') statements.push(
    db.prepare(`DELETE FROM collection_articles WHERE collection_id=?`).bind(id),
    db.prepare(`DELETE FROM project_relations WHERE relation_type='collection' AND target_id=?`).bind(id),
  );
  if (resource === 'projects') statements.push(db.prepare(`DELETE FROM project_relations WHERE project_id=?`).bind(id));
  statements.push(
    db.prepare(`DELETE FROM media_relations WHERE owner_type=? AND owner_id=?`).bind(resource === 'collections' ? 'collection' : resource.slice(0,-1), id),
    db.prepare(`DELETE FROM ${table} WHERE id=?`).bind(id),
  );
  await db.batch(statements);
  return json({deleted:true});
};

export const onRequest = handle(async (context) => {
  const parts=pathParts(context.params), resource=parts[0]||'session', id=parts[1], action=parts[2];
  if(resource==='session'&&context.request.method==='GET'){const session=await readSession(context.request,context.env);return session?json({authenticated:true,user:session}):json({authenticated:false},401);}
  if(resource==='logout'&&context.request.method==='POST'){const secure=new URL(context.request.url).protocol==='https:'?'; Secure':'';return json({ok:true},200,{'Set-Cookie':`crivu_admin=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`});}
  const session=await requireAdmin(context), db=requireDb(context.env), method=context.request.method, url=new URL(context.request.url);

  if(resource==='articles'){
    if(method==='GET'&&!id)return json({items:await listArticles(db,url)});
    if(method==='POST'&&!id){const item=await createArticle(db,await parseJson(context.request),session);return json({item},201,etag(item.version));}
    if(method==='GET'&&id){const row=await db.prepare(`SELECT * FROM articles WHERE id=?`).bind(id).first();return row?json({item:await hydrateArticle(db,row)},200,etag(row.version)):failure(404,'not_found','Article not found');}
    if(method==='PUT'&&id){const result=await updateArticle(db,id,await parseJson(context.request),context.request,session);if(result instanceof Response)return result;return result?json({item:result},200,etag(result.version)):failure(404,'not_found','Article not found');}
    if(method==='POST'&&id&&action==='restore'){const payload=await parseJson(context.request),item=await restoreArticle(db,id,payload.revisionId,session);return item?json({item},200,etag(item.version)):failure(404,'not_found','Revision not found');}
    if(method==='DELETE'&&id&&action==='purge')return purgeResource(db,'articles',id);
    if(method==='DELETE'&&id)return archiveResource(db,'articles',id);
  }

  if(['collections','projects','pages'].includes(resource)){
    const table=resource;
    if(method==='GET'&&!id){const result=await db.prepare(`SELECT * FROM ${table} ORDER BY updated_at DESC LIMIT 300`).all();const items=resource==='collections'?await Promise.all(rows(result).map(row=>hydrateCollection(db,row))):resource==='projects'?await Promise.all(rows(result).map(row=>hydrateProject(db,row))):rows(result).map(row=>({id:row.id,slug:row.slug,title:row.title,bodyMarkdown:row.body_markdown,status:row.status,seoTitle:row.seo_title||'',seoDescription:row.seo_description||'',version:row.version,updatedAt:row.updated_at}));return json({items});}
    if(method==='GET'&&id){const row=await db.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first();if(!row)return failure(404,'not_found','Item not found');return json({item:resource==='collections'?await hydrateCollection(db,row):resource==='projects'?await hydrateProject(db,row):{id:row.id,slug:row.slug,title:row.title,bodyMarkdown:row.body_markdown,status:row.status,seoTitle:row.seo_title||'',seoDescription:row.seo_description||'',version:row.version,updatedAt:row.updated_at}},200,etag(row.version));}
    if((method==='POST'&&!id)||(method==='PUT'&&id)){const item=await upsertSimpleResource(db,resource,id,await parseJson(context.request),context.request);if(item instanceof Response)return item;return json({item},method==='POST'?201:200,etag(item.version));}
    if(method==='DELETE'&&id&&action==='purge')return purgeResource(db,resource,id);
    if(method==='DELETE'&&id)return archiveResource(db,table,id);
  }

  if(resource==='settings'){
    if(method==='GET'){const result=await db.prepare(`SELECT key,value_json AS valueJson,is_public AS isPublic,updated_at AS updatedAt FROM site_settings ORDER BY key`).all();return json({settings:Object.fromEntries(rows(result).map(row=>[row.key,{value:safeJson(row.valueJson,null),isPublic:Boolean(row.isPublic),updatedAt:row.updatedAt}]))});}
    if(method==='PUT'){const payload=await parseJson(context.request),entries=Object.entries(payload.settings||{});await db.batch(entries.map(([key,item])=>db.prepare(`INSERT INTO site_settings (key,value_json,is_public,updated_at) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,is_public=excluded.is_public,updated_at=excluded.updated_at`).bind(cleanText(key,120),JSON.stringify(item?.value??item),item?.isPublic===false?0:1,now())));return json({saved:entries.length});}
  }

  if(resource==='media'){
    if(method==='GET'&&!id){const result=await db.prepare(`SELECT id,filename,mime_type AS mimeType,size_bytes AS sizeBytes,width,height,duration_seconds AS durationSeconds,title,alt_text AS altText,caption,creator,period,source,license,r2_key AS r2Key,public_url AS publicUrl,created_at AS createdAt FROM media ORDER BY created_at DESC LIMIT 300`).all();return json({items:rows(result)});}
    if(method==='POST'&&!id)return mediaUpload(context,db,session);
    if(method==='PUT'&&id){const p=await parseJson(context.request);await db.prepare(`UPDATE media SET title=?,alt_text=?,caption=?,creator=?,period=?,source=?,license=?,updated_at=? WHERE id=?`).bind(cleanText(p.title,300),cleanText(p.altText,500),cleanText(p.caption,2000),cleanText(p.creator,500),cleanText(p.period,200),cleanText(p.source,1000),cleanText(p.license,500),now(),id).run();return json({saved:true});}
    if(method==='DELETE'&&id){const refs=await db.prepare(`SELECT COUNT(*) AS count FROM media_relations WHERE media_id=?`).bind(id).first();if(Number(refs?.count||0))return failure(409,'media_in_use','Media is still referenced');const item=await db.prepare(`SELECT r2_key FROM media WHERE id=?`).bind(id).first();if(!item)return failure(404,'not_found','Media not found');await context.env.MEDIA_BUCKET?.delete(item.r2_key);await db.prepare(`DELETE FROM media WHERE id=?`).bind(id).run();return json({deleted:true});}
  }

  if(resource==='guestbook'){
    if(method==='GET'){const status=url.searchParams.get('status');const result=status&&status!=='all'?await db.prepare(`SELECT * FROM guestbook_entries WHERE status=? ORDER BY created_at DESC LIMIT 300`).bind(status).all():await db.prepare(`SELECT * FROM guestbook_entries ORDER BY created_at DESC LIMIT 300`).all();return json({items:rows(result).map(serializeGuestbook)});}
    if(method==='POST'&&!id){const p=await parseJson(context.request),authorName=cleanText(p.authorName,32),body=cleanText(p.body,1200);if(!authorName||!body)throw Object.assign(new Error('Name and message are required'),{status:400,code:'validation_error'});const status=allowed(p.status,['pending','approved','hidden','spam'],'approved'),createdAt=timestamp(p.createdAt)||now(),approvedAt=status==='approved'?now():null,itemId=validId(p.id)?cleanText(p.id,120):makeId('guestbook');await db.prepare(`INSERT INTO guestbook_entries (id,author_name,body,status,source,admin_reply,created_at,updated_at,approved_at) VALUES (?,?,?,?,?,?,?,?,?)`).bind(itemId,authorName,body,status,'admin',cleanText(p.adminReply,1200),createdAt,now(),approvedAt).run();return json({item:serializeGuestbook(await db.prepare('SELECT * FROM guestbook_entries WHERE id=?').bind(itemId).first())},201);}
    if(method==='PATCH'&&id){const p=await parseJson(context.request),existing=await db.prepare(`SELECT author_name,body,status,admin_reply,created_at FROM guestbook_entries WHERE id=?`).bind(id).first();if(!existing)return failure(404,'not_found','Guestbook entry not found');const authorName=p.authorName===undefined?existing.author_name:cleanText(p.authorName,32),body=p.body===undefined?existing.body:cleanText(p.body,1200),status=allowed(p.status,['pending','approved','hidden','spam'],existing.status||'pending'),adminReply=p.adminReply===undefined?(existing.admin_reply||''):cleanText(p.adminReply,1200),createdAt=Object.prototype.hasOwnProperty.call(p,'createdAt')?timestamp(p.createdAt):null;if(!authorName||!body)throw Object.assign(new Error('Name and message are required'),{status:400,code:'validation_error'});await db.prepare(`UPDATE guestbook_entries SET author_name=?,body=?,status=?,admin_reply=?,created_at=COALESCE(?,created_at),approved_at=CASE WHEN ?='approved' THEN COALESCE(approved_at,?) ELSE approved_at END,updated_at=? WHERE id=?`).bind(authorName,body,status,adminReply,createdAt,status,now(),now(),id).run();return json({saved:true});}
    if(method==='DELETE'&&id){await db.prepare(`DELETE FROM guestbook_entries WHERE id=?`).bind(id).run();return json({deleted:true});}
  }
  return failure(404,'not_found','Admin endpoint not found');
});
