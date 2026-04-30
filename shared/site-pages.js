import {
  articlePath,
  buildDescription,
  escapeHtml,
  isValidEmail,
  normalizeText,
  renderNavItems,
  safeCoverUrl,
  sanitizeUrl,
} from './content.js';

const BUILD_VERSION = '__BUILD_VERSION__';

export const PAGE_HEADERS = {
  'Content-Type': 'text/html; charset=UTF-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Content-Security-Policy':
    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; img-src 'self' data: https:; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; connect-src 'self' https://cloudflareinsights.com",
};

const DEFAULT_NAV = [
  { label: '首頁', href: '/' },
  { label: '期刊', href: '/issues.html' },
  { label: '文章', href: '/articles.html' },
  { label: '關於', href: '/about.html' },
];

const fetchStaticJson = async (context, pathname) => {
  const assetUrl = new URL(pathname, context.request.url);
  const res = context.env?.ASSETS?.fetch
    ? await context.env.ASSETS.fetch(new Request(assetUrl.toString(), { method: 'GET' }))
    : await fetch(assetUrl.toString());
  if (!res.ok) throw new Error(`Failed to load ${pathname}: ${res.status}`);
  return res.json();
};

export const loadSiteBundle = async (context) => {
  const [postsData, issuesData, siteData] = await Promise.all([
    fetchStaticJson(context, '/posts/posts.json'),
    fetchStaticJson(context, '/posts/issues.json').catch(() => ({ issues: [] })),
    fetchStaticJson(context, '/posts/site.json').catch(() => ({})),
  ]);

  const posts = (postsData.items || postsData || []).slice();
  posts.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  return {
    posts,
    issues: Array.isArray(issuesData.issues) ? issuesData.issues.slice() : [],
    site: siteData || {},
  };
};

const fallbackSiteName = (site) => normalizeText(site.siteName, { allowPlaceholder: true }) || 'CRIVU';

const fallbackFooter = (site) => normalizeText(site.footerText, { allowPlaceholder: true }) || `© ${new Date().getFullYear()} ${fallbackSiteName(site)}`;

const navHtml = (site, currentPath) => renderNavItems(Array.isArray(site.nav) && site.nav.length > 0 ? site.nav : DEFAULT_NAV, currentPath, {});

const scriptTag = (src) => (src ? `\n  <script src="${escapeHtml(src)}?v=${BUILD_VERSION}" type="module"></script>` : '');

const shell = ({ bodyClass = '', currentPath, description, mainHtml, scriptSrc, site, title }) => {
  const siteName = fallbackSiteName(site);
  const footerText = fallbackFooter(site);
  const searchPlaceholder = normalizeText(site.searchPlaceholder) || '搜尋';

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="build-version" content="${BUILD_VERSION}" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="stylesheet" href="/assets/css/style.css?v=${BUILD_VERSION}" />
  <link rel="icon" href="/assets/img/favicon.png" type="image/png" />
</head>
<body${bodyClass ? ` class="${escapeHtml(bodyClass)}"` : ''}>
  <header class="site-header">
    <a class="logo" id="siteName" href="/">${escapeHtml(siteName)}</a>
    <nav class="nav">
      ${navHtml(site, currentPath)}
    </nav>
    <div class="header-actions">
      <div class="search-box">
        <input id="searchInput" class="search-input" type="search" placeholder="${escapeHtml(searchPlaceholder)}" />
        <div id="searchResults" class="search-results"></div>
      </div>
      <button class="mobile-search-toggle" id="mobileSearchBtn" aria-label="搜尋">🔍</button>
      <button class="mobile-menu-toggle" id="mobileMenuBtn" aria-label="展開選單">☰</button>
    </div>
  </header>

  ${mainHtml}

  <footer class="site-footer">
    <div id="siteFooterText">${escapeHtml(footerText)}</div>
  </footer>${scriptTag(scriptSrc)}
</body>
</html>`;
};

const renderPostCard = (post, site) => {
  const maxTags = Math.max(1, Math.min(10, Number.parseInt(site.maxTagsPerCard, 10) || 3));
  const tags = Array.isArray(post.tags) ? post.tags.slice(0, maxTags) : [];
  const metaBits = [
    post.category ? `<span class="pill">${escapeHtml(post.category)}</span>` : '',
    post.issue ? `<span class="issue-pill">${escapeHtml(post.issue)}</span>` : '',
    ...tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`),
    post.date ? `<small>${escapeHtml(post.date)}</small>` : '',
  ].filter(Boolean);
  const href = articlePath(post.slug);
  const excerpt = buildDescription(post, 72);
  return `
    <article class="post-card">
      <a class="image" href="${escapeHtml(href)}"><img src="${escapeHtml(safeCoverUrl(post.cover))}" alt="${escapeHtml(post.title || '')}" loading="lazy" /></a>
      <div class="content">
        <div class="card-meta">${metaBits.join('')}</div>
        <h3><a href="${escapeHtml(href)}">${escapeHtml(post.title || '')}</a></h3>
        ${excerpt ? `<p>${escapeHtml(excerpt)}</p>` : ''}
      </div>
    </article>
  `;
};

