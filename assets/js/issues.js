const qs = (sel) => document.querySelector(sel);

const state = {
  site: {},
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

const setupSearch = (posts) => {
  const input = qs('#searchInput');
  const results = qs('#searchResults');
  if (!input || !results) return;

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
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (!results.contains(e.target) && e.target !== input) {
      results.classList.remove('active');
    }
  });
};

const renderIssue = (issue, posts) => {
  const postCards = issue.posts
    .map((slug) => posts.find((p) => p.slug === slug))
    .filter(Boolean)
    .map(
      (post) => `
        <a class="issue-post" href="/post.html?slug=${post.slug}">
          <span>${post.title}</span>
          <small>${post.category}</small>
        </a>
      `
    )
    .join('');

  return `
    <article class="issue-card">
      <div class="issue-cover" style="background-image: url('${issue.cover}');"></div>
      <div class="issue-body">
        <div class="issue-meta">
          <span class="pill">${issue.id}</span>
          <span class="issue-date">${issue.publishDate}</span>
        </div>
        <h2>${issue.title}</h2>
        <p>${issue.theme}</p>
        <div class="issue-note">${issue.editorNote}</div>
        <div class="issue-count">收錄 ${issue.posts.length} 篇文章</div>
        <div class="issue-posts">${postCards}</div>
      </div>
    </article>
  `;
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

const loadSite = async () => {
  try {
    const res = await fetch('/posts/site.json');
    if (!res.ok) return;
    state.site = await res.json();
    setText('#siteName', state.site.siteName);
    setText('#siteFooterText', state.site.footerText);
  } catch {
    state.site = {};
  }
};

const init = async () => {
  const [issuesRes, postsRes] = await Promise.all([fetch('/posts/issues.json'), fetch('/posts/posts.json')]);
  const issuesData = await issuesRes.json();
  const postsData = await postsRes.json();
  const issues = issuesData.issues || [];
  const posts = postsData.items || postsData;

  const grid = qs('#issuesGrid');
  if (grid) {
    grid.innerHTML = issues.map((issue) => renderIssue(issue, posts)).join('');
  }

  setupSearch(posts);
  setupTheme();
  await loadSite();
};

init();
