import { applyAdaptivePalette, getFeaturedPaletteSource } from './palette.js';
import {
  articlePath,
  buildDescription,
  escapeHtml,
  isValidEmail,
  normalizeText,
  renderNavItems,
  safeCoverUrl,
  sanitizeUrl,
} from '../../shared/content.js';

const state = {
  posts: [],
  issues: [],
  site: {},
  search: '',
  currentCategory: '',
  currentTag: '',
  applyHome: null,
  applyCategory: null,
  applyTag: null,
};

const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));

const setText = (sel, value) => {
  const el = qs(sel);
  if (el && value !== undefined && value !== null && value !== '') el.textContent = value;
};

const toInt = (value, fallback, min, max) => {
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, num));
};

const revealSiteContent = () => {
  document.body.classList.remove('site-loading');
};

const loadPosts = async () => {
  const res = await fetch('/posts/posts.json');
  const data = await res.json();
  state.posts = (data.items || data).slice();
  state.posts.sort((a, b) => b.date.localeCompare(a.date));
};

const loadSite = async () => {
  try {
    const res = await fetch('/posts/site.json');
    if (!res.ok) return;
    state.site = await res.json();
  } catch {
    state.site = {};
  }
};

const loadIssues = async () => {
  try {
    const res = await fetch('/posts/issues.json');
    if (!res.ok) return;
    const data = await res.json();
    state.issues = Array.isArray(data.issues) ? data.issues.slice() : [];
  } catch {
    state.issues = [];
  }
};

const applySiteSettings = () => {
  const site = state.site;
  qsa('#siteName').forEach((el) => {
    if (site.siteName) el.textContent = site.siteName;
  });
  qsa('#siteFooterText').forEach((el) => {
    if (site.footerText) el.textContent = site.footerText;
  });

  setText('#homeKicker', site.homeKicker);
  setText('#homeTitle', site.homeTitle);
  setText('#homeSubtitle', site.homeSubtitle);
  setText('#homeLatestButton', site.homeLatestButtonText);
  setText('#homeIssueKicker', site.homeIssueKicker);
  setText('#latestTitle', site.latestTitle);
  setText('#latestIntro', site.latestIntro);
  setText('#articlesPageTitle', site.articlesPageTitle);
  setText('#articlesPageIntro', site.articlesPageIntro);
  setText('#issuesPageTitle', site.issuesPageTitle);
  setText('#issuesPageIntro', site.issuesPageIntro);
  setText('#aboutKicker', site.aboutKicker);
  setText('#aboutTitle', site.aboutTitle);
  setText('#aboutIntro', site.aboutIntro);
  setText('#aboutStyle', site.aboutStyle);
  setText('#aboutInfoTitle', site.aboutInfoTitle);
  setText('#aboutMailLink', site.aboutMailLabel);
  setText('#aboutTopics', normalizeText(site.topics));
  setText('#aboutTopicsLabel', site.aboutTopicsLabel);

  const aboutCity = normalizeText(site.city);
  const aboutCityItem = qs('#aboutCityItem');
  if (aboutCityItem) {
    aboutCityItem.hidden = !aboutCity;
  }
  if (aboutCity) {
    setText('#aboutCity', aboutCity);
    setText('#aboutCityLabel', site.aboutCityLabel);
  }

  const aboutEmail = normalizeText(site.email, { allowPlaceholder: true });
  const validEmail = isValidEmail(aboutEmail);
  const aboutEmailItem = qs('#aboutEmailItem');
  if (aboutEmailItem) {
    aboutEmailItem.hidden = !validEmail;
  }
  if (validEmail) {
    setText('#aboutEmail', aboutEmail);
    setText('#aboutEmailLabel', site.aboutEmailLabel);
  }

  const aboutTopicsItem = qs('#aboutTopicsItem');
  if (aboutTopicsItem) {
    aboutTopicsItem.hidden = !normalizeText(site.topics);
  }

  const mailLink = qs('#aboutMailLink');
  if (mailLink) {
    mailLink.hidden = !validEmail;
    if (validEmail) {
      mailLink.setAttribute('href', sanitizeUrl(`mailto:${aboutEmail}`));
    }
  }

  qsa('#searchInput').forEach((input) => {
    if (site.searchPlaceholder) input.setAttribute('placeholder', site.searchPlaceholder);
  });

  const root = document.documentElement;
  root.style.setProperty('--home-cols', String(toInt(site.homeCardsDesktop, 3, 1, 4)));
  root.style.setProperty('--list-cols', String(toInt(site.articleCardsDesktop, 3, 1, 4)));
};