const renderIssueCard = (issue, posts, site) => {
  const linkedSlugs = Array.isArray(issue.posts)
    ? issue.posts
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item.slug === 'string') return item.slug;
          return '';
        })
        .filter(Boolean)
    : [];
  const linkedPosts = linkedSlugs.map((slug) => posts.find((post) => post.slug === slug)).filter(Boolean);
  const leadPost = linkedPosts[0];
  const leadHref = leadPost ? articlePath(leadPost.slug) : '/articles.html';
  const postCards = linkedPosts
    .map(
      (post) => `
        <a class="issue-post" href="${escapeHtml(articlePath(post.slug))}">
          <span>${escapeHtml(post.title || '')}</span>
          <small>${escapeHtml(post.category || '')}</small>
        </a>
      `
    )
    .join('');
  const countTemplate = normalizeText(site.issueCountTemplate) || '收錄 {count} 篇文章';
  const note = normalizeText(issue.editorNote, { allowPlaceholder: true });

  return `
    <article class="issue-card">
      <div class="issue-book-visual">
        <a class="issue-book-link" href="${escapeHtml(leadHref)}" aria-label="${escapeHtml(issue.title || '')}">
          <div class="issue-book-object">
            <div class="issue-book-spine"></div>
            <div class="issue-cover">
              <img class="issue-cover-image" src="${escapeHtml(safeCoverUrl(issue.cover))}" alt="${escapeHtml(issue.title || '')}" loading="lazy" />
              <div class="issue-cover-copy">
                <div class="book-kicker">Issue ${escapeHtml(issue.id || '')}</div>
                <h2>${escapeHtml(issue.title || '')}</h2>
                <p>${escapeHtml(issue.theme || '')}</p>
              </div>
            </div>
            <div class="issue-book-shadow"></div>
          </div>
        </a>
      </div>
      <div class="issue-body">
        <div class="issue-meta">
          <span class="pill">${escapeHtml(issue.id || '')}</span>
          <span class="issue-date">${escapeHtml(issue.publishDate || '')}</span>
        </div>
        <h2>${escapeHtml(issue.title || '')}</h2>
        <p>${escapeHtml(issue.theme || '')}</p>
        <div class="issue-count">${escapeHtml(countTemplate.replace('{count}', String(linkedPosts.length)))}</div>
        ${note ? `<div class="issue-note">${escapeHtml(note)}</div>` : ''}
        <div class="issue-actions">
          <a class="issue-link" href="${escapeHtml(leadHref)}">${escapeHtml(normalizeText(site.issueReadLabel) || '閱讀首篇')}</a>
        </div>
        <details class="issue-expand"${site.issueDetailsOpen ? ' open' : ''}>
          <summary>${escapeHtml(normalizeText(site.issueExpandLabel) || '查看收錄文章')}</summary>
          <div class="issue-posts">${postCards || `<div class="issue-post">${escapeHtml(normalizeText(site.issueEmptyText) || '暫無文章')}</div>`}</div>
        </details>
      </div>
    </article>
  `;
};

const renderFilterOptions = (items, allLabel) =>
  [allLabel, ...items]
    .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
    .join('');

