const app = document.querySelector('#app');

const state = {
  resource: 'articles', items: [], current: null, articles: [], dirty: false,
  saving: false, saveQueued: false, autosave: 0, changeToken: 0,
};

const resources = [
  ['articles','文章'],['collections','期刊／合集'],['projects','專題紀錄'],['pages','頁面'],
  ['media','媒體庫'],['guestbook','留言板'],['settings','設定'],
];
const statusNames = {
  draft:'草稿', review:'審閱', scheduled:'排程', published:'已發布', archived:'已封存',
  pending:'待審核', approved:'已通過', hidden:'已隱藏', spam:'垃圾',
};

const escapeHtml = (value='') => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const field = (name) => document.querySelector(`[name="${name}"]`);
const value = (name) => field(name)?.type === 'checkbox' ? field(name).checked : field(name)?.value || '';
const lines = (input) => String(input||'').split('\n').map((item)=>item.trim()).filter(Boolean);
const statusName = (status) => statusNames[status] || status || '未設定';
const notify = (message,error=false) => { const element=document.querySelector('[data-status]'); if(element){element.textContent=message;element.classList.toggle('error',error);} };
const slugify = (input) => String(input||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
const discardChanges = () => !state.dirty || confirm('尚未儲存的修改會遺失，繼續嗎？');

const api = async (path, options={}) => {
  const response = await fetch(`/api/v1/admin/${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? {'Content-Type':'application/json'} : {}),
      ...(options.headers||{}),
    },
  });
  const data = await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error?.message || '操作失敗');
  return data;
};

const shanghaiParts = (date) => Object.fromEntries(
  new Intl.DateTimeFormat('en', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
    .formatToParts(date).map((part)=>[part.type,part.value])
);
const toDateTimeLocal = (input) => {
  const raw=String(input||'').trim();
  if(!raw)return '';
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return `${raw}T00:00`;
  if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(raw))return raw.slice(0,16);
  const parsed=new Date(raw);if(Number.isNaN(parsed.getTime()))return '';
  const parts=shanghaiParts(parsed);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};
const toIso = (input) => {
  const raw=String(input||'').trim();if(!raw)return '';
  const parsed=new Date(`${raw.length===16?`${raw}:00`:raw}+08:00`);
  if(Number.isNaN(parsed.getTime()))throw new Error('日期或時間格式不正確');
  return parsed.toISOString();
};
const displayDate = (input, includeTime=false) => {
  const raw=String(input||'').trim();if(!raw)return '未設定';
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;
  const parsed=new Date(raw);if(Number.isNaN(parsed.getTime()))return raw.slice(0,16).replace('T',' ');
  const parts=shanghaiParts(parsed);
  return `${parts.year}-${parts.month}-${parts.day}${includeTime?` ${parts.hour}:${parts.minute}`:''}`;
};

window.addEventListener('beforeunload',(event)=>{if(state.dirty){event.preventDefault();event.returnValue='';}});

const inlineMarkdown = (source) => escapeHtml(source).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>');
const previewImageUrl = (source) => {try{const parsed=new URL(String(source||'').trim(),location.origin);return ['http:','https:'].includes(parsed.protocol)?parsed.href:'';}catch{return '';}};
const markdown = (source) => String(source||'').replace(/\r\n/g,'\n').split(/\n{2,}/).map((block)=>{
  const text=block.trim();if(!text)return'';
  const image=text.match(/^!\[(.*?)\]\((.*?)\)$/);if(image){const src=previewImageUrl(image[2]);return src?`<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(image[1])}"/>${image[1]?`<figcaption>${escapeHtml(image[1])}</figcaption>`:''}</figure>`:'';}
  const heading=text.match(/^(#{1,3})\s+(.+)$/);if(heading){const level=heading[1].length;return`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`;}
  if(text.split('\n').every((line)=>/^>\s?/.test(line)))return`<blockquote>${text.split('\n').map((line)=>`<p>${inlineMarkdown(line.replace(/^>\s?/,''))}</p>`).join('')}</blockquote>`;
  return`<p>${text.split('\n').map(inlineMarkdown).join('<br/>')}</p>`;
}).join('');
const renderPreview = () => {
  const preview=document.querySelector('[data-preview]');if(!preview)return;
  const title=value('title')||'未命名',body=value('bodyMarkdown');
  preview.innerHTML=`<article><p class="preview-meta">${escapeHtml(value('type')||state.resource)}</p><h1>${escapeHtml(title)}</h1>${value('summary')?`<p class="preview-deck">${escapeHtml(value('summary'))}</p>`:''}<div class="preview-body">${value('metadataFormat')==='html'?body:markdown(body)}</div></article>`;
};
const label = (text,name,control,hint='') => `<label class="field"><span>${text}</span>${control}${hint?`<small>${hint}</small>`:''}</label>`;
const input = (name,val='',type='text',attrs='') => `<input name="${name}" type="${type}" value="${escapeHtml(val)}" ${attrs}/>`;
const textarea = (name,val='',rows=5,attrs='') => `<textarea name="${name}" rows="${rows}" ${attrs}>${escapeHtml(val)}</textarea>`;
const select = (name,val,options) => `<select name="${name}">${options.map(([option,text])=>`<option value="${option}" ${option===val?'selected':''}>${text}</option>`).join('')}</select>`;

const shell = (user) => {
  app.innerHTML=`<div class="admin-shell"><aside class="sidebar"><a class="brand" href="/articles" target="_blank">CRIVU</a><nav>${resources.map(([id,name])=>`<button data-nav="${id}">${name}</button>`).join('')}</nav><div class="user"><span>${escapeHtml(user.name||user.login)}</span><button data-logout>登出</button></div></aside><main class="workspace"><header class="topbar"><div><h1 data-heading>文章</h1><p data-status>已連線</p></div><div class="top-actions"><button class="danger" data-purge hidden>永久刪除</button><button data-archive hidden>移到封存</button><button data-new>新增</button><button class="primary" data-save hidden>儲存</button></div></header><div class="surface" data-surface></div></main></div>`;
  document.querySelectorAll('[data-nav]').forEach((button)=>button.addEventListener('click',()=>openResource(button.dataset.nav)));
  document.querySelector('[data-new]').addEventListener('click',newItem);
  document.querySelector('[data-save]').addEventListener('click',()=>saveCurrent(false));
  document.querySelector('[data-archive]').addEventListener('click',archiveCurrent);
  document.querySelector('[data-purge]').addEventListener('click',purgeCurrent);
  document.querySelector('[data-logout]').addEventListener('click',async()=>{await api('logout',{method:'POST'});location.reload();});
};

const resetTopActions = () => {
  document.querySelector('[data-save]').hidden=true;
  document.querySelector('[data-archive]').hidden=true;
  document.querySelector('[data-purge]').hidden=true;
};
const configureTopActions = (item) => {
  const manageable=['articles','collections','projects','pages'].includes(state.resource)&&item?.id;
  document.querySelector('[data-save]').hidden=false;
  document.querySelector('[data-archive]').hidden=!manageable||item.status==='archived';
  document.querySelector('[data-purge]').hidden=!manageable||item.status!=='archived';
};

const listTitle = (item) => item.title || item.filename || item.authorName || item.key || item.slug || item.id;
const listExcerpt = (item) => item.body || item.summary || item.theme || item.editorNote || item.seoDescription || item.filename || '';
const listMeta = (item) => {
  if(state.resource==='articles')return `${statusName(item.status)} · ${item.type==='research'?'研究':item.type==='script'?'劇本':'一般'} · 發布 ${displayDate(item.publishedAt)}`;
  if(state.resource==='collections')return `${statusName(item.status)} · ${item.type==='journal_issue'?'期刊':'合集'} · 發布 ${displayDate(item.publishedAt)}`;
  if(state.resource==='projects')return `${statusName(item.status)} · ${item.startDate||'未設定日期'}`;
  if(state.resource==='pages')return `${statusName(item.status)} · /${item.slug||''}`;
  return statusName(item.status||item.type||item.createdAt);
};
const searchable = (item) => [listTitle(item),listExcerpt(item),item.status,item.slug,item.authorName,item.createdAt].filter(Boolean).join(' ').toLowerCase();

const renderStandardRows = () => state.items.map((item,index)=>`<article class="content-row" data-list-item data-search="${escapeHtml(searchable(item))}" data-status="${escapeHtml(item.status||'')}"><button class="row-main" data-open-index="${index}"><span class="row-copy"><strong>${escapeHtml(listTitle(item))}</strong><small>${escapeHtml(listMeta(item))}</small>${listExcerpt(item)?`<span class="row-excerpt">${escapeHtml(listExcerpt(item))}</span>`:''}</span><time>${escapeHtml(displayDate(item.updatedAt||item.createdAt))}</time></button></article>`).join('');
const renderGuestbookRows = () => state.items.map((item,index)=>`<article class="comment-row" data-list-item data-search="${escapeHtml(searchable(item))}" data-status="${escapeHtml(item.status||'')}"><header><div><strong>${escapeHtml(item.authorName||'讀者')}</strong><span class="status status--${escapeHtml(item.status)}">${escapeHtml(statusName(item.status))}</span></div><time>${escapeHtml(displayDate(item.createdAt,true))}</time></header><p>${escapeHtml(item.body)}</p>${item.adminReply?`<blockquote><strong>管理員回覆</strong>${escapeHtml(item.adminReply)}</blockquote>`:''}<div class="comment-actions"><button data-comment-status="approved" data-index="${index}">通過</button><button data-comment-status="hidden" data-index="${index}">隱藏</button><button data-comment-status="spam" data-index="${index}">垃圾</button><button data-comment-edit data-index="${index}">回覆／編輯</button><button class="danger-link" data-comment-delete data-index="${index}">刪除</button></div></article>`).join('');

const renderList = () => {
  const surface=document.querySelector('[data-surface]');
  if(state.resource==='media'){renderMedia(surface);return;}
  const statuses=[...new Set(state.items.map((item)=>item.status).filter(Boolean))];
  const rows=(state.resource==='guestbook'?renderGuestbookRows():renderStandardRows())||'<p class="empty">暫無內容</p>';
  surface.innerHTML=`<div class="list"><div class="list-head"><input type="search" placeholder="搜尋標題、內容或作者" data-list-search/><select data-list-status><option value="">全部狀態</option>${statuses.map((status)=>`<option value="${escapeHtml(status)}">${escapeHtml(statusName(status))}</option>`).join('')}</select></div><div data-list-rows>${rows}</div></div>`;
  surface.querySelectorAll('[data-open-index]').forEach((button)=>button.addEventListener('click',()=>editItem(state.items[Number(button.dataset.openIndex)].id)));
  surface.querySelectorAll('[data-comment-edit]').forEach((button)=>button.addEventListener('click',()=>editItem(state.items[Number(button.dataset.index)].id)));
  surface.querySelectorAll('[data-comment-status]').forEach((button)=>button.addEventListener('click',()=>quickUpdateComment(Number(button.dataset.index),button.dataset.commentStatus)));
  surface.querySelectorAll('[data-comment-delete]').forEach((button)=>button.addEventListener('click',()=>deleteComment(Number(button.dataset.index))));
  const applyFilters=()=>{const query=surface.querySelector('[data-list-search]').value.trim().toLowerCase(),status=surface.querySelector('[data-list-status]').value;surface.querySelectorAll('[data-list-item]').forEach((row)=>{row.hidden=Boolean((query&&!row.dataset.search.includes(query))||(status&&row.dataset.status!==status));});};
  surface.querySelector('[data-list-search]').addEventListener('input',applyFilters);
  surface.querySelector('[data-list-status]').addEventListener('change',applyFilters);
};

const openResource = async (resource) => {
  if(state.resource!==resource&&!discardChanges())return;
  state.resource=resource;state.current=null;state.dirty=false;resetTopActions();
  document.querySelectorAll('[data-nav]').forEach((item)=>item.classList.toggle('active',item.dataset.nav===resource));
  document.querySelector('[data-heading]').textContent=resources.find(([id])=>id===resource)?.[1]||resource;
  document.querySelector('[data-new]').hidden=['settings','guestbook'].includes(resource);
  notify('載入中…');
  try{
    const data=await api(resource);
    if(resource==='settings'){renderSettings(data.settings||{});return;}
    state.items=data.items||[];if(resource==='articles')state.articles=state.items;
    renderList();notify(`${state.items.length} 項`);
  }catch(error){document.querySelector('[data-surface]').innerHTML=`<div class="empty error">${escapeHtml(error.message)}</div>`;notify(error.message,true);}
};

const newItem = () => {
  if(!discardChanges())return;
  const defaults={articles:{type:'general',status:'draft',language:'zh-Hant',tags:[],metadata:{}},collections:{type:'collection',status:'draft',articleIds:[]},projects:{type:'project',status:'draft',relations:[]},pages:{status:'draft'}};
  state.current=defaults[state.resource]||{};renderEditor();
};
const editItem = async (id) => {
  if(state.resource==='guestbook'){state.current=state.items.find((item)=>item.id===id);renderGuestbookEditor();return;}
  notify('載入中…');
  try{state.current=(await api(`${state.resource}/${encodeURIComponent(id)}`)).item;renderEditor();notify('已載入');}catch(error){notify(error.message,true);}
};

const publishFields = (item, scheduling=false) => `<section class="publish-panel"><h2>發布設定</h2><div class="form-row">${label('顯示的發布時間','publishedAt',input('publishedAt',toDateTimeLocal(item.publishedAt),'datetime-local'),'按北京時間顯示，用於前台日期與排序。')}${scheduling?label('定時上線時間','scheduledAt',input('scheduledAt',toDateTimeLocal(item.scheduledAt),'datetime-local'),'狀態選「排程」後，網站會在此時間自動公開。'):''}</div></section>`;
const articleForm = (item) => `<div class="editor-grid"><form class="form" data-form><div class="form-row">${label('內容類型','type',select('type',item.type||'general',[['general','一般文章'],['research','研究文章'],['script','劇本']]))}${label('狀態','status',select('status',item.status||'draft',[['draft','草稿'],['review','審閱'],['scheduled','排程'],['published','已發布'],['archived','封存']]))}</div>${publishFields(item,true)}${label('標題','title',input('title',item.title,'text','required'))}${label('副標題','subtitle',input('subtitle',item.subtitle))}<div class="form-row">${label('Slug','slug',input('slug',item.slug,'text','pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required'))}${label('語言','language',input('language',item.language||'zh-Hant'))}</div>${label('摘要','summary',textarea('summary',item.summary,3))}<div class="editor-toolbar"><button type="button" data-wrap="**">粗體</button><button type="button" data-prefix="## ">標題</button><button type="button" data-prefix="> ">引用</button><button type="button" data-upload-image>上傳並插入圖片</button><input type="file" accept="image/*" data-image-file hidden/><button type="button" data-fullscreen>全螢幕</button></div>${label(item.type==='script'?'劇本文本':'正文','bodyMarkdown',textarea('bodyMarkdown',item.bodyMarkdown,22,'data-body'))}${label('標籤（每行一個）','tags',textarea('tags',(item.tags||[]).map((tag)=>tag.name||tag).join('\n'),4))}<details><summary>SEO 與進階資料</summary>${label('封面網址','coverUrl',input('coverUrl',item.coverUrl))}${label('SEO 標題','seoTitle',input('seoTitle',item.seoTitle))}${label('SEO 描述','seoDescription',textarea('seoDescription',item.seoDescription,3))}${label('Canonical','canonicalUrl',input('canonicalUrl',item.canonicalUrl))}${label('授權','license',input('license',item.license))}${label('進階資料 JSON','metadata',textarea('metadata',JSON.stringify(item.metadata||{},null,2),8))}</details>${item.revisions?.length?`<details><summary>修訂記錄</summary><div class="revisions">${item.revisions.map((revision)=>`<button type="button" data-restore="${revision.id}">版本 ${revision.version} · ${escapeHtml(displayDate(revision.createdAt,true))}</button>`).join('')}</div></details>`:''}</form><aside class="preview" data-preview></aside></div>`;
const collectionForm = (item) => `<form class="form single" data-form><div class="form-row">${label('類型','type',select('type',item.type||'collection',[['collection','主題合集'],['journal_issue','正式卷期']]))}${label('狀態','status',select('status',item.status||'draft',[['draft','草稿'],['published','已發布'],['archived','封存']]))}</div>${publishFields(item)}<div class="form-row">${label('ID','id',input('id',item.id,'text','required'))}${label('標題','title',input('title',item.title,'text','required'))}</div>${label('主題','theme',input('theme',item.theme))}${label('封面網址','coverUrl',input('coverUrl',item.coverUrl))}${label('編者語','editorNote',textarea('editorNote',item.editorNote,7))}<div class="form-row">${label('年份','year',input('year',item.year,'number'))}${label('卷號','volume',input('volume',item.volume))}</div>${label('期號','issueNumber',input('issueNumber',item.issueNumber))}${label('收錄文章順序','articleIds',`<div class="sortable" data-sortable>${(item.articleIds||[]).map((id)=>{const article=state.articles.find((candidate)=>candidate.id===id);return `<div draggable="true" data-id="${id}"><span>${escapeHtml(article?.title||id)}</span><button type="button" data-remove-id="${id}">移除</button></div>`;}).join('')}</div><select data-add-article><option value="">加入文章…</option>${state.articles.filter((article)=>!(item.articleIds||[]).includes(article.id)).map((article)=>`<option value="${article.id}">${escapeHtml(article.title)}</option>`).join('')}</select>`)}</form>`;
const projectForm = (item) => `<form class="form single" data-form><div class="form-row">${label('ID','id',input('id',item.id,'text','required'))}${label('Slug','slug',input('slug',item.slug,'text','required'))}</div><div class="form-row">${label('狀態','status',select('status',item.status||'draft',[['draft','草稿'],['published','已發布'],['archived','封存']]))}${label('類型','type',input('type',item.type||'project'))}</div>${label('標題','title',input('title',item.title,'text','required'))}${label('摘要','summary',textarea('summary',item.summary,4))}${label('正文','bodyMarkdown',textarea('bodyMarkdown',item.bodyMarkdown,16))}<div class="form-row">${label('開始日期','startDate',input('startDate',item.startDate,'date'))}${label('結束日期','endDate',input('endDate',item.endDate,'date'))}</div>${label('地點','location',input('location',item.location))}${label('參與者','participants',textarea('participants',item.participants,3))}${label('整理者','editor',input('editor',item.editor))}${label('封面網址','coverUrl',input('coverUrl',item.coverUrl))}${label('關聯資料 JSON','relations',textarea('relations',JSON.stringify(item.relations||[],null,2),9),'可關聯 article、translation、gallery、exhibition、collection、media。')}</form>`;
const pageForm = (item) => `<div class="editor-grid"><form class="form" data-form><div class="form-row">${label('標題','title',input('title',item.title,'text','required'))}${label('狀態','status',select('status',item.status||'draft',[['draft','草稿'],['published','已發布'],['archived','封存']]))}</div>${label('Slug','slug',input('slug',item.slug,'text','required'))}${label('正文','bodyMarkdown',textarea('bodyMarkdown',item.bodyMarkdown,22))}<details><summary>SEO</summary>${label('SEO 標題','seoTitle',input('seoTitle',item.seoTitle))}${label('SEO 描述','seoDescription',textarea('seoDescription',item.seoDescription,3))}</details></form><aside class="preview" data-preview></aside></div>`;

const renderEditor = async () => {
  if(state.resource==='collections'&&!state.articles.length)state.articles=(await api('articles')).items||[];
  const surface=document.querySelector('[data-surface]'),item=state.current;
  surface.innerHTML=state.resource==='articles'?articleForm(item):state.resource==='collections'?collectionForm(item):state.resource==='projects'?projectForm(item):pageForm(item);
  configureTopActions(item);state.dirty=false;
  const form=surface.querySelector('[data-form]');
  form.addEventListener('input',(event)=>{state.dirty=true;state.changeToken+=1;if(event.target.name==='title'&&!value('slug'))field('slug').value=slugify(event.target.value);renderPreview();scheduleAutosave();});
  form.addEventListener('change',()=>{state.dirty=true;state.changeToken+=1;renderPreview();scheduleAutosave();});
  surface.querySelectorAll('[data-wrap]').forEach((button)=>button.addEventListener('click',()=>editText(button.dataset.wrap,button.dataset.wrap)));
  surface.querySelectorAll('[data-prefix]').forEach((button)=>button.addEventListener('click',()=>editText(button.dataset.prefix,'')));
  surface.querySelector('[data-fullscreen]')?.addEventListener('click',()=>field('bodyMarkdown').classList.toggle('fullscreen'));
  surface.querySelector('[data-upload-image]')?.addEventListener('click',()=>surface.querySelector('[data-image-file]').click());
  surface.querySelector('[data-image-file]')?.addEventListener('change',(event)=>uploadAndInsertImage(event.target.files?.[0]));
  surface.querySelectorAll('[data-restore]').forEach((button)=>button.addEventListener('click',()=>restoreRevision(button.dataset.restore)));
  setupSortable();renderPreview();
};

const editText = (before,after) => {const element=field('bodyMarkdown');if(!element)return;const start=element.selectionStart,end=element.selectionEnd,selected=element.value.slice(start,end);element.setRangeText(`${before}${selected}${after}`,start,end,'end');element.dispatchEvent(new Event('input',{bubbles:true}));element.focus();};
const uploadAndInsertImage = async (file) => {
  if(!file)return;
  const button=document.querySelector('[data-upload-image]');button.disabled=true;notify('圖片上傳至 R2 中…');
  try{
    const form=new FormData();form.append('file',file);form.append('title',file.name);form.append('altText',file.name.replace(/\.[^.]+$/,''));
    const {item}=await api('media',{method:'POST',body:form});
    editText(`\n\n![${file.name.replace(/\.[^.]+$/,'')}](${item.publicUrl})\n\n`,'');notify('圖片已上傳並插入正文');
  }catch(error){notify(error.message,true);}finally{button.disabled=false;}
};
const setupSortable = () => {
  const list=document.querySelector('[data-sortable]');if(!list)return;let dragged;
  list.querySelectorAll('[draggable]').forEach((row)=>{row.addEventListener('dragstart',()=>dragged=row);row.addEventListener('dragover',(event)=>event.preventDefault());row.addEventListener('drop',(event)=>{event.preventDefault();if(dragged!==row){list.insertBefore(dragged,row);state.dirty=true;state.changeToken+=1;scheduleAutosave();}});});
  list.querySelectorAll('[data-remove-id]').forEach((button)=>button.addEventListener('click',()=>{button.closest('[data-id]').remove();state.dirty=true;state.changeToken+=1;scheduleAutosave();}));
  document.querySelector('[data-add-article]')?.addEventListener('change',async(event)=>{if(event.target.value){state.current.articleIds=[...document.querySelectorAll('[data-sortable] [data-id]')].map((row)=>row.dataset.id).concat(event.target.value);await renderEditor();state.dirty=true;state.changeToken+=1;scheduleAutosave();}});
};

const payload = () => {
  if(state.resource==='articles')return {type:value('type'),status:value('status'),title:value('title'),subtitle:value('subtitle'),slug:value('slug'),language:value('language'),summary:value('summary'),bodyMarkdown:value('bodyMarkdown'),tags:lines(value('tags')),coverUrl:value('coverUrl'),publishedAt:toIso(value('publishedAt')),scheduledAt:toIso(value('scheduledAt')),seoTitle:value('seoTitle'),seoDescription:value('seoDescription'),canonicalUrl:value('canonicalUrl'),license:value('license'),metadata:JSON.parse(value('metadata')||'{}'),version:state.current.version};
  if(state.resource==='collections')return {id:value('id'),type:value('type'),status:value('status'),title:value('title'),theme:value('theme'),coverUrl:value('coverUrl'),editorNote:value('editorNote'),year:value('year'),volume:value('volume'),issueNumber:value('issueNumber'),publishedAt:toIso(value('publishedAt')),articleIds:[...document.querySelectorAll('[data-sortable] [data-id]')].map((row)=>row.dataset.id),version:state.current.version};
  if(state.resource==='projects')return {id:value('id'),slug:value('slug'),type:value('type'),status:value('status'),title:value('title'),summary:value('summary'),bodyMarkdown:value('bodyMarkdown'),startDate:value('startDate'),endDate:value('endDate'),location:value('location'),participants:value('participants'),editor:value('editor'),coverUrl:value('coverUrl'),relations:JSON.parse(value('relations')||'[]'),version:state.current.version};
  return {title:value('title'),slug:value('slug'),status:value('status'),bodyMarkdown:value('bodyMarkdown'),seoTitle:value('seoTitle'),seoDescription:value('seoDescription'),version:state.current.version};
};
const saveCurrent = async (automatic) => {
  const form=document.querySelector('[data-form]');
  if(!state.dirty)return true;
  if(state.saving){state.saveQueued=true;if(!automatic)notify('正在完成上一筆儲存…');return false;}
  if(!form?.checkValidity()){if(!automatic)form?.reportValidity();return false;}
  if(state.resource==='articles'&&value('status')==='scheduled'&&!value('scheduledAt')){if(!automatic)notify('排程文章必須設定定時上線時間',true);return false;}
  state.saving=true;const token=state.changeToken;notify(automatic?'自動儲存中…':'儲存中…');
  try{
    const body=payload(),exists=Boolean(state.current.id),path=exists?`${state.resource}/${encodeURIComponent(state.current.id)}`:state.resource;
    const data=await api(path,{method:exists?'PUT':'POST',headers:exists?{'If-Match':String(state.current.version)}:{},body:JSON.stringify(body)});
    state.current=data.item;state.dirty=token!==state.changeToken;
    notify(state.dirty?'已儲存較早修改，正在保存最新修改…':automatic?'已自動儲存':'已儲存');
    if(!automatic&&!state.dirty)renderEditor();
    if(state.dirty)scheduleAutosave();
    return !state.dirty;
  }catch(error){notify(error.message,true);return false;}
  finally{state.saving=false;if(state.saveQueued&&state.dirty){state.saveQueued=false;setTimeout(()=>saveCurrent(false),0);}}
};
const scheduleAutosave = () => {clearTimeout(state.autosave);state.autosave=setTimeout(()=>{if(state.current?.id)saveCurrent(true);},1800);};

const archiveCurrent = async () => {
  if(!state.current?.id||!confirm(`將「${listTitle(state.current)}」移到封存？前台會立即隱藏。`))return;
  if(state.dirty&&!await saveCurrent(false))return;
  try{await api(`${state.resource}/${encodeURIComponent(state.current.id)}`,{method:'DELETE'});notify('已移到封存');await openResource(state.resource);}catch(error){notify(error.message,true);}
};
const purgeCurrent = async () => {
  if(!state.current?.id)return;
  const title=listTitle(state.current),confirmation=prompt(`永久刪除後無法復原。請輸入完整標題確認：\n${title}`);
  if(confirmation!==title){if(confirmation!==null)notify('標題不一致，已取消永久刪除',true);return;}
  try{await api(`${state.resource}/${encodeURIComponent(state.current.id)}/purge`,{method:'DELETE'});notify('已永久刪除');await openResource(state.resource);}catch(error){notify(error.message,true);}
};
const restoreRevision = async (revisionId) => {if(!confirm('恢復這個版本？目前內容會先保存在修訂記錄。'))return;try{state.current=(await api(`articles/${state.current.id}/restore`,{method:'POST',body:JSON.stringify({revisionId})})).item;renderEditor();notify('已恢復版本');}catch(error){notify(error.message,true);}};

const quickUpdateComment = async (index,status) => {const item=state.items[index];try{await api(`guestbook/${item.id}`,{method:'PATCH',body:JSON.stringify({status,adminReply:item.adminReply||''})});item.status=status;renderList();notify(`留言已設為${statusName(status)}`);}catch(error){notify(error.message,true);}};
const deleteComment = async (index) => {const item=state.items[index];if(!confirm(`永久刪除 ${item.authorName||'讀者'} 的這則留言？`))return;try{await api(`guestbook/${item.id}`,{method:'DELETE'});state.items.splice(index,1);renderList();notify('留言已刪除');}catch(error){notify(error.message,true);}};
const renderGuestbookEditor = () => {const item=state.current;resetTopActions();document.querySelector('[data-surface]').innerHTML=`<form class="form single" data-guestbook><h2>${escapeHtml(item.authorName)}</h2><p class="message">${escapeHtml(item.body)}</p>${label('狀態','status',select('status',item.status,[['pending','待審核'],['approved','通過'],['hidden','隱藏'],['spam','垃圾']]))}${label('管理員回覆','adminReply',textarea('adminReply',item.adminReply,5))}<div class="inline-actions"><button type="button" data-back>返回列表</button><button class="primary">儲存</button></div></form>`;document.querySelector('[data-back]').addEventListener('click',()=>openResource('guestbook'));document.querySelector('[data-guestbook]').addEventListener('submit',async(event)=>{event.preventDefault();await api(`guestbook/${item.id}`,{method:'PATCH',body:JSON.stringify({status:value('status'),adminReply:value('adminReply')})});await openResource('guestbook');});};

const renderMedia = (surface) => {surface.innerHTML=`<div class="media-layout"><form class="upload" data-upload><h2>上傳到 R2</h2><input type="file" name="file" required/><input name="title" placeholder="標題"/><input name="altText" placeholder="替代文字"/><button class="primary">上傳</button></form><div class="media-grid">${state.items.map((item)=>`<article><div class="media-thumb">${String(item.mimeType).startsWith('image/')?`<img src="${escapeHtml(item.publicUrl)}" alt="${escapeHtml(item.altText||'')}"/>`:'<span>檔案</span>'}</div><strong>${escapeHtml(item.title||item.filename)}</strong><small>${escapeHtml(item.mimeType)} · ${Math.round((item.sizeBytes||0)/1024)} KB</small><button data-copy="${escapeHtml(item.publicUrl)}">複製網址</button></article>`).join('')}</div></div>`;surface.querySelector('[data-upload]').addEventListener('submit',async(event)=>{event.preventDefault();notify('上傳中…');try{await api('media',{method:'POST',body:new FormData(event.target)});await openResource('media');}catch(error){notify(error.message,true);}});surface.querySelectorAll('[data-copy]').forEach((button)=>button.addEventListener('click',()=>navigator.clipboard.writeText(button.dataset.copy)));};
const renderSettings = (settings) => {const get=(key)=>settings[key]?.value??'';document.querySelector('[data-surface]').innerHTML=`<form class="form single" data-settings>${label('站名','siteName',input('siteName',get('siteName')))}${label('網站描述','siteDescription',textarea('siteDescription',get('siteDescription'),4))}${label('頁尾','footerText',input('footerText',get('footerText')))}${label('搜尋提示','searchPlaceholder',input('searchPlaceholder',get('searchPlaceholder')))}${label('導航 JSON','navigation',textarea('navigation',JSON.stringify(get('navigation')||[],null,2),9))}<button class="primary">儲存設定</button></form>`;document.querySelector('[data-settings]').addEventListener('submit',async(event)=>{event.preventDefault();await api('settings',{method:'PUT',body:JSON.stringify({settings:{siteName:{value:value('siteName')},siteDescription:{value:value('siteDescription')},footerText:{value:value('footerText')},searchPlaceholder:{value:value('searchPlaceholder')},navigation:{value:JSON.parse(value('navigation')||'[]')}}})});notify('設定已儲存');});notify('已載入設定');};

try{const session=await api('session');shell(session.user);await openResource('articles');}catch{app.innerHTML=`<main class="login"><div><a class="brand" href="/articles">CRIVU</a><h1>內容管理</h1><p>使用獲准的 GitHub 帳號登入。GitHub 只用於確認身分，內容不再寫入 GitHub。</p><a class="login-button" href="/api/auth?provider=github&returnTo=/admin/">使用 GitHub 登入</a></div></main>`;}
