import {
  articlePath,
  escapeHtml,
  normalizeText,
  renderNavItems,
  safeCoverUrl,
} from '../../shared/content.js';

const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=UTF-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Content-Security-Policy':
    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; img-src 'self' data: https:; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; connect-src 'self' https://cloudflareinsights.com",
};

const fetchStaticJson = async (context, pathname) => {
  const assetUrl = new URL(pathname, context.request.url);
  const res = context.env?.ASSETS?.fetch
    ? await context.env.ASSETS.fetch(new Request(assetUrl.toString(), { method: 'GET' }))
    : await fetch(assetUrl.toString());
  if (!res.ok) {
    throw new Error(`Failed to load ${pathname}: ${res.status}`);
  }
  return res.json();
};

const renderTocRow = (post, index) => {
  const href = articlePath(post.slug);
  const num = String(index + 1).padStart(2, '0');
  const metaBits = [
    post.date ? `<span class="cap">${escapeHtml(post.date)}</span>` : '',
  ]
    .filter(Boolean)
    .join('');
  const excerpt = normalizeText(post.excerpt) || '';
  return `
    <li class="toc__row">
      <span class="toc__num">${num}</span>
      <div class="toc__body">
        <p class="toc__meta">${metaBits}</p>
        <h3 class="toc__title"><a href="${escapeHtml(href)}">${escapeHtml(post.title || '')}</a></h3>
        ${excerpt ? `<p class="toc__excerpt">${escapeHtml(excerpt)}</p>` : ''}
      </div>
    </li>`;
};

const renderShell = ({ bodyHtml, currentPath, description, origin, site, title }) => {
  const siteName = normalizeText(site.siteName, { allowPlaceholder: true }) || 'CRIVU';
  const navHtml = renderNavItems(site.nav, currentPath, { baseOrigin: origin });
  const footer = normalizeText(site.footerText, { allowPlaceholder: true }) || `© ${new Date().getFullYear()} ${siteName}`;
  const placeholder = escapeHtml(normalizeText(site.searchPlaceholder) || '搜尋文章');

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="build-version" content="__BUILD_VERSION__" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(siteName)} RSS" href="/rss.xml" />
  <link rel="stylesheet" href="/assets/css/style.css?v=__BUILD_VERSION__" />
  <link rel="icon" href="/assets/img/favicon.png" type="image/png" />
  <script src="/assets/js/theme.js?v=__BUILD_VERSION__"></script>
</head>
<body>
  <header class="site-header">
    <div class="site-header__inner">
      <a class="site-header__brand" href="/">${escapeHtml(siteName)}</a>
      <nav class="site-header__nav" id="primaryNav">
        ${navHtml}
      </nav>
      <div class="site-header__actions">
        <form class="site-header__search" onsubmit="return false" role="search">
          <span class="icon" aria-hidden="true"></span>
          <input id="globalSearchInput" type="search" placeholder="${placeholder}" aria-label="搜尋文章" autocomplete="off" />
          <div id="globalSearchResults" class="search-results" role="listbox"></div>
        </form>
        <button class="mobile-search-toggle" id="mobileSearchBtn" aria-label="搜尋">
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/>
            <line x1="16.2" y1="16.2" x2="20" y2="20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
        <button class="mobile-menu-toggle" id="mobileMenuBtn" aria-label="展開選單" aria-expanded="false" aria-controls="primaryNav">
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18">
            <line class="mm-line mm-line-top" x1="4" y1="7" x2="20" y2="7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <line class="mm-line mm-line-mid" x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <line class="mm-line mm-line-bot" x1="4" y1="17" x2="20" y2="17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
        <button class="theme-toggle" data-theme-toggle aria-label="切換深色模式">
          <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>
          <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
        </button>
      </div>
    </div>
  </header>

  ${bodyHtml}

  <footer class="site-footer">
    <div class="site-footer__inner">
      <div>
        <p class="cap">${escapeHtml(siteName)}</p>
        <p>${escapeHtml(normalizeText(site.siteDescription) || '')}</p>
      </div>
      <div>
        <p class="cap">Subscribe</p>
        <p><a href="/rss.xml">RSS</a></p>
      </div>
      <div class="site-footer__copy" id="siteFooterText">${escapeHtml(footer)}</div>
    </div>
  </footer>

  <script src="/assets/js/search.js?v=__BUILD_VERSION__"></script>
  <script src="/assets/js/mobile-nav.js?v=__BUILD_VERSION__"></script>
