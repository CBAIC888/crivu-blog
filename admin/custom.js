const app = document.querySelector('#app');
const state = { resource: 'articles', items: [], current: null, articles: [], dirty: false, saving: false, autosave: 0 };
const resources = [
  ['articles','文章'],['collections','期刊／合集'],['projects','專題紀錄'],['pages','頁面'],['media','媒體庫'],['guestbook','留言板'],['settings','設定'],
];
const escapeHtml = (v='') => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const api = async (path, options={}) => {
  const response = await fetch(`/api/v1/admin/${path}`, { ...options, headers: { ...(options.body && !(options.body instanceof FormData) ? {'Content-Type':'application/json'} : {}), ...(options.headers||{}) } });
  const data = await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error?.message || '操作失敗');
  return data;
};
const field = (name) => document.querySelector(`[name="${name}"]`);
const value = (name) => field(name)?.type === 'checkbox' ? field(name).checked : field(name)?.value || '';
const lines = (v) => String(v||'').split('\n').map(x=>x.trim()).filter(Boolean);
const notify = (message,error=false) => { const el=document.querySelector('[data-status]'); if(el){el.textContent=message;el.classList.toggle('error',error);} };
const slugify = (v) => String(v||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
const discardChanges = () => !state.dirty || confirm('尚未儲存的修改會遺失，繼續嗎？');
window.addEventListener('beforeunload',(event)=>{if(state.dirty){event.preventDefault();event.returnValue='';}});

const markdown = (source) => escapeHtml(source).replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>').replace(/^> (.+)$/gm,'<blockquote>$1</blockquote>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/\n{2,}/g,'</p><p>').replace(/^/,'<p>').replace(/$/,'</p>');
const renderPreview = () => {
  const preview=document.querySelector('[data-preview]'); if(!preview)return;
  const title=value('title')||'未命名'; const body=value('bodyMarkdown');
  preview.innerHTML=`<article><p class="preview-meta">${escapeHtml(value('type')||state.resource)}</p><h1>${escapeHtml(title)}</h1>${value('summary')?`<p class="preview-deck">${escapeHtml(value('summary'))}</p>`:''}<div class="preview-body">${value('metadataFormat')==='html'?body:markdown(body)}</div></article>`;
};
const label = (text,name,input,hint='') => `<label class="field"><span>${text}</span>${input}${hint?`<small>${hint}</small>`:''}</label>`;
const input = (name,val='',type='text',attrs='') => `<input name="${name}" type="${type}" value="${escapeHtml(val)}" ${attrs}/>`;
const textarea = (name,val='',rows=5,attrs='') => `<textarea name="${name}" rows="${rows}" ${attrs}>${escapeHtml(val)}</textarea>`;
const select = (name,val,options) => `<select name="${name}">${options.map(([v,t])=>`<option value="${v}" ${v===val?'selected':''}>${t}</option>`).join('')}</select>`;

const shell = (user) => {
  app.innerHTML=`<div class="admin-shell"><aside class="sidebar"><a class="brand" href="/articles" target="_blank">CRIVU</a><nav>${resources.map(([id,name])=>`<button data-nav="${id}">${name}</button>`).join('')}</nav><div class="user"><span>${escapeHtml(user.name||user.login)}</span><button data-logout>登出</button></div></aside><main class="workspace"><header class="topbar"><div><h1 data-heading>文章</h1><p data-status>已連線</p></div><div class="top-actions"><button data-new>新增</button><button class="primary" data-save hidden>儲存</button></div></header><div class="surface" data-surface></div></main></div>`;
  document.querySelectorAll('[data-nav]').forEach(button=>button.addEventListener('click',()=>openResource(button.dataset.nav)));
  document.querySelector('[data-new]').addEventListener('click',newItem);
  document.querySelector('[data-save]').addEventListener('click',()=>saveCurrent(false));
  document.querySelector('[data-logout]').addEventListener('click',async()=>{await api('logout',{method:'POST'});location.reload();});
};

