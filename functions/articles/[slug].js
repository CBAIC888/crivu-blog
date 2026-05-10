import {
  articlePath,
  buildDescription,
  escapeHtml,
  formatDate,
  normalizeText,
  renderNavItems,
  safeCoverUrl,
  simpleMarkdown,
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

const toInt = (value, fallback, min, max) => {
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, num));
};

const renderMoreItem = (post) => {
  const safeLink = articlePath(post.slug);
  const excerpt = buildDescription(post, 64);
  const metaBits = [
    post.date ? `<span class="cap">${escapeHtml(post.date)}</span>` : '',
    post.issue ? `<span class="pill">${escapeHtml(post.issue)}</span>` : '',
  ].filter(Boolean);
  return `
    <a class="more-item" href="${escapeHtml(safeLink)}">
      <div class="more-meta">${metaBits.join('')}</div>
      <h3>${escapeHtml(post.title || '')}</h3>
      ${excerpt ? `<p>${escapeHtml(excerpt)}</p>` : ''}
    </a>
  `;
};

const renderHeader = (site, navHtml) => {
  const siteName = normalizeText(site.siteName, { allowPlaceholder: true }) || 'CRIVU';
  const searchPlaceholder = escapeHtml(normalizeText(site.searchPlaceholder) || '搜尋文章');
  return `
  <header class="site-header">
    <div class="site-header__inner">
      <a class="site-header__brand" href="/">${escapeHtml(siteName)}</a>
      <nav class="site-header__nav" id="primaryNav">
        ${navHtml}
      </nav>
      <div class="site-header__actions">
        <form class="site-header__search" onsubmit="return false" role="search">
          <span class="icon" aria-hidden="true"></span>
          <input id="globalSearchInput" type="search" placeholder="${searchPlaceholder}" aria-label="搜尋文章" autocomplete="off" />
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
  </header>`;
};

const renderFooter = (site, footerText) => {
  const siteName = normalizeText(site.siteName, { allowPlaceholder: true }) || 'CRIVU';
  const siteDesc = normalizeText(site.siteDescription) || '';
  return `
  <footer class="site-footer">
    <div class="site-footer__inner">
      <div>
        <p class="cap">${escapeHtml(siteName)}</p>
        ${siteDesc ? `<p>${escapeHtml(siteDesc)}</p>` : ''}
      </div>
      <div>
        <p class="cap">Subscribe</p>
        <p><a href="/rss.xml">RSS</a></p>
      </div>
      <div class="site-footer__copy" id="siteFooterText">${escapeHtml(footerText)}</div>
    </div>
  </footer>`;
};

const renderPage = ({ currentPath, description, footerText, moreHtml, origin, post, site }) => {
  const canonicalPath = articlePath(post.slug);
  const canonicalUrl = new URL(canonicalPath, origin).toString();
  const navHtml = renderNavItems(site.nav, currentPath, { baseOrigin: origin });
  const siteName = normalizeText(site.siteName, { allowPlaceholder: true }) || 'CRIVU';
  const footer =
    normalizeText(footerText, { allowPlaceholder: true }) ||
    `© ${new Date().getFullYear()} ${siteName}`;
  const moreTitle = normalizeText(site.moreReadingTitle) || '更多閱讀';
  const excerpt = normalizeText(post.excerpt);
  const bodyHtml = simpleMarkdown(post.body || '', { baseOrigin: origin });
  const title = `${post.title} · ${siteName}`;
  const keywords = normalizeText(site.siteKeywords);
  const favicon =
    safeCoverUrl(site.favicon) !== '/assets/img/cover-01.svg'
      ? safeCoverUrl(site.favicon)
      : '/assets/img/favicon.png';
  const ogImg = safeCoverUrl(post.cover || site.ogImage);
  const ogImgTag =
    ogImg && ogImg !== '/assets/img/cover-01.svg'
      ? `\n  <meta property="og:image" content="${escapeHtml(ogImg)}" />\n  <meta name="twitter:image" content="${escapeHtml(ogImg)}" />`
      : '';
  const twitterCard = ogImgTag ? 'summary_large_image' : 'summary';

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="build-version" content="__BUILD_VERSION__" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />${keywords ? `\n  <meta name="keywords" content="${escapeHtml(keywords)}" />` : ''}
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="${escapeHtml(siteName)}" />${ogImgTag}
  <meta name="twitter:card" content="${twitterCard}" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(siteName)} RSS" href="/rss.xml" />
  <link rel="stylesheet" href="/assets/css/style.css?v=__BUILD_VERSION__" />
  <link rel="icon" href="${escapeHtml(favicon)}" type="image/png" />
  <script src="/assets/js/theme.js?v=__BUILD_VERSION__"></script>