</body>
</html>`;
};

const renderNotFound = ({ currentPath, origin, site }) => {
  const main = `
    <main class="page-issue">
      <section class="page-head">
        <p class="kicker">404</p>
        <h1 class="page-title">找不到這本期刊</h1>
        <p class="page-intro">可能 ID 有誤或期刊尚未發布。<a href="/issues.html">返回期刊列表</a>。</p>
      </section>
    </main>`;
  const siteName = normalizeText(site.siteName, { allowPlaceholder: true }) || 'CRIVU';
  return renderShell({
    bodyHtml: main,
    currentPath,
    description: '找不到這本期刊。',
    origin,
    site,
    title: `期刊未找到 · ${siteName}`,
  });
};

export async function onRequest(context) {
  const id = normalizeText(context.params?.id, { allowPlaceholder: true });
  const origin = new URL(context.request.url).origin;
  const currentPath = new URL(context.request.url).pathname;

  const [issuesData, postsData, site] = await Promise.all([
    fetchStaticJson(context, '/posts/issues.json'),
    fetchStaticJson(context, '/posts/posts.json'),
    fetchStaticJson(context, '/posts/site.json').catch(() => ({})),
  ]);

  const issues = Array.isArray(issuesData?.issues) ? issuesData.issues : [];
  const issue = issues.find((it) => String(it.id) === id);

  if (!issue) {
    return new Response(renderNotFound({ currentPath, origin, site }), {
      status: 404,
      headers: HTML_HEADERS,
    });
  }

  const posts = postsData.items || postsData || [];
  const linkedSlugs = Array.isArray(issue.posts)
    ? issue.posts
        .map((item) => (typeof item === 'string' ? item : item && item.slug))
        .filter(Boolean)
    : [];
  const linkedPosts = linkedSlugs.map((slug) => posts.find((p) => p.slug === slug)).filter(Boolean);

  const siteName = normalizeText(site.siteName, { allowPlaceholder: true }) || 'CRIVU';
  const title = `${issue.title || '期刊'} · ${siteName}`;
  const description = normalizeText(issue.editorNote) || normalizeText(issue.theme) || issue.title || '期刊';
  const sealChar = (issue.title || '期').trim().charAt(0);
  const cover = safeCoverUrl(issue.cover);

  const tocRows = linkedPosts.length > 0
    ? `<ol class="toc toc--tight">${linkedPosts.map(renderTocRow).join('')}</ol>`
    : `<p class="page-intro">${escapeHtml(normalizeText(site.issueEmptyText) || '暫無文章')}</p>`;

  const editorNote = normalizeText(issue.editorNote);

  const bodyHtml = `
    <main class="page-issue">
      <section class="issue-hero">
        <div class="issue-hero__crumbs">
          <a href="/issues.html">← 返回期刊</a>
        </div>
        <div class="issue-hero__grid">
          <figure class="issue-hero__cover">
            <img src="${escapeHtml(cover)}" alt="${escapeHtml(issue.title || '')} 封面" />
            <span class="book__seal" aria-hidden="true">${escapeHtml(sealChar)}</span>
          </figure>
          <div class="issue-hero__body">
            <p class="kicker">Issue ${escapeHtml(issue.id)}</p>
            <h1 class="issue-hero__title">${escapeHtml(issue.title || '')}</h1>
            ${issue.theme ? `<p class="issue-hero__theme">${escapeHtml(issue.theme)}</p>` : ''}
            <dl class="issue-hero__facts">
              ${issue.publishDate ? `<div><dt>發刊日</dt><dd>${escapeHtml(issue.publishDate)}</dd></div>` : ''}
              <div><dt>主編</dt><dd>${escapeHtml(siteName)}</dd></div>
              <div><dt>收錄</dt><dd>${linkedPosts.length} 篇文章</dd></div>
            </dl>
          </div>
        </div>
        ${editorNote ? `
        <blockquote class="issue-hero__editor">
          <p>${escapeHtml(editorNote)}</p>
          <footer><span>— 編者語</span></footer>
        </blockquote>
        ` : ''}
      </section>

      <section class="issue-toc">
        <header class="issue-toc__head">
          <p class="cap">Contents · 目次</p>
          <h2>收錄文章</h2>
        </header>
        ${tocRows}
      </section>
    </main>`;

  return new Response(
    renderShell({ bodyHtml, currentPath, description, origin, site, title }),
    { headers: HTML_HEADERS }
  );
}