export const renderHomePage = ({ issues, posts, site }) => {
  const featuredIssueId = String(site.homeFeaturedIssueId || '').trim();
  const featuredIssue = issues.find((issue) => issue.id === featuredIssueId) || issues.find((issue) => issue.id === 'jq01') || issues[0] || null;
  const featuredPost = featuredIssue
    ? posts.find((post) => Array.isArray(featuredIssue.posts) && featuredIssue.posts.includes(post.slug))
    : posts[0] || null;
  const heroImage = safeCoverUrl(site.homeHeroImage || featuredPost?.cover || featuredIssue?.cover);
  const issueCover = safeCoverUrl(featuredIssue?.cover || heroImage);
  const latestPosts = posts.slice(0, 12);
  const categories = Array.from(new Set(posts.map((post) => post.category).filter(Boolean)));
  const tags = Array.from(new Set(posts.flatMap((post) => (Array.isArray(post.tags) ? post.tags : [])).filter(Boolean)));
  const creditLines = [
    normalizeText(site.homeHeroCreditLine1, { allowPlaceholder: true }),
    normalizeText(site.homeHeroCreditLine2, { allowPlaceholder: true }),
  ].filter(Boolean);

  const mainHtml = `<main>
    <section class="hero hero-magazine" id="homeHero">
      <div class="hero-backdrop" id="homeHeroBackdrop">
        <img id="homeHeroBackdropImage" class="hero-backdrop-image" src="${escapeHtml(heroImage)}" alt="" />
      </div>
      <div class="hero-frame${!(normalizeText(site.homeKicker) || normalizeText(site.homeTitle) || normalizeText(site.homeSubtitle)) ? ' hero-frame--book-only' : ''}">
        <div class="hero-copy"${!(normalizeText(site.homeKicker) || normalizeText(site.homeTitle) || normalizeText(site.homeSubtitle)) ? ' hidden' : ''}>
          <p class="kicker" id="homeKicker"${normalizeText(site.homeKicker) ? '' : ' hidden'}>${escapeHtml(normalizeText(site.homeKicker))}</p>
          <h1 id="homeTitle"${normalizeText(site.homeTitle) ? '' : ' hidden'}>${escapeHtml(normalizeText(site.homeTitle))}</h1>
          <p class="subtitle" id="homeSubtitle"${normalizeText(site.homeSubtitle) ? '' : ' hidden'}>${escapeHtml(normalizeText(site.homeSubtitle))}</p>
          <div class="hero-cta">
            <a class="btn" id="homeLatestButton" href="#latest">${escapeHtml(normalizeText(site.homeLatestButtonText) || '最新文章')}</a>
          </div>
          <p class="hero-note" id="homeHeroNote" hidden></p>
        </div>
        <aside class="hero-book">
          <a class="book-link" id="homeIssueLink" href="/issues.html" aria-label="查看推薦期刊">
            <div class="book-object">
              <div class="book-spine"></div>
              <div class="book-cover" id="homeIssueCover">
                <img id="homeIssueCoverImage" class="book-cover-image" src="${escapeHtml(issueCover)}" alt="" />
                <div class="book-cover-copy">
                  <div class="book-kicker" id="homeIssueKicker">${escapeHtml(normalizeText(site.homeIssueKicker) || 'Featured Issue')}</div>
                  <h2 id="homeIssueTitle">${escapeHtml(featuredIssue?.title || '')}</h2>
                  <p id="homeIssueMeta">${escapeHtml([featuredIssue?.theme, featuredIssue?.publishDate].filter(Boolean).join(' · '))}</p>
                </div>
              </div>
              <div class="book-shadow"></div>
            </div>
          </a>
        </aside>
      </div>
      <div class="hero-credit" id="homeHeroCredit"${creditLines.length > 0 ? '' : ' hidden'}>${creditLines.map((line) => `<span>${escapeHtml(line)}</span>`).join('')}</div>
    </section>

    <section id="latest" class="latest latest-list">
      <div class="section-title">
        <div>
          <h2 id="latestTitle">${escapeHtml(normalizeText(site.latestTitle) || '最新文章')}</h2>
          <p id="latestIntro">${escapeHtml(normalizeText(site.latestIntro) || '按時間展開近期更新。')}</p>
        </div>
        <div class="filters">
          <select id="categoryFilter" aria-label="分類篩選">${renderFilterOptions(categories, normalizeText(site.allCategoryLabel) || '全部分類')}</select>
          <select id="tagFilter" aria-label="標籤篩選">${renderFilterOptions(tags, normalizeText(site.allTagLabel) || '全部標籤')}</select>
        </div>
      </div>
      <div id="postGrid" class="post-grid list-mode">${latestPosts.map((post) => renderPostCard(post, site)).join('')}</div>
    </section>
  </main>`;

  return shell({
    bodyClass: 'home-page',
    currentPath: '/',
    description: normalizeText(site.homeSubtitle) || normalizeText(site.latestIntro) || 'CRIVU',
    mainHtml,
    scriptSrc: '/assets/js/app.js',
    site,
    title: fallbackSiteName(site),
  });
};

export const renderArticlesPage = ({ posts, site }) => {
  const categories = Array.from(new Set(posts.map((post) => post.category).filter(Boolean)));
  const tags = Array.from(new Set(posts.flatMap((post) => (Array.isArray(post.tags) ? post.tags : [])).filter(Boolean)));
  const mainHtml = `<main class="list-page">
    <section class="section-title">
      <div>
        <h1 id="articlesPageTitle">${escapeHtml(normalizeText(site.articlesPageTitle) || '文章')}</h1>
        <p id="articlesPageIntro">${escapeHtml(normalizeText(site.articlesPageIntro) || '按時間順序閱讀全部文章。')}</p>
      </div>
      <div class="filters">
        <select id="categoryFilter" aria-label="分類篩選">${renderFilterOptions(categories, normalizeText(site.allCategoryLabel) || '全部分類')}</select>
        <select id="tagFilter" aria-label="標籤篩選">${renderFilterOptions(tags, normalizeText(site.allTagLabel) || '全部標籤')}</select>
      </div>
    </section>
    <div id="postGrid" class="post-grid list-mode">${posts.map((post) => renderPostCard(post, site)).join('')}</div>
  </main>`;

  return shell({
    currentPath: '/articles.html',
    description: normalizeText(site.articlesPageIntro) || '按時間順序閱讀 CRIVU 的全部文章。',
    mainHtml,
    scriptSrc: '/assets/js/app.js',
    site,
    title: `文章 · ${fallbackSiteName(site)}`,
  });
};