const getFeaturedIssue = () => {
  if (!Array.isArray(state.issues) || state.issues.length === 0) return null;
  const preferredId = String(state.site.homeFeaturedIssueId || '').trim();
  if (preferredId) {
    const matched = state.issues.find((issue) => issue.id === preferredId);
    if (matched) return matched;
  }
  return state.issues.find((issue) => issue.id === 'jq01') || state.issues[0];
};

const applyHomeFeature = async () => {
  const hero = qs('#homeHero');
  if (!hero) return null;

  const featuredIssue = getFeaturedIssue();
  const featuredPost =
    featuredIssue && Array.isArray(featuredIssue.posts)
      ? state.posts.find((post) => featuredIssue.posts.includes(post.slug))
      : null;

  const backdrop = qs('#homeHeroBackdrop');
  const issueLink = qs('#homeIssueLink');
  const issueCover = qs('#homeIssueCover');
  const issueTitle = qs('#homeIssueTitle');
  const issueMeta = qs('#homeIssueMeta');
  const heroNote = qs('#homeHeroNote');
  const heroCredit = qs('#homeHeroCredit');

  const backgroundImage = safeCoverUrl(state.site.homeHeroImage || getFeaturedPaletteSource(state.posts, state.issues, undefined));
  const coverImage = safeCoverUrl((featuredIssue && featuredIssue.cover) || backgroundImage);

  if (backdrop) {
    backdrop.setAttribute('data-bg', backgroundImage);
    backdrop.dataset.bgLoaded = '0';
  }
  if (issueCover) {
    issueCover.setAttribute('data-bg', coverImage);
    issueCover.dataset.bgLoaded = '0';
  }
  if (issueLink) {
    issueLink.setAttribute('href', '/issues.html');
  }
  if (issueTitle && featuredIssue) {
    issueTitle.textContent = featuredIssue.title || '新刊';
  }
  if (issueMeta && featuredIssue) {
    issueMeta.textContent = [featuredIssue.theme, featuredIssue.publishDate].filter(Boolean).join(' · ');
  }
  if (heroNote) {
    heroNote.textContent = '';
    heroNote.hidden = true;
  }
  if (heroCredit) {
    const creditLine1 =
      state.site.homeHeroCreditLine1 ||
      (featuredPost ? `本期預覽：${featuredPost.title}${featuredPost.category ? ` · ${featuredPost.category}` : ''}` : '本期預覽');
    const creditLine2 = state.site.homeHeroCreditLine2 || '背景圖目前使用站內素材，後續可替換為你提供的定尺寸圖片';
    heroCredit.innerHTML = `<span>${escapeHtml(creditLine1)}</span><span>${escapeHtml(creditLine2)}</span>`;
  }

  if (featuredIssue || state.site.homeKicker || state.site.homeTitle || state.site.homeSubtitle) {
    setText('#homeKicker', state.site.homeKicker || (featuredIssue && featuredIssue.id) || '新刊');
    setText('#homeTitle', state.site.homeTitle || (featuredIssue && featuredIssue.title) || '首頁');
    setText(
      '#homeSubtitle',
      state.site.homeSubtitle ||
        `${(featuredIssue && featuredIssue.theme) || ''}${featuredIssue && featuredIssue.theme ? '，' : ''}${featuredPost ? featuredPost.title : '循着时序更迭的脚步，于文字间细数四季风物。'}`
    );
  }

  await applyAdaptivePalette(backgroundImage);
  initLazyBackgrounds(hero);
  return backgroundImage;
};

const applyNavigation = (site) => {
  const nav = qs('.nav');
  if (!nav || !Array.isArray(site.nav) || site.nav.length === 0) return;

  const currentPath = window.location.pathname.replace(/\/index\.html$/, '/') || '/';
  const items = renderNavItems(site.nav, currentPath, { baseOrigin: window.location.origin });
  if (items) nav.innerHTML = items;
};

const setupHeaderOffset = () => {
  const header = qs('.site-header');
  if (!header) return;

  const apply = () => {
    const height = header.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--header-height', `${height}px`);
  };

  apply();
  window.addEventListener('resize', apply);
};

