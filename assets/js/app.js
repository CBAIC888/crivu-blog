const state = {
  posts: [],
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

const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const icon = qs('#themeIcon');
  if (icon) icon.textContent = theme === 'dark' ? '☾' : '☀';
};

const setupTheme = () => {
  const toggle = qs('#themeToggle');
  if (!toggle) return;

  toggle.innerHTML = '<span id="themeIcon" class="theme-icon">☀</span>';

  const stored = localStorage.getItem('theme') || 'light';
  applyTheme(stored);

  toggle.addEventListener('click', () => {
    toggle.classList.remove('spin');
    void toggle.offsetWidth;
    toggle.classList.add('spin');
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });
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
  setText('#latestTitle', site.latestTitle);
  setText('#aboutTitle', site.aboutTitle);
  setText('#aboutIntro', site.aboutIntro);
  setText('#aboutStyle', site.aboutStyle);
  setText('#aboutCity', site.city);
  setText('#aboutEmail', site.email);
  setText('#aboutTopics', site.topics);
};

const applyNavigation = (site) => {
  const nav = qs('.nav');
  if (!nav || !Array.isArray(site.nav) || site.nav.length === 0) return;

  const currentPath = window.location.pathname.replace(/\/index\.html$/, '/') || '/';
  const items = site.nav
    .filter((item) => item && item.label && item.href)
    .map((item) => {
      const href = item.href;
      const normalized = href.replace(/\/index\.html$/, '/') || '/';
      const isHome = normalized === '/';
      const isActive = isHome ? currentPath === '/' : currentPath.startsWith(normalized);
      return `<a href="${href}"${isActive ? ' class="active"' : ''}>${item.label}</a>`;
    });

  if (items.length > 0) nav.innerHTML = items.join('');
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

const renderCard = (post) => {
  const cover = post.cover || '/assets/img/cover-01.svg';
  const issue = post.issue ? `<span class="issue-pill">${post.issue}</span>` : '';
  return `
    <article class="post-card">
      <a class="image" href="/post.html?slug=${post.slug}" style="background-image: url('${cover}');"></a>
      <div class="content">
        <span class="pill">${post.category}</span>${issue}
        <h3><a href="/post.html?slug=${post.slug}">${post.title}</a></h3>
        <p>${post.excerpt}</p>
        <div class="tag-row">${post.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
      </div>
    </article>
  `;
};

const renderGrid = (el, posts) => {
  if (!el) return;
  el.innerHTML = posts.map(renderCard).join('');
};

const matchesSearch = (post, query) => {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    post.title.toLowerCase().includes(q) ||
    post.excerpt.toLowerCase().includes(q) ||
    post.category.toLowerCase().includes(q) ||
    post.tags.some((t) => t.toLowerCase().includes(q))
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
          <a class="search-item" href="/post.html?slug=${p.slug}">
            ${p.title}
            <small>${p.category} · ${p.tags.join(' / ')}</small>
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

  const categories = Array.from(new Set(state.posts.map((p) => p.category)));
  const tags = Array.from(new Set(state.posts.flatMap((p) => p.tags)));

  categoryFilter.innerHTML = ['全部分類', ...categories].map((c) => `<option value="${c}">${c}</option>`).join('');
  tagFilter.innerHTML = ['全部標籤', ...tags].map((t) => `<option value="${t}">${t}</option>`).join('');

  const apply = () => {
    const cat = categoryFilter.value;
    const tag = tagFilter.value;
    const filtered = state.posts.filter((p) => {
      const okCat = cat === '全部分類' || p.category === cat;
      const okTag = tag === '全部標籤' || p.tags.includes(tag);
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

  const categories = Array.from(new Set(state.posts.map((p) => p.category)));
  list.innerHTML = categories.map((c) => `<button class="chip" data-cat="${c}">${c}</button>`).join('');

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

  const tags = Array.from(new Set(state.posts.flatMap((p) => p.tags)));
  list.innerHTML = tags.map((t) => `<button class="chip" data-tag="${t}">${t}</button>`).join('');

  const renderTag = (tag) => {
    state.currentTag = tag;
    qsa('.chip').forEach((btn) => btn.classList.toggle('active', btn.dataset.tag === tag));
    renderGrid(grid, state.posts.filter((p) => p.tags.includes(tag) && matchesSearch(p, state.search)));
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
  setupTheme();
  await Promise.all([loadPosts(), loadSite()]);

  applySiteSettings();
  applyNavigation(state.site);
  setupSearch();
  setupFilters();
  setupCategoryPage();
  setupTagPage();
  setupHeaderOffset();

  const grid = qs('#postGrid');
  if (grid && grid.childElementCount === 0) {
    renderGrid(grid, state.posts.filter((p) => matchesSearch(p, state.search)));
  }
};

init();