export const renderIssuesPage = ({ issues, posts, site }) => {
  const mainHtml = `<main class="issues-page">
    <section class="section-title">
      <div>
        <h1 id="issuesPageTitle">${escapeHtml(normalizeText(site.issuesPageTitle) || '期刊')}</h1>
        <p id="issuesPageIntro">${escapeHtml(normalizeText(site.issuesPageIntro) || '以期刊方式編排主題與收錄文章。')}</p>
      </div>
    </section>
    <div id="issuesGrid" class="issues-grid">${issues.map((issue) => renderIssueCard(issue, posts, site)).join('')}</div>
  </main>`;

  return shell({
    bodyClass: 'page-issues',
    currentPath: '/issues.html',
    description: normalizeText(site.issuesPageIntro) || '以期刊方式整理主題、編者語與收錄文章。',
    mainHtml,
    scriptSrc: '/assets/js/issues.js',
    site,
    title: `期刊 · ${fallbackSiteName(site)}`,
  });
};

export const renderAboutPage = ({ site }) => {
  const aboutKicker = normalizeText(site.aboutKicker) || 'About';
  const aboutTitle = normalizeText(site.aboutTitle) || '關於';
  const aboutIntro =
    normalizeText(site.aboutIntro) ||
    '我是CRIVU。這個網站是我的個人博客：把日常裡的靈感、技術實作、旅途見聞與閱讀思考等，整理成一期一期的內容。';
  const aboutStyle = normalizeText(site.aboutStyle);
  const aboutInfoTitle = normalizeText(site.aboutInfoTitle);
  const aboutCity = normalizeText(site.city);
  const aboutEmail = normalizeText(site.email, { allowPlaceholder: true });
  const aboutTopics = normalizeText(site.topics);
  const validEmail = isValidEmail(aboutEmail);
  const facts = [
    aboutCity
      ? `<li class="about-fact"><div class="meta-label">${escapeHtml(normalizeText(site.aboutCityLabel) || '城市')}</div><div class="meta-value">${escapeHtml(aboutCity)}</div></li>`
      : '',
    validEmail
      ? `<li class="about-fact"><div class="meta-label">${escapeHtml(normalizeText(site.aboutEmailLabel) || 'Email')}</div><div class="meta-value">${escapeHtml(aboutEmail)}</div></li>`
      : '',
    aboutTopics
      ? `<li class="about-fact"><div class="meta-label">${escapeHtml(normalizeText(site.aboutTopicsLabel) || '主題')}</div><div class="meta-value">${escapeHtml(aboutTopics)}</div></li>`
      : '',
  ].filter(Boolean);
  const mailLink = validEmail
    ? `<a class="about-mail" href="${escapeHtml(sanitizeUrl(`mailto:${aboutEmail}`))}">${escapeHtml(normalizeText(site.aboutMailLabel) || '聯絡我')}</a>`
    : '';

  const asideHtml =
    facts.length > 0 || mailLink || aboutInfoTitle
      ? `
      <aside class="about-card about-side">
        ${aboutInfoTitle ? `<h2>${escapeHtml(aboutInfoTitle)}</h2>` : ''}
        ${facts.length > 0 ? `<ul class="about-facts">${facts.join('')}</ul>` : ''}
        ${mailLink}
      </aside>`
      : '';

  const mainHtml = `<main class="about">
    <section class="about-shell">
      <article class="about-card about-main">
        <p class="about-kicker">${escapeHtml(aboutKicker)}</p>
        <h1>${escapeHtml(aboutTitle)}</h1>
        <p class="about-lead">${escapeHtml(aboutIntro)}</p>
        ${aboutStyle ? `<p class="about-detail">${escapeHtml(aboutStyle)}</p>` : ''}
      </article>${asideHtml}
    </section>
  </main>`;

  return shell({
    currentPath: '/about.html',
    description: aboutIntro,
    mainHtml,
    scriptSrc: '/assets/js/app.js',
    site,
    title: `關於 · ${fallbackSiteName(site)}`,
  });
};
