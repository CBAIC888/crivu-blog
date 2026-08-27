import { escapeHtml, sanitizeUrl, simpleMarkdown, stripMarkdown } from '../../shared/content.js';

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const date = (value) => {
  const raw=String(value||'');
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;
  const parsed=new Date(raw);if(Number.isNaN(parsed.getTime()))return raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0]||'';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(parsed).map(x=>[x.type,x.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const absolute = (path, origin) => new URL(path, origin).toString();
const versioned = (path, version='') => version ? `${path}?v=${encodeURIComponent(String(version).slice(0,12))}` : path;
const kind = (type, language='zh') => language==='en' ? ({general:'Article',research:'Research',script:'Script'}[type]||'Article') : ({general:'一般',research:'研究',script:'劇本'}[type]||'一般');

export const htmlHeaders = {
  'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate, max-age=0','X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY',
};

export const applyPublicSettings = (html, settings={}) => {
  const siteName=clean(settings.siteName)||'CRIVU';
  const footerText=clean(settings.footerText)||`© 2026 ${siteName}`;
  const searchPlaceholder=clean(settings.searchPlaceholder)||'搜尋';
  const navigation=Array.isArray(settings.navigation)?settings.navigation:[];
  const settingMetas=`<meta name="crivu-site-name" content="${escapeHtml(siteName)}"/><meta name="crivu-footer-text" content="${escapeHtml(footerText)}"/><meta name="crivu-search-placeholder" content="${escapeHtml(searchPlaceholder)}"/><meta name="crivu-theme-toggle-enabled" content="${settings.themeToggleEnabled===false?'false':'true'}"/>${navigation.length?`<meta name="crivu-navigation" content="${escapeHtml(JSON.stringify(navigation))}"/>`:''}`;
  return String(html)
    .replace(/<meta name="crivu-(?:site-name|footer-text|search-placeholder|theme-toggle-enabled|navigation)"[^>]*\/>/g,'')
    .replace('<title>',`${settingMetas}<title>`)
    .replace(/(<title>[^<]*?) · CRIVU(<\/title>)/,(_match,start,end)=>`${start} · ${escapeHtml(siteName)}${end}`)
    .replace(/(<meta property="og:title" content="[^"]*?) · CRIVU("\/>)/,(_match,start,end)=>`${start} · ${escapeHtml(siteName)}${end}`);
};

const head = ({ title, description='', canonicalPath, origin, image='', language='zh-Hant', assetVersion='', settings={} }) => {
  const canonical=absolute(canonicalPath,origin),siteName=clean(settings.siteName)||'CRIVU',siteDescription=clean(settings.siteDescription),fullTitle=title.includes(siteName)?title:`${title} · ${siteName}`;
  const navigation=Array.isArray(settings.navigation)?settings.navigation:[];
  return `<!doctype html><html lang="${escapeHtml(language)}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>${assetVersion?`<meta name="build-version" content="${escapeHtml(String(assetVersion).slice(0,12))}"/>`:''}<meta name="crivu-site-name" content="${escapeHtml(siteName)}"/><meta name="crivu-footer-text" content="${escapeHtml(clean(settings.footerText)||`© 2026 ${siteName}`)}"/><meta name="crivu-search-placeholder" content="${escapeHtml(clean(settings.searchPlaceholder)||(language==='en'?'Search':'搜尋'))}"/>${navigation.length?`<meta name="crivu-navigation" content="${escapeHtml(JSON.stringify(navigation))}"/>`:''}<title>${escapeHtml(fullTitle)}</title><meta name="description" content="${escapeHtml(description||siteDescription)}"/><link rel="canonical" href="${escapeHtml(canonical)}"/><link rel="alternate" type="application/rss+xml" title="${escapeHtml(siteName)} RSS" href="/rss.xml"/><meta property="og:title" content="${escapeHtml(fullTitle)}"/><meta property="og:description" content="${escapeHtml(description||siteDescription)}"/><meta property="og:url" content="${escapeHtml(canonical)}"/><meta property="og:type" content="website"/>${image?`<meta property="og:image" content="${escapeHtml(absolute(image,origin))}"/>`:''}<link rel="icon" href="${escapeHtml(versioned('/assets/img/favicon.png',assetVersion))}" type="image/png"/><link rel="stylesheet" href="${escapeHtml(versioned('/assets/academic/typography.css',assetVersion))}"/><link rel="stylesheet" href="${escapeHtml(versioned('/assets/academic/style.css',assetVersion))}"/></head>`;
};
const shell = ({ current, title, description, path, origin, main, image='', language='zh-Hant', extraScripts='', assetVersion='', settings={} }) => `${head({title,description,canonicalPath:path,origin,image,language,assetVersion,settings})}<body data-current="${current}"${language==='en'?' data-language="en"':''}>${main}<script defer src="${escapeHtml(versioned('/assets/academic/analytics.js',assetVersion))}"></script><script type="module" src="${escapeHtml(versioned('/assets/academic/public-site.js',assetVersion))}"></script>${extraScripts}</body></html>`;

const entry = (item) => `<li class="entry" data-kind="${kind(item.type)}"><time class="entry__date" datetime="${escapeHtml(date(item.publishedAt))}">${escapeHtml(date(item.publishedAt).slice(5).replace('-','.'))}</time><h3 class="entry__title"><a href="/articles/${encodeURIComponent(item.slug)}">${escapeHtml(item.title)}</a></h3></li>`;
export const renderArticles = ({items,origin,assetVersion,settings}) => {
  const groups=[...new Set(items.map(x=>date(x.publishedAt).slice(0,4)||'未標日期'))].map(year=>`<section class="year-group"><h2 class="year-label">${year}</h2><ol class="entry-list">${items.filter(x=>(date(x.publishedAt).slice(0,4)||'未標日期')===year).map(entry).join('')}</ol></section>`).join('');
  const counts={全部:items.length,一般:items.filter(x=>kind(x.type)==='一般').length,研究:items.filter(x=>kind(x.type)==='研究').length,劇本:items.filter(x=>kind(x.type)==='劇本').length};
  return shell({current:'articles',title:'文章',description:'CRIVU 全部文章、研究與劇本。',path:'/articles',origin,assetVersion,settings,main:`<main class="page-main articles-main"><nav class="category-nav" aria-label="文章分類">${Object.entries(counts).map(([label,count],index)=>`<button${index===0?' class="is-active"':''} data-filter="${label}" data-count="${count}" aria-label="${label}，共 ${count} 篇">${label}</button>`).join('')}</nav>${groups}</main>`});
};

const scriptBody = (source) => {
  const lines=String(source||'').replace(/\r\n/g,'\n').replace(/^\\(?=#{1,6}\s)/gm,'').replace(/\\(?=\*)/g,'').split('\n'); let scene=0;
  return lines.map(raw=>{const line=raw.trim();if(!line)return'';const image=line.match(/^!\[(.*?)\]\((.*?)\)$/);if(image){const src=sanitizeUrl(image[2],{allowHash:false});return src==='#'?'':`<figure class="post-image"><img src="${escapeHtml(src)}" alt="${escapeHtml(image[1])}" loading="lazy"/>${image[1]?`<figcaption>${escapeHtml(image[1])}</figcaption>`:''}</figure>`;}const sceneMatch=line.match(/^(?:#{1,6}\s*)?(第[一二三四五六七八九十百千万零〇两\d]+[場场回幕折])(?:[：:—–-]\s*(.*))?$/u);if(sceneMatch){scene+=1;return`${scene>1?'</section>':''}<section class="script-section" id="script-scene-${scene}"><h2 class="script-scene-heading">${escapeHtml(sceneMatch[1]+(sceneMatch[2]?` · ${sceneMatch[2]}`:''))}</h2>`;}const speech=line.replace(/^\*\*(.+?)\*\*\s*/, '$1 ').match(/^([^（(：:]{1,40})[（(]([^）)]{1,24})[）)]\s*[:：]?\s*(.*)$/u);if(speech)return`<div class="script-speech"><div class="script-speech__label"><span class="script-speaker">${escapeHtml(speech[1])}</span><span class="script-mode">（${escapeHtml(speech[2])}）</span></div><div class="script-speech__content"><p>${escapeHtml(speech[3])}</p></div></div>`;if(/^[（(【\[〖]/u.test(line))return`<p class="script-direction">${escapeHtml(line.replace(/^\*+|\*+$/g,''))}</p>`;if(/^#{1,6}\s/.test(line))return`<h3 class="script-inline-heading">${escapeHtml(line.replace(/^#{1,6}\s+/,''))}</h3>`;return`<p class="script-cue">${escapeHtml(line.replace(/^\*+|\*+$/g,''))}</p>`;}).join('')+(scene?'</section>':'');
};

const researchInline = (value) => escapeHtml(value)
  .replace(/_([^_]+)_/g, '<i>$1</i>')
  .replace(/\[(\d+)\](?:–\[(\d+)\])?/g, (_match, start, end) => {
    const first=`<a class="note-ref" href="#note-${start}" aria-label="Read note ${start}">[${start}]</a>`;
    return end?`${first}–<a class="note-ref" href="#note-${end}" aria-label="Read note ${end}">[${end}]</a>`:first;
  });

const romanNumber = (roman) => {
  const values={I:1,V:5,X:10};
  return [...roman].reduce((sum,char,index,all)=>sum+(values[char]<(values[all[index+1]]||0)?-values[char]:values[char]),0);
};

const researchMarkdown = (markdown) => {
  const sections=[];
  let section={id:'article-intro',index:'00',title:'',blocks:[]},paragraph=[],quote=[];
  let documentTitleSkipped=false;
  const flushParagraph=()=>{if(paragraph.length){section.blocks.push(`<p>${researchInline(paragraph.join(' '))}</p>`);paragraph=[];}};
  const flushQuote=()=>{if(quote.length){section.blocks.push(`<blockquote><p>${researchInline(quote.join(' '))}</p></blockquote>`);quote=[];}};
  const flushSection=()=>{flushParagraph();flushQuote();if(section.title||section.blocks.length)sections.push(section);};
  String(markdown||'').replace(/\r\n/g,'\n').split('\n').forEach((line)=>{
    if(!sections.length&&!section.title&&!section.blocks.length&&!paragraph.length&&/^An Exploration of /.test(line.trim())){documentTitleSkipped=true;return;}
    const heading=line.match(/^#{1,3}\s+(.+)$/);
    if(heading){
      const title=heading[1].trim();
      if(/^An Exploration of /.test(title)){documentTitleSkipped=true;return;}
      flushSection();
      if(/^References and Notes$/i.test(title))section={id:'article-notes',index:'Notes',title:'References and Notes',blocks:[]};
      else if(/^Introduction$/i.test(title))section={id:'article-intro',index:'00',title:'Introduction',blocks:[]};
      else {const roman=title.match(/^([IVX]+)\.\s*(.*)$/);const number=roman?romanNumber(roman[1]):sections.length;section={id:`article-${String(number).padStart(2,'0')}`,index:String(number).padStart(2,'0'),title:roman?`${roman[1]}. ${roman[2]}`:title,blocks:[]};}
      return;
    }
    if(documentTitleSkipped&&!section.title&&!section.blocks.length&&!line.trim())return;
    if(/^---\s*$/.test(line)){flushParagraph();flushQuote();return;}
    const image=line.trim().match(/^!\[(.*?)\]\((.*?)\)$/);
    if(image){flushParagraph();flushQuote();const src=sanitizeUrl(image[2],{allowHash:false});if(src!=='#')section.blocks.push(`<figure class="post-image"><img src="${escapeHtml(src)}" alt="${escapeHtml(image[1])}" loading="lazy"/>${image[1]?`<figcaption>${escapeHtml(image[1])}</figcaption>`:''}</figure>`);return;}
    if(/^>\s?/.test(line)){flushParagraph();quote.push(line.replace(/^>\s?/,''));return;}
    if(quote.length&&line.trim()){quote.push(line.trim());return;}
    if(!line.trim()){flushParagraph();flushQuote();return;}
    const note=line.match(/^\[(\d+)\]\s+(.+)$/);
    if(section.id==='article-notes'&&note){flushParagraph();section.blocks.push(`<p class="note" id="note-${note[1]}"><a class="note-number" href="#note-ref-${note[1]}">[${note[1]}]</a>${researchInline(note[2])}</p>`);return;}
    paragraph.push(line.trim());
  });
  flushSection();
  return `<article class="article">${sections.map((item)=>`<section class="article-section${item.id==='article-notes'?' article-notes':''}" id="${item.id}"><p class="section-index">${item.index}</p><h2>${researchInline(item.title)}</h2>${item.blocks.join('')}</section>`).join('')}</article>`;
};

export const renderArticle = ({item,origin,assetVersion}) => {
  const language=item.language||'zh-Hant', isEnglish=language==='en', meta=item.metadata||{}, description=item.seoDescription||item.summary||clean(stripMarkdown(item.bodyMarkdown)).slice(0,155);
  if(item.type==='research'){
    const content=meta.format==='html'?item.bodyMarkdown:researchMarkdown(item.bodyMarkdown);
    const translations=(item.translations||[]).map(x=>`<a href="/articles/${encodeURIComponent(x.slug)}" lang="${escapeHtml(x.hreflang)}">${escapeHtml(x.language)}</a>`).join('');
    return shell({current:'articles',title:item.seoTitle||item.title,description,path:`/articles/${item.slug}`,origin,image:item.coverUrl,language,assetVersion,main:`<main class="research-page"><header class="research-head"><h1>${escapeHtml(item.title)}</h1><p class="article-meta">${escapeHtml(date(item.publishedAt))} · ${kind(item.type,language)}</p>${item.summary?`<p class="article-deck">${escapeHtml(item.summary)}</p>`:''}<nav class="research-actions" aria-label="研究操作">${meta.exhibition?`<a href="${escapeHtml(meta.exhibition)}">${isEnglish?'Enter exhibition':'進入展覽'}</a>`:''}${meta.gallery?`<a href="${escapeHtml(meta.gallery)}">${isEnglish?'Image gallery':'圖片展示'}</a>`:''}${translations?`<details class="language-switch"><summary>${isEnglish?'Language':'語言'}</summary><div>${translations}</div></details>`:''}</nav></header><div class="research-body" data-research-content>${content}</div></main>`});
  }
  if(item.type==='script') return shell({current:'articles',title:item.title,description,path:`/articles/${item.slug}`,origin,image:item.coverUrl,language,assetVersion,main:`<main class="script-page migrated-script" data-script-template="opera-v1"><header class="script-head"><h1>${escapeHtml(item.title)}</h1><p class="article-meta">${escapeHtml(date(item.publishedAt))} · 劇本</p>${item.summary?`<p class="article-deck">${escapeHtml(item.summary)}</p>`:''}</header><div class="script-layout"><article class="script-body">${scriptBody(item.bodyMarkdown)}</article><aside class="script-side">${item.coverUrl?`<figure class="script-cover"><img src="${escapeHtml(item.coverUrl)}" alt="${escapeHtml(item.title)}"/></figure>`:''}</aside></div></main>`});
  return shell({current:'articles',title:item.title,description,path:`/articles/${item.slug}`,origin,image:item.coverUrl,language,assetVersion,main:`<main class="page-main article-page"><article class="article-simple"><header class="article-header"><h1>${escapeHtml(item.title)}</h1><p class="article-meta">${escapeHtml(date(item.publishedAt))} · ${kind(item.type,language)}</p>${item.summary?`<p class="article-deck">${escapeHtml(item.summary)}</p>`:''}${item.coverUrl?`<figure class="article-cover"><img src="${escapeHtml(item.coverUrl)}" alt="${escapeHtml(item.title)}"/></figure>`:''}</header><div class="prose">${simpleMarkdown(item.bodyMarkdown||'')}</div></article></main>`});
};

export const renderCollections = ({items,projects=[],origin,assetVersion}) => {
  const collectionsMarkup=items.map(x=>`<a class="record collection-item" href="/issues/${encodeURIComponent(x.id)}"><span class="collection-item__cover"><img src="${escapeHtml(x.coverUrl)}" alt="${escapeHtml(x.title)}封面"/></span><div class="collection-item__body"><span class="collection-item__label">${x.type==='journal_issue'?'期刊':'合集'} · ${escapeHtml(String(x.year||date(x.publishedAt).slice(0,4)||''))}</span><h2 class="collection-item__title">${escapeHtml(x.title)}</h2></div></a>`).join('');
  const projectsMarkup=projects.map(x=>`<a class="record collection-item" href="${escapeHtml(projectHref(x))}"><span class="collection-item__cover"><img src="${escapeHtml(x.coverUrl)}" alt="${escapeHtml(x.title)}封面"/></span><div class="collection-item__body"><span class="collection-item__label">紀錄 · ${escapeHtml(date(x.startDate).slice(0,4))}</span><h2 class="collection-item__title">${escapeHtml(x.title)}</h2></div></a>`).join('');
  return shell({current:'issues',title:'期刊',description:'CRIVU 期刊、合集與專題紀錄。',path:'/issues',origin,assetVersion,main:`<main class="page-main collection-page collection-page--issues"><div class="records-list">${collectionsMarkup}${projectsMarkup}</div></main>`});
};
export const renderCollection = ({item,origin,assetVersion}) => shell({current:'issues',title:item.title,description:item.editorNote||item.theme||item.title,path:`/issues/${item.id}`,origin,image:item.coverUrl,assetVersion,main:`<main class="page-main issue-page"><header class="issue-head"><img src="${escapeHtml(item.coverUrl)}" alt="${escapeHtml(item.title)}封面"/><div><h1>${escapeHtml(item.title)}</h1><p>${escapeHtml(item.editorNote||item.theme||'')}</p><p class="issue-meta">${escapeHtml(date(item.publishedAt))} · ${(item.articles||[]).length} 篇</p></div></header><ol class="entry-list issue-entry-list">${(item.articles||[]).map(entry).join('')}</ol></main>`});
const projectHref = (item) => item.slug === 'world-word-history' ? '/articles/world-word-exploration' : `/records/${encodeURIComponent(item.slug)}`;
export const renderProjects = ({items,origin,assetVersion}) => shell({current:'records',title:'紀錄',description:'CRIVU 專題紀錄。',path:'/records',origin,assetVersion,main:`<main class="page-main collection-page collection-page--records"><div class="records-list">${items.map(x=>`<a class="record collection-item" href="${escapeHtml(projectHref(x))}"><span class="collection-item__cover"><img src="${escapeHtml(x.coverUrl)}" alt="${escapeHtml(x.title)}封面"/></span><div class="collection-item__body"><span class="collection-item__label">紀錄 · ${escapeHtml(date(x.startDate).slice(0,4))}</span><h2 class="collection-item__title">${escapeHtml(x.title)}</h2></div></a>`).join('')}</div></main>`});
export const renderProject = ({item,origin,assetVersion}) => {const videos=item.metadata?.videos||[];return shell({current:'issues',title:item.title,description:item.summary||item.title,path:`/records/${item.slug}`,origin,image:item.coverUrl,assetVersion,main:`<main class="page-main record-detail"><header class="record-detail-head"><img src="${escapeHtml(item.coverUrl)}" alt="${escapeHtml(item.title)}封面"/><div><h1>${escapeHtml(item.title)}</h1><p class="article-meta">${escapeHtml(date(item.startDate))} · 專題紀錄</p><p>${escapeHtml(item.summary)}</p></div></header>${item.bodyMarkdown?`<article class="prose">${simpleMarkdown(item.bodyMarkdown)}</article>`:''}${videos.length?`<section class="video-grid">${videos.filter(x=>x.published!==false).map(x=>`<a class="video-card" href="${escapeHtml(String(x.url||'').match(/https?:\/\/[^\s]+/)?.[0]||'#')}" target="_blank" rel="noopener"><span class="video-card__media"><img src="${escapeHtml(x.cover||'')}" alt=""/><span class="video-card__play">▶</span></span><h2>${escapeHtml(x.title)}</h2></a>`).join('')}</section>`:''}</main>`});};
export const renderAbout = ({page,origin,assetVersion}) => shell({current:'about',title:page.seoTitle||page.title||'關於',description:page.seoDescription||clean(stripMarkdown(page.bodyMarkdown)).slice(0,155),path:'/about',origin,assetVersion,main:`<main class="page-main article-page"><article class="article-simple about-copy prose">${simpleMarkdown(page.bodyMarkdown||'')}</article><section class="guestbook-panel" data-guestbook><h2>留言板</h2><div class="guestbook-list" data-guestbook-list><p class="muted">留言載入中。</p></div><form class="guestbook-form" data-guestbook-form><div class="guestbook-fields"><label><span>稱呼</span><input name="authorName" maxlength="32" required/></label><label><span>電郵（不公開）</span><input name="email" type="email" maxlength="160"/></label></div><label><span>留言</span><textarea name="body" maxlength="1200" required></textarea></label><label class="guestbook-trap" aria-hidden="true"><input name="website" tabindex="-1"/></label><div class="guestbook-verification" data-guestbook-turnstile></div><div class="guestbook-actions"><button type="submit">提交</button><p class="guestbook-status" data-guestbook-status aria-live="polite"></p></div></form></section></main>`,extraScripts:`<script type="module" src="${escapeHtml(versioned('/assets/academic/guestbook.js',assetVersion))}"></script>`});
export const renderNotFound = ({origin,assetVersion}) => shell({current:'',title:'找不到頁面',description:'找不到要求的內容。',path:'/404',origin,assetVersion,main:'<main class="page-main article-page"><article class="article-simple"><h1>找不到頁面</h1><p><a href="/articles">返回文章列表</a></p></article></main>'});