const initLazyBackgrounds = (root = document) => {
  const nodes = Array.from(root.querySelectorAll('[data-bg]'));
  if (nodes.length === 0) return;

  const applyBg = (node) => {
    if (node.dataset.bgLoaded === '1') return;
    const src = node.getAttribute('data-bg');
    if (!src) return;
    node.style.backgroundImage = `url('${safeCoverUrl(src)}')`;
    node.dataset.bgLoaded = '1';
  };

  if (!('IntersectionObserver' in window)) {
    nodes.forEach(applyBg);
    return;
  }

  const io = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        applyBg(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '280px 0px' }
  );

  nodes.forEach((node) => io.observe(node));
};

const setupMobileSearch = () => {
  const btn = qs('#mobileSearchBtn');
  const header = qs('.site-header');
  const input = qs('#searchInput');
  if (!btn || !header || !input) return;

  btn.addEventListener('click', () => {
    header.classList.remove('mobile-menu-open');
    header.classList.toggle('mobile-search-open');
    if (header.classList.contains('mobile-search-open')) input.focus();
  });
};

const setupMobileMenu = () => {
  const btn = qs('#mobileMenuBtn');
  const header = qs('.site-header');
  const nav = qs('.nav');
  if (!btn || !header || !nav) return;

  btn.addEventListener('click', () => {
    header.classList.remove('mobile-search-open');
    header.classList.toggle('mobile-menu-open');
  });

  nav.addEventListener('click', (e) => {
    const target = e.target;
    if (target instanceof HTMLElement && target.closest('a')) {
      header.classList.remove('mobile-menu-open');
    }
  });

  document.addEventListener('click', (e) => {
    if (!header.contains(e.target)) {
      header.classList.remove('mobile-menu-open');
      header.classList.remove('mobile-search-open');
    }
  });
};

const renderCard = (post) => {
  const cover = safeCoverUrl(post.cover);
  const issue = post.issue ? `<span class="issue-pill">${escapeHtml(post.issue)}</span>` : '';
  const date = post.date ? `<small>${escapeHtml(post.date)}</small>` : '';
  const maxTags = toInt(state.site.maxTagsPerCard, 3, 1, 10);
  const safeTags = Array.isArray(post.tags) ? post.tags.slice(0, maxTags).map((tag) => escapeHtml(tag)) : [];
  const safeLink = articlePath(post.slug);
  const excerpt = buildDescription(post, 120);
  return `
    <article class="post-card">
      <a class="image lazy-bg" href="${escapeHtml(safeLink)}" data-bg="${escapeHtml(cover)}"></a>
      <div class="content">
        <div class="card-meta"><span class="pill">${escapeHtml(post.category)}</span>${issue}${date}</div>
        <h3><a href="${escapeHtml(safeLink)}">${escapeHtml(post.title)}</a></h3>
        ${excerpt ? `<p>${escapeHtml(excerpt)}</p>` : ''}
        <div class="tag-row">${safeTags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
      </div>
    </article>
  `;
};

const renderGrid = (el, posts) => {
  if (!el) return;
  el.innerHTML = posts.map(renderCard).join('');
  initLazyBackgrounds(el);
};

const matchesSearch = (post, query) => {
  if (!query) return true;
  const q = query.toLowerCase();
  const tags = Array.isArray(post.tags) ? post.tags : [];
  return (
    String(post.title || '').toLowerCase().includes(q) ||
    String(post.excerpt || '').toLowerCase().includes(q) ||
    String(post.category || '').toLowerCase().includes(q) ||
    tags.some((t) => String(t).toLowerCase().includes(q))
  );
};

const setupSearch = () => {
  const input = qs('#searchInput');
  const results = qs('#searchResults');
  if (!input || !results) return;

  const params = new URLSearchParams(window.location.search);
  const q = params.get('q') || '';
  input.value = q;
  state.search = q;

  const renderResults = () => {
    const query = state.search.trim();
    if (!query) {
      results.classList.remove('active');
      results.innerHTML = '';
      return;
    }

    const matches = state.posts.filter((p) => matchesSearch(p, query)).slice(0, 6);
    if (matches.length === 0) {
      results.classList.remove('active');
      results.innerHTML = '';
      return;
    }

    results.innerHTML = matches
      .map(
        (p) => `
          <a class="search-item" href="${escapeHtml(articlePath(p.slug))}">
            ${escapeHtml(p.title)}
            <small>${escapeHtml(p.category)} · ${escapeHtml((Array.isArray(p.tags) ? p.tags : []).join(' / '))}</small>
          </a>
        `
      )
      .join('');
    results.classList.add('active');
  };

  const applyAll = () => {
    if (state.applyHome) state.applyHome();
    if (state.applyCategory) state.applyCategory();
    if (state.applyTag) state.applyTag();
    renderResults();
  };

  input.addEventListener('input', () => {
    state.search = input.value.trim();
    applyAll();
  });

  input.addEventListener('focus', renderResults);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = results.querySelector('.search-item');
      if (first) window.location.href = first.getAttribute('href');
    }
  });

  document.addEventListener('click', (e) => {
    if (!results.contains(e.target) && e.target !== input) results.classList.remove('active');
  });

  renderResults();
};