</head>
<body class="page-post">
  <div class="progress" id="readProgress"></div>
  ${renderHeader(site, navHtml)}

  <main class="page-post__main post-page">
    <article class="reading post-article" id="post">
      <header class="reading__head post-hero">
        <time class="reading__date">${escapeHtml(formatDate(post.date || ''))}</time>
        <h1 class="reading__title" id="postTitle">${escapeHtml(post.title || '')}</h1>
        ${excerpt ? `<p class="post-excerpt" id="postExcerpt">${escapeHtml(excerpt)}</p>` : ''}
        ${post.cover ? `<div class="post-cover" id="postCover"><img src="${escapeHtml(safeCoverUrl(post.cover))}" alt="${escapeHtml(post.title || '')}" loading="lazy" /></div>` : ''}
      </header>

      <div class="reading__body post-body" id="postBody">${bodyHtml}</div>
    </article>

    <aside class="reading-more more more-bottom" aria-label="更多閱讀">
      <header class="reading-more__head">
        <p class="kicker">More Reading</p>
        <h2 class="reading-more__title">${escapeHtml(moreTitle)}</h2>
      </header>
      <div id="moreList" class="more-list">${moreHtml}</div>
    </aside>
  </main>

  ${renderFooter(site, footer)}

  <script src="/assets/js/search.js?v=__BUILD_VERSION__"></script>
  <script src="/assets/js/mobile-nav.js?v=__BUILD_VERSION__"></script>
  <script src="/assets/js/post.js?v=__BUILD_VERSION__" type="module"></script>
</body>
</html>`;
};

const renderNotFound = ({ currentPath, origin, site }) => {
  const navHtml = renderNavItems(site.nav, currentPath, { baseOrigin: origin });
  const siteName = normalizeText(site.siteName, { allowPlaceholder: true }) || 'CRIVU';
  const footer =
    normalizeText(site.footerText, { allowPlaceholder: true }) ||
    `© ${new Date().getFullYear()} ${siteName}`;
  const favicon =
    safeCoverUrl(site.favicon) !== '/assets/img/cover-01.svg'
      ? safeCoverUrl(site.favicon)
      : '/assets/img/favicon.png';
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="build-version" content="__BUILD_VERSION__" />
  <title>文章未找到 · ${escapeHtml(siteName)}</title>
  <meta name="description" content="找不到你要查看的文章。" />
  <link rel="stylesheet" href="/assets/css/style.css?v=__BUILD_VERSION__" />
  <link rel="icon" href="${escapeHtml(favicon)}" type="image/png" />
  <script src="/assets/js/theme.js?v=__BUILD_VERSION__"></script>
</head>
<body>
  ${renderHeader(site, navHtml)}
  <main class="page-list list-page">
    <header class="page-head">
      <p class="kicker">404</p>
      <h1 class="page-title">文章未找到</h1>
      <p class="page-intro">這篇文章可能尚未發布、已更名，或網址有誤。<a href="/articles.html">返回文章列表</a>。</p>
    </header>
  </main>
  ${renderFooter(site, footer)}
  <script src="/assets/js/search.js?v=__BUILD_VERSION__"></script>
  <script src="/assets/js/mobile-nav.js?v=__BUILD_VERSION__"></script>
</body>
</html>`;
};

export async function onRequest(context) {
  const slug = normalizeText(context.params?.slug, { allowPlaceholder: true });
  const origin = new URL(context.request.url).origin;
  const currentPath = new URL(context.request.url).pathname;

  const [postsData, site] = await Promise.all([
    fetchStaticJson(context, '/posts/posts.json'),
    fetchStaticJson(context, '/posts/site.json').catch(() => ({})),
  ]);

  const posts = postsData.items || postsData;
  const post = Array.isArray(posts) ? posts.find((item) => item.slug === slug) : null;

  if (!post) {
    return new Response(renderNotFound({ currentPath, origin, site }), {
      status: 404,
      headers: HTML_HEADERS,
    });
  }

  const description = buildDescription(post);
  const moreLimit = toInt(site.moreReadingLimit, 4, 1, 12);
  const moreHtml = posts
    .filter((item) => item.slug !== post.slug)
    .slice(0, moreLimit)
    .map(renderMoreItem)
    .join('');

  return new Response(
    renderPage({
      currentPath,
      description,
      footerText: site.footerText,
      moreHtml,
      origin,
      post,
      site,
    }),
    { headers: HTML_HEADERS }
  );
}
