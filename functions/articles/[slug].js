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
    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; img-src 'self' data: https:; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://cloudflareinsights.com",
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
    post.category ? `<span class="pill">${escapeHtml(post.category || '')}</span>` : '',
    post.issue ? `<span class="issue-pill">${escapeHtml(post.issue)}</span>` : '',
    ...(Array.isArray(post.tags) ? post.tags.slice(0, 2).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`) : []),
    post.date ? `<small>${escapeHtml(post.date)}</small>` : '',
  ].filter(Boolean);
  return `
    <a class="more-item" href="${escapeHtml(safeLink)}">
      <div class="more-info">
        <div class="more-meta">${metaBits.join('')}</div>
        <h3>${escapeHtml(post.title || '')}</h3>
        ${excerpt ? `<p>${escapeHtml(excerpt)}</p>` : ''}
      </div>
    </a>
  `;
};

const renderPage = ({ currentPath, description, footerText, moreHtml, origin, post, site }) => {
  const canonicalPath = articlePath(post.slug);
  const canonicalUrl = new URL(canonicalPath, origin).toString();
  const navHtml = renderNavItems(site.nav, currentPath, { baseOrigin: origin });
  const siteName = normalizeText(site.siteName, { allowPlaceholder: true }) || 'CRIVU';
  const footer = normalizeText(footerText, { allowPlaceholder: true }) || `© ${new Date().getFullYear()} ${siteName}`;
  const moreTitle = normalizeText(site.moreReadingTitle) || '更多閱讀';
  const excerpt = normalizeText(post.excerpt);
  const tags = Array.isArray(post.tags) ? post.tags.filter(Boolean) : [];
  const bodyHtml = simpleMarkdown(post.body || '', { baseOrigin: origin });
  const title = `${post.title} · ${siteName}`;

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="build-version" content="__BUILD_VERSION__" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <link rel="stylesheet" href="/assets/css/style.css?v=__BUILD_VERSION__" />
  <link rel="icon" href="/assets/img/favicon.png" type="image/png" />
</head>
<body class="page-post">
  <div class="progress" id="readProgress"></div>
  <header class="site-header">
    <a class="logo" id="siteName" href="/">${escapeHtml(siteName)}</a>
    <nav class="nav">
      ${navHtml}
    </nav>
    <div class="header-actions">
      <div class="search-box">
        <input id="searchInput" class="search-input" type="search" placeholder="${escapeHtml(normalizeText(site.searchPlaceholder) || '搜尋')}" />
        <div id="searchResults" class="search-results"></div>
      </div>
      <button class="mobile-search-toggle" id="mobileSearchBtn" aria-label="搜尋">🔍</button>
      <button class="mobile-menu-toggle" id="mobileMenuBtn" aria-label="展開選單">☰</button>
    </div>
  </header>

  <main class="post-page">
    <div class="post-layout">
      <article id="post" class="post-article">
        <div class="post-hero">
          <div class="post-meta">
            <span id="postDate">${escapeHtml(formatDate(post.date || ''))}</span>
            <span id="postCategory" class="pill">${escapeHtml(post.category || '')}</span>
            ${post.issue ? `<span id="postIssue" class="issue-pill">${escapeHtml(post.issue)}</span>` : ''}
            <div id="postTags" class="tag-row">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
          </div>
          <h1 id="postTitle">${escapeHtml(post.title || '')}</h1>
          ${excerpt ? `<p id="postExcerpt" class="post-excerpt">${escapeHtml(excerpt)}</p>` : '<p id="postExcerpt" class="post-excerpt" hidden></p>'}
          <div id="postCover" class="post-cover" style="background-image:url('${escapeHtml(safeCoverUrl(post.cover))}')"></div>
        </div>
        <div id="postBody" class="post-body">${bodyHtml}</div>
        <section class="more more-bottom">
          <h2 id="moreTitle">${escapeHtml(moreTitle)}</h2>
          <div id="moreList" class="more-list">${moreHtml}</div>
        </section>
      </article>
    </div>
  </main>

  <footer class="site-footer">
    <div id="siteFooterText">${escapeHtml(footer)}</div>
  </footer>

  <script src="/assets/js/post.js?v=__BUILD_VERSION__" type="module"></script>
</body>
</html>`;
};

const renderNotFound = ({ currentPath, origin, site }) => {
  const navHtml = renderNavItems(site.nav, currentPath, { baseOrigin: origin });
  const siteName = normalizeText(site.siteName, { allowPlaceholder: true }) || 'CRIVU';
  const footer = normalizeText(site.footerText, { allowPlaceholder: true }) || `© ${new Date().getFullYear()} ${siteName}`;
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="build-version" content="__BUILD_VERSION__" />
  <title>文章未找到 · ${escapeHtml(siteName)}</title>
  <meta name="description" content="找不到你要查看的文章。" />
  <link rel="stylesheet" href="/assets/css/style.css?v=__BUILD_VERSION__" />
</head>
<body>
  <header class="site-header">
    <a class="logo" href="/">${escapeHtml(siteName)}</a>
    <nav class="nav">${navHtml}</nav>
  </header>
  <main class="list-page">
    <section class="section-title">
      <div>
        <h1>文章未找到</h1>
        <p>這篇文章可能尚未發布、已更名，或網址有誤。</p>
      </div>
    </section>
    <p><a href="/articles.html">返回文章列表</a></p>
  </main>
  <footer class="site-footer">
    <div>${escapeHtml(footer)}</div>
  </footer>
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
    return new Response(renderNotFound({ currentPath, origin, site }), { status: 404, headers: HTML_HEADERS });
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