const setupFilters = () => {
  const categoryFilter = qs('#categoryFilter');
  const tagFilter = qs('#tagFilter');
  const grid = qs('#postGrid');
  if (!categoryFilter || !tagFilter || !grid) return;

  const categories = Array.from(new Set(state.posts.map((p) => p.category).filter(Boolean)));
  const tags = Array.from(new Set(state.posts.flatMap((p) => (Array.isArray(p.tags) ? p.tags : [])).filter(Boolean)));

  const allCategoryLabel = state.site.allCategoryLabel || '全部分類';
  const allTagLabel = state.site.allTagLabel || '全部標籤';
  categoryFilter.innerHTML = [allCategoryLabel, ...categories]
    .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
    .join('');
  tagFilter.innerHTML = [allTagLabel, ...tags]
    .map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`)
    .join('');

  const apply = () => {
    const cat = categoryFilter.value;
    const tag = tagFilter.value;
    const filtered = state.posts.filter((p) => {
      const okCat = cat === allCategoryLabel || p.category === cat;
      const postTags = Array.isArray(p.tags) ? p.tags : [];
      const okTag = tag === allTagLabel || postTags.includes(tag);
      return okCat && okTag && matchesSearch(p, state.search);
    });
    renderGrid(grid, filtered);
  };

  categoryFilter.addEventListener('change', apply);
  tagFilter.addEventListener('change', apply);
  state.applyHome = apply;
  apply();
};

const setupCategoryPage = () => {
  const list = qs('#categoryList');
  const grid = qs('#categoryPosts');
  if (!list || !grid) return;

  const categories = Array.from(new Set(state.posts.map((p) => p.category).filter(Boolean)));
  list.innerHTML = categories
    .map((c) => `<button class="chip" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
    .join('');

  const renderCategory = (category) => {
    state.currentCategory = category;
    qsa('.chip').forEach((btn) => btn.classList.toggle('active', btn.dataset.cat === category));
    renderGrid(grid, state.posts.filter((p) => p.category === category && matchesSearch(p, state.search)));
  };

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    renderCategory(btn.dataset.cat);
  });

  if (categories.length > 0) renderCategory(categories[0]);
  state.applyCategory = () => {
    if (state.currentCategory) renderCategory(state.currentCategory);
  };
};

const setupTagPage = () => {
  const list = qs('#tagList');
  const grid = qs('#tagPosts');
  if (!list || !grid) return;

  const tags = Array.from(new Set(state.posts.flatMap((p) => (Array.isArray(p.tags) ? p.tags : [])).filter(Boolean)));
  list.innerHTML = tags
    .map((t) => `<button class="chip" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`)
    .join('');

  const renderTag = (tag) => {
    state.currentTag = tag;
    qsa('.chip').forEach((btn) => btn.classList.toggle('active', btn.dataset.tag === tag));
    renderGrid(
      grid,
      state.posts.filter((p) => {
        const postTags = Array.isArray(p.tags) ? p.tags : [];
        return postTags.includes(tag) && matchesSearch(p, state.search);
      })
    );
  };

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    renderTag(btn.dataset.tag);
  });

  if (tags.length > 0) renderTag(tags[0]);
  state.applyTag = () => {
    if (state.currentTag) renderTag(state.currentTag);
  };
};

const init = async () => {
  await Promise.all([loadPosts(), loadSite(), loadIssues()]);

  applySiteSettings();
  const featureImage = await applyHomeFeature();
  if (qs('#homeHero') && !featureImage && state.posts[0] && state.posts[0].cover) {
    await applyAdaptivePalette(safeCoverUrl(state.posts[0].cover));
  }
  applyNavigation(state.site);
  setupSearch();
  setupFilters();
  setupCategoryPage();
  setupTagPage();
  setupHeaderOffset();
  setupMobileSearch();
  setupMobileMenu();

  const grid = qs('#postGrid');
  if (grid && grid.childElementCount === 0) {
    renderGrid(grid, state.posts.filter((p) => matchesSearch(p, state.search)));
  }

  revealSiteContent();
};

init().catch(() => {
  revealSiteContent();
});