const listTitle = (item) => item.title || item.filename || item.authorName || item.key || item.slug || item.id;
const openResource = async (resource) => {
  if(state.resource!==resource&&!discardChanges())return;
  state.resource=resource; state.current=null; state.dirty=false;
  document.querySelectorAll('[data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===resource));
  document.querySelector('[data-heading]').textContent=resources.find(x=>x[0]===resource)?.[1]||resource;
  document.querySelector('[data-new]').hidden=['settings','guestbook'].includes(resource);
  document.querySelector('[data-save]').hidden=true;
  notify('載入中…');
  try {
    const data=await api(resource);
    if(resource==='settings'){renderSettings(data.settings||{});return;}
    state.items=data.items||[];
    if(resource==='articles') state.articles=state.items;
    renderList(); notify(`${state.items.length} 項`);
  } catch(error){document.querySelector('[data-surface]').innerHTML=`<div class="empty error">${escapeHtml(error.message)}</div>`;notify(error.message,true);}
};
const renderList = () => {
  const surface=document.querySelector('[data-surface]');
  if(state.resource==='media'){renderMedia(surface);return;}
  surface.innerHTML=`<div class="list"><div class="list-head"><input type="search" placeholder="搜尋" data-list-search /></div><div data-list-rows>${state.items.map((item,index)=>`<button class="row" data-index="${index}"><span><strong>${escapeHtml(listTitle(item))}</strong><small>${escapeHtml(item.status||item.type||item.createdAt||'')}</small></span><time>${escapeHtml(String(item.updatedAt||item.createdAt||'').slice(0,10))}</time></button>`).join('')||'<p class="empty">暫無內容</p>'}</div></div>`;
  surface.querySelectorAll('[data-index]').forEach(button=>button.addEventListener('click',()=>editItem(state.items[Number(button.dataset.index)].id)));
  surface.querySelector('[data-list-search]').addEventListener('input',(event)=>{const q=event.target.value.toLowerCase();surface.querySelectorAll('[data-index]').forEach((row)=>row.hidden=!listTitle(state.items[Number(row.dataset.index)]).toLowerCase().includes(q));});
};

const newItem = () => {
  if(!discardChanges())return;
  const defaults={articles:{type:'general',status:'draft',language:'zh-Hant',tags:[],metadata:{}},collections:{type:'collection',status:'draft',articleIds:[]},projects:{type:'project',status:'draft',relations:[]},pages:{status:'draft'}};
  state.current=defaults[state.resource]||{}; renderEditor();
};
const editItem = async (id) => {
  if(state.resource==='guestbook'){state.current=state.items.find(x=>x.id===id);renderGuestbookEditor();return;}
  notify('載入中…'); try{state.current=(await api(`${state.resource}/${encodeURIComponent(id)}`)).item;renderEditor();notify('已載入');}catch(error){notify(error.message,true);}
};

const articleForm = (item) => `<div class="editor-grid"><form class="form" data-form>
  <div class="form-row">${label('內容類型','type',select('type',item.type||'general',[['general','一般文章'],['research','研究文章'],['script','劇本']]))}${label('狀態','status',select('status',item.status||'draft',[['draft','草稿'],['review','審閱'],['scheduled','排程'],['published','已發布'],['archived','封存']]))}</div>
  ${label('標題','title',input('title',item.title,'text','required'))}${label('副標題','subtitle',input('subtitle',item.subtitle))}
  <div class="form-row">${label('Slug','slug',input('slug',item.slug,'text','pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required'))}${label('語言','language',input('language',item.language||'zh-Hant'))}</div>
  ${label('摘要','summary',textarea('summary',item.summary,3))}
  <div class="editor-toolbar"><button type="button" data-wrap="**">粗體</button><button type="button" data-prefix="## ">標題</button><button type="button" data-prefix="> ">引用</button><button type="button" data-insert-media>插入媒體</button><button type="button" data-fullscreen>全螢幕</button></div>
  ${label(item.type==='script'?'劇本文本':'正文','bodyMarkdown',textarea('bodyMarkdown',item.bodyMarkdown,22,'data-body'))}
  ${label('標籤（每行一個）','tags',textarea('tags',(item.tags||[]).map(x=>x.name||x).join('\n'),4))}
  <details><summary>SEO 與進階資料</summary>${label('封面網址','coverUrl',input('coverUrl',item.coverUrl))}<div class="form-row">${label('發布時間','publishedAt',input('publishedAt',item.publishedAt,'datetime-local'))}${label('排程時間','scheduledAt',input('scheduledAt',item.scheduledAt,'datetime-local'))}</div>${label('SEO 標題','seoTitle',input('seoTitle',item.seoTitle))}${label('SEO 描述','seoDescription',textarea('seoDescription',item.seoDescription,3))}${label('Canonical','canonicalUrl',input('canonicalUrl',item.canonicalUrl))}${label('授權','license',input('license',item.license))}${label('進階資料 JSON','metadata',textarea('metadata',JSON.stringify(item.metadata||{},null,2),8))}</details>
  ${item.revisions?.length?`<details><summary>修訂記錄</summary><div class="revisions">${item.revisions.map(r=>`<button type="button" data-restore="${r.id}">版本 ${r.version} · ${escapeHtml(String(r.createdAt).slice(0,16))}</button>`).join('')}</div></details>`:''}
  </form><aside class="preview" data-preview></aside></div>`;
const collectionForm = (item) => `<form class="form single" data-form><div class="form-row">${label('類型','type',select('type',item.type||'collection',[['collection','主題合集'],['journal_issue','正式卷期']]))}${label('狀態','status',select('status',item.status||'draft',[['draft','草稿'],['published','已發布'],['archived','封存']]))}</div><div class="form-row">${label('ID','id',input('id',item.id,'text','required'))}${label('標題','title',input('title',item.title,'text','required'))}</div>${label('主題','theme',input('theme',item.theme))}${label('封面網址','coverUrl',input('coverUrl',item.coverUrl))}${label('編者語','editorNote',textarea('editorNote',item.editorNote,7))}<div class="form-row">${label('年份','year',input('year',item.year,'number'))}${label('卷號','volume',input('volume',item.volume))}${label('期號','issueNumber',input('issueNumber',item.issueNumber))}</div>${label('發布時間','publishedAt',input('publishedAt',item.publishedAt,'datetime-local'))}${label('收錄文章順序','articleIds',`<div class="sortable" data-sortable>${(item.articleIds||[]).map(id=>{const a=state.articles.find(x=>x.id===id);return `<div draggable="true" data-id="${id}"><span>${escapeHtml(a?.title||id)}</span><button type="button" data-remove-id="${id}">移除</button></div>`;}).join('')}</div><select data-add-article><option value="">加入文章…</option>${state.articles.filter(a=>!(item.articleIds||[]).includes(a.id)).map(a=>`<option value="${a.id}">${escapeHtml(a.title)}</option>`).join('')}</select>`)}</form>`;
const projectForm = (item) => `<form class="form single" data-form><div class="form-row">${label('ID','id',input('id',item.id,'text','required'))}${label('Slug','slug',input('slug',item.slug,'text','required'))}</div><div class="form-row">${label('狀態','status',select('status',item.status||'draft',[['draft','草稿'],['published','已發布'],['archived','封存']]))}${label('類型','type',input('type',item.type||'project'))}</div>${label('標題','title',input('title',item.title,'text','required'))}${label('摘要','summary',textarea('summary',item.summary,4))}${label('正文','bodyMarkdown',textarea('bodyMarkdown',item.bodyMarkdown,16))}<div class="form-row">${label('開始日期','startDate',input('startDate',item.startDate,'date'))}${label('結束日期','endDate',input('endDate',item.endDate,'date'))}</div>${label('地點','location',input('location',item.location))}${label('參與者','participants',textarea('participants',item.participants,3))}${label('整理者','editor',input('editor',item.editor))}${label('封面網址','coverUrl',input('coverUrl',item.coverUrl))}${label('關聯資料 JSON','relations',textarea('relations',JSON.stringify(item.relations||[],null,2),9),'可關聯 article、translation、gallery、exhibition、collection、media。')}</form>`;
const pageForm = (item) => `<div class="editor-grid"><form class="form" data-form><div class="form-row">${label('標題','title',input('title',item.title,'text','required'))}${label('狀態','status',select('status',item.status||'draft',[['draft','草稿'],['published','已發布'],['archived','封存']]))}</div>${label('Slug','slug',input('slug',item.slug,'text','required'))}${label('正文','bodyMarkdown',textarea('bodyMarkdown',item.bodyMarkdown,22))}<details><summary>SEO</summary>${label('SEO 標題','seoTitle',input('seoTitle',item.seoTitle))}${label('SEO 描述','seoDescription',textarea('seoDescription',item.seoDescription,3))}</details></form><aside class="preview" data-preview></aside></div>`;

const renderEditor = async () => {
  if(state.resource==='collections'&&!state.articles.length){state.articles=(await api('articles')).items||[];}
  const surface=document.querySelector('[data-surface]'),item=state.current;
  surface.innerHTML=state.resource==='articles'?articleForm(item):state.resource==='collections'?collectionForm(item):state.resource==='projects'?projectForm(item):pageForm(item);
  document.querySelector('[data-save]').hidden=false; state.dirty=false;
  const formEl=surface.querySelector('[data-form]'); formEl.addEventListener('input',(event)=>{state.dirty=true;if(event.target.name==='title'&&!value('slug'))field('slug').value=slugify(event.target.value);renderPreview();scheduleAutosave();});
  formEl.addEventListener('change',()=>{state.dirty=true;renderPreview();scheduleAutosave();});
  surface.querySelectorAll('[data-wrap]').forEach(b=>b.addEventListener('click',()=>editText(b.dataset.wrap,b.dataset.wrap)));
  surface.querySelectorAll('[data-prefix]').forEach(b=>b.addEventListener('click',()=>editText(b.dataset.prefix,'')));
  surface.querySelector('[data-fullscreen]')?.addEventListener('click',()=>field('bodyMarkdown').classList.toggle('fullscreen'));
  surface.querySelector('[data-insert-media]')?.addEventListener('click',()=>{const url=prompt('輸入媒體網址');if(url)editText(`![](${url})`,'');});
  surface.querySelectorAll('[data-restore]').forEach(b=>b.addEventListener('click',()=>restoreRevision(b.dataset.restore)));
  setupSortable(); renderPreview();
};
const editText = (before,after) => {const el=field('bodyMarkdown');if(!el)return;const start=el.selectionStart,end=el.selectionEnd,selected=el.value.slice(start,end);el.setRangeText(`${before}${selected}${after}`,start,end,'end');el.dispatchEvent(new Event('input',{bubbles:true}));el.focus();};
const setupSortable = () => {
  const list=document.querySelector('[data-sortable]'); if(!list)return; let dragged;
  list.querySelectorAll('[draggable]').forEach(row=>{row.addEventListener('dragstart',()=>dragged=row);row.addEventListener('dragover',e=>e.preventDefault());row.addEventListener('drop',e=>{e.preventDefault();if(dragged!==row){list.insertBefore(dragged,row);state.dirty=true;scheduleAutosave();}});});
  list.querySelectorAll('[data-remove-id]').forEach(b=>b.addEventListener('click',()=>{b.closest('[data-id]').remove();state.dirty=true;scheduleAutosave();}));
  document.querySelector('[data-add-article]')?.addEventListener('change',async e=>{if(e.target.value){state.current.articleIds=[...document.querySelectorAll('[data-sortable] [data-id]')].map(x=>x.dataset.id).concat(e.target.value);await renderEditor();state.dirty=true;scheduleAutosave();}});
};
const payload = () => {
  if(state.resource==='articles')return {type:value('type'),status:value('status'),title:value('title'),subtitle:value('subtitle'),slug:value('slug'),language:value('language'),summary:value('summary'),bodyMarkdown:value('bodyMarkdown'),tags:lines(value('tags')),coverUrl:value('coverUrl'),publishedAt:value('publishedAt'),scheduledAt:value('scheduledAt'),seoTitle:value('seoTitle'),seoDescription:value('seoDescription'),canonicalUrl:value('canonicalUrl'),license:value('license'),metadata:JSON.parse(value('metadata')||'{}'),version:state.current.version};
  if(state.resource==='collections')return {id:value('id'),type:value('type'),status:value('status'),title:value('title'),theme:value('theme'),coverUrl:value('coverUrl'),editorNote:value('editorNote'),year:value('year'),volume:value('volume'),issueNumber:value('issueNumber'),publishedAt:value('publishedAt'),articleIds:[...document.querySelectorAll('[data-sortable] [data-id]')].map(x=>x.dataset.id),version:state.current.version};
  if(state.resource==='projects')return {id:value('id'),slug:value('slug'),type:value('type'),status:value('status'),title:value('title'),summary:value('summary'),bodyMarkdown:value('bodyMarkdown'),startDate:value('startDate'),endDate:value('endDate'),location:value('location'),participants:value('participants'),editor:value('editor'),coverUrl:value('coverUrl'),relations:JSON.parse(value('relations')||'[]'),version:state.current.version};
  return {title:value('title'),slug:value('slug'),status:value('status'),bodyMarkdown:value('bodyMarkdown'),seoTitle:value('seoTitle'),seoDescription:value('seoDescription'),version:state.current.version};
};
const saveCurrent = async (automatic) => {
  if(state.saving||!state.dirty)return; state.saving=true; notify(automatic?'自動儲存中…':'儲存中…');
  try{const body=payload(),exists=Boolean(state.current.id),path=exists?`${state.resource}/${encodeURIComponent(state.current.id)}`:state.resource;const data=await api(path,{method:exists?'PUT':'POST',headers:exists?{'If-Match':String(state.current.version)}:{},body:JSON.stringify(body)});state.current=data.item;state.dirty=false;notify(automatic?'已自動儲存':'已儲存');if(!automatic)renderEditor();}
  catch(error){notify(error.message,true);}finally{state.saving=false;}
};
const scheduleAutosave = () => {clearTimeout(state.autosave);state.autosave=setTimeout(()=>{if(state.current?.id)saveCurrent(true);},1800);};
const restoreRevision = async (revisionId) => {if(!confirm('恢復這個版本？目前內容會先保存在修訂記錄。'))return;try{state.current=(await api(`articles/${state.current.id}/restore`,{method:'POST',body:JSON.stringify({revisionId})})).item;renderEditor();notify('已恢復版本');}catch(error){notify(error.message,true);}};

const renderMedia = (surface) => {surface.innerHTML=`<div class="media-layout"><form class="upload" data-upload><h2>上傳到 R2</h2><input type="file" name="file" required /><input name="title" placeholder="標題" /><input name="altText" placeholder="替代文字" /><button class="primary">上傳</button></form><div class="media-grid">${state.items.map(x=>`<article><div class="media-thumb">${String(x.mimeType).startsWith('image/')?`<img src="${escapeHtml(x.publicUrl)}" alt="${escapeHtml(x.altText||'')}"/>`:'<span>檔案</span>'}</div><strong>${escapeHtml(x.title||x.filename)}</strong><small>${escapeHtml(x.mimeType)} · ${Math.round((x.sizeBytes||0)/1024)} KB</small><button data-copy="${escapeHtml(x.publicUrl)}">複製網址</button></article>`).join('')}</div></div>`;surface.querySelector('[data-upload]').addEventListener('submit',async e=>{e.preventDefault();notify('上傳中…');try{await api('media',{method:'POST',body:new FormData(e.target)});await openResource('media');}catch(error){notify(error.message,true);}});surface.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',()=>navigator.clipboard.writeText(b.dataset.copy)));};
const renderGuestbookEditor = () => {const x=state.current;document.querySelector('[data-surface]').innerHTML=`<form class="form single" data-guestbook><h2>${escapeHtml(x.authorName)}</h2><p class="message">${escapeHtml(x.body)}</p>${label('狀態','status',select('status',x.status,[['pending','待審核'],['approved','通過'],['hidden','隱藏'],['spam','垃圾']]))}${label('管理員回覆','adminReply',textarea('adminReply',x.adminReply,5))}<button class="primary">儲存</button></form>`;document.querySelector('[data-guestbook]').addEventListener('submit',async e=>{e.preventDefault();await api(`guestbook/${x.id}`,{method:'PATCH',body:JSON.stringify({status:value('status'),adminReply:value('adminReply')})});await openResource('guestbook');});};
const renderSettings = (settings) => {const get=k=>settings[k]?.value??'';document.querySelector('[data-surface]').innerHTML=`<form class="form single" data-settings>${label('站名','siteName',input('siteName',get('siteName')))}${label('網站描述','siteDescription',textarea('siteDescription',get('siteDescription'),4))}${label('頁尾','footerText',input('footerText',get('footerText')))}${label('搜尋提示','searchPlaceholder',input('searchPlaceholder',get('searchPlaceholder')))}${label('導航 JSON','navigation',textarea('navigation',JSON.stringify(get('navigation')||[],null,2),9))}<button class="primary">儲存設定</button></form>`;document.querySelector('[data-settings]').addEventListener('submit',async e=>{e.preventDefault();await api('settings',{method:'PUT',body:JSON.stringify({settings:{siteName:{value:value('siteName')},siteDescription:{value:value('siteDescription')},footerText:{value:value('footerText')},searchPlaceholder:{value:value('searchPlaceholder')},navigation:{value:JSON.parse(value('navigation')||'[]')}}})});notify('設定已儲存');});notify('已載入設定');};

try {const session=await api('session');shell(session.user);await openResource('articles');} catch {app.innerHTML=`<main class="login"><div><a class="brand" href="/articles">CRIVU</a><h1>內容管理</h1><p>使用獲准的 GitHub 帳號登入。GitHub 只用於確認身分，內容不再寫入 GitHub。</p><a class="login-button" href="/api/auth?provider=github&returnTo=/admin/">使用 GitHub 登入</a></div></main>`;}
