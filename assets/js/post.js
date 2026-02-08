const qs = (sel) => document.querySelector(sel);

const getSlug = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('slug');
};

const formatDate = (iso) => {
  const [y, m, d] = iso.split('-');
  return `${y}/${m}/${d}`;
};

const setText = (sel, value) => {
  const el = qs(sel);
  if (el && value) el.textContent = value;
};

const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const icon = qs('#themeIcon');
  if (icon) icon.textContent = theme === 'dark' ? '☾' : '☀';
};

const renderMoreItem = (post) => {
  const cover = post.cover || '/assets/img/cover-01.svg';
  const issue = post.issue ? `<span class="issue-pill">${post.issue}</span>` : '';
  return `
    <a class="more-item" href="/post.html?slug=${post.slug}">
      <div class="more-thumb" style="background-image: url('${cover}');"></div>
      <div class="more-info">
        <span class="pill">${post.category}</span>${issue}
        <h3>${post.title}</h3>
        <p>${post.excerpt}</p>
      </div>
    </a>
  `;
};

const setupSearch = (posts) => {
  const input = qs('#searchInput');
  const results = qs('#searchResults');
  if (!input || !results) return;

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

  const renderResults = () => {
    const query = input.value.trim();
    if (!query) {
      results.classList.remove('active');
      results.innerHTML = '';
      return;
    }
    const matches = posts.filter((p) => matchesSearch(p, query)).slice(0, 6);
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

  input.addEventListener('input', renderResults);
  input.addEventListener('focus', renderResults);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = results.querySelector('.search-item');
      if (first) {
        window.location.href = first.getAttribute('href');
      } else {
        const q = encodeURIComponent(input.value.trim());
        window.location.href = q ? `/?q=${q}` : '/';
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (!results.contains(e.target) && e.target !== input) {
      results.classList.remove('active');
    }
  });
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

const applyProgress = () => {
  const progress = qs('#readProgress');
  if (!progress) return;

  const onScroll = () => {
    const doc = document.documentElement;
    const total = doc.scrollHeight - doc.clientHeight;
    const pct = total > 0 ? (doc.scrollTop / total) * 100 : 0;
    progress.style.width = `${pct}%`;
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
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

const applySite = async () => {
  try {
    const res = await fetch('/posts/site.json');
    if (!res.ok) return;
    const site = await res.json();
    setText('#siteName', site.siteName);
    setText('#siteFooterText', site.footerText);

    const nav = qs('.nav');
    if (nav && Array.isArray(site.nav) && site.nav.length > 0) {
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
    }
  } catch {
    // keep fallback text
  }
};

const init = async () => {
  const slug = getSlug();
  const res = await fetch('/posts/posts.json');
  const data = await res.json();
  const posts = data.items || data;
  const post = posts.find((p) => p.slug === slug) || posts[0];

  qs('#postTitle').textContent = post.title;
  qs('#postDate').textContent = formatDate(post.date);
  qs('#postCategory').textContent = post.category;

  const issue = qs('#postIssue');
  if (issue) {
    issue.textContent = post.issue || '';
    issue.style.display = post.issue ? 'inline-block' : 'none';
  }

  qs('#postExcerpt').textContent = post.excerpt;

  const tags = qs('#postTags');
  tags.innerHTML = post.tags.map((t) => `<span class="tag">${t}</span>`).join('');

  const cover = qs('#postCover');
  cover.style.backgroundImage = `url('${post.cover || '/assets/img/cover-01.svg'}')`;

  qs('#postBody').innerHTML = marked.parse(post.body || '');

  const more = posts.filter((p) => p.slug !== post.slug).slice(0, 4);
  const moreList = qs('#moreList');
  if (moreList) moreList.innerHTML = more.map(renderMoreItem).join('');

  setupSearch(posts);
  setupTheme();
  await applySite();
  setupHeaderOffset();
  applyProgress();
};

init();
