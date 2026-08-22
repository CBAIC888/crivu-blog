let pages = [];
fetch('/api/v1/articles?limit=200')
  .then((response) => response.ok ? response.json() : [])
  .then((data) => { pages = (data.items || []).map((item) => ({ ...item, kind: item.type === 'script' ? '劇本' : item.type === 'research' ? '研究' : '一般', date: item.publishedAt || '', excerpt: item.summary || '', href: '/articles/' + item.slug })); })
  .catch(() => {});

const current = document.body.dataset.current || '';
const pageLanguage = document.body.dataset.language || 'zh';
const escapeHtml = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const nav = [
  ['articles', pageLanguage === 'en' ? 'Articles' : '全部', '/articles'],
  ['issues', pageLanguage === 'en' ? 'Journals' : '期刊', '/issues'],
  ['records', pageLanguage === 'en' ? 'Records' : '紀錄', '/records'],
  ['about', pageLanguage === 'en' ? 'About' : '關於', '/about'],
  ['rss', 'RSS', '/rss.xml'],
];

const icon = (name) => name === 'search'
  ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>'
  : name === 'theme'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20 15.2A8.2 8.2 0 1 1 8.8 4a7 7 0 0 0 11.2 11.2Z"/></svg>'
    : '';

document.body.insertAdjacentHTML('afterbegin', `
  <header class="site-header">
    <div class="site-header__inner">
      <nav class="site-nav" id="siteNav">${nav.map(([id, label, href]) => `<a class="${current === id ? 'active' : ''} ${id === 'rss' ? 'nav-rss' : ''}" href="${href}">${label}</a>`).join('')}</nav>
      <div class="header-tools">
        <button class="icon-button" data-search-open aria-label="${pageLanguage === 'en' ? 'Search' : '搜尋'}">${icon('search')}</button>
        <button class="icon-button" data-theme-toggle aria-label="${pageLanguage === 'en' ? 'Change background' : '切換背景'}">${icon('theme')}</button>
      </div>
    </div>
  </header>`);

document.body.insertAdjacentHTML('beforeend', `
  <footer class="site-footer">© 2026 CRIVU</footer>
  <div class="search-layer" id="searchLayer" aria-hidden="true">
    <div class="search-panel">
      <div class="search-top">
        <input id="siteSearch" type="search" placeholder="${pageLanguage === 'en' ? 'Search' : '搜尋'}" autocomplete="off" aria-label="${pageLanguage === 'en' ? 'Search articles' : '搜尋文章'}" />
        <button class="icon-button" data-search-close aria-label="${pageLanguage === 'en' ? 'Close' : '關閉'}">×</button>
      </div>
      <div class="search-results" id="searchResults"></div>
    </div>
  </div>`);

const root = document.documentElement;
const themes = ['paper', 'white', 'dark'];
document.querySelector('[data-theme-toggle]').addEventListener('click', () => {
  const currentTheme = themes.includes(root.dataset.theme) ? root.dataset.theme : 'paper';
  const next = themes[(themes.indexOf(currentTheme) + 1) % themes.length];
  root.dataset.theme = next;
  localStorage.setItem('crivu-theme', next);
});
const storedTheme = localStorage.getItem('crivu-theme');
root.dataset.theme = themes.includes(storedTheme) ? storedTheme : 'paper';

const layer = document.getElementById('searchLayer');
const searchInput = document.getElementById('siteSearch');
const results = document.getElementById('searchResults');
const closeSearch = () => {
  layer.classList.remove('is-open');
  layer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('is-locked');
};
document.querySelector('[data-search-open]').addEventListener('click', () => {
  layer.classList.add('is-open');
  layer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('is-locked');
  requestAnimationFrame(() => searchInput.focus());
});
document.querySelector('[data-search-close]').addEventListener('click', closeSearch);
layer.addEventListener('click', (event) => { if (event.target === layer) closeSearch(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeSearch(); });
searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim().toLowerCase();
  const matches = query ? pages.filter((page) => `${page.kind}${page.title}${page.excerpt}${page.searchText || ''}`.toLowerCase().includes(query)).slice(0, 12) : [];
  results.innerHTML = matches.map((page) => `<a class="search-result" href="${escapeHtml(page.href)}"><small>${escapeHtml(page.kind)} · ${escapeHtml(page.date)}</small><br>${escapeHtml(page.title)}</a>`).join('') || (query ? `<p class="muted">${pageLanguage === 'en' ? 'No matching results.' : '沒有找到相符內容。'}</p>` : '');
});

document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('is-active', item === button));
    const value = button.dataset.filter;
    document.querySelectorAll('[data-kind]').forEach((entry) => { entry.hidden = value !== '全部' && entry.dataset.kind !== value; });
    document.querySelectorAll('.year-group').forEach((group) => {
      group.hidden = !Array.from(group.querySelectorAll('[data-kind]')).some((entry) => !entry.hidden);
    });
  });
});

const researchContent = document.querySelector('[data-research-content]');
if (researchContent) enhanceResearchArticle(researchContent);

function enhanceResearchArticle(container) {
  const noteSection = container.querySelector('#article-notes');
  if (noteSection) noteSection.hidden = true;

  const noteOccurrences = new Map();
  const references = [...container.querySelectorAll('.note-ref')];
  const referenceIds = new Set(references.map((reference) => reference.getAttribute('href')?.slice(1)).filter(Boolean));
  references.forEach((reference) => {
    const target = container.querySelector(reference.getAttribute('href'));
    if (!target) return;
    const occurrence = (noteOccurrences.get(target.id) || 0) + 1;
    noteOccurrences.set(target.id, occurrence);
    const occurrenceSuffix = occurrence === 1 ? '' : `-${occurrence}`;
    const note = document.createElement('span');
    note.className = 'marginnote';
    note.id = `${target.id}-margin${occurrenceSuffix}`;
    note.innerHTML = target.innerHTML;
    note.querySelector('.note-number')?.remove();
    reference.id = `note-ref-${target.id.replace('note-', '')}${occurrenceSuffix}`;
    const noteBody = document.createElement('span');
    noteBody.className = 'marginnote-body';
    while (note.firstChild) noteBody.appendChild(note.firstChild);
    note.appendChild(noteBody);
    note.insertAdjacentHTML('afterbegin', `<a class="marginnote-mark" href="#${reference.id}" aria-label="${pageLanguage === 'en' ? 'Return to text' : '返回正文'}">${reference.textContent.trim()}</a>`);
    reference.insertAdjacentElement('afterend', note);
    reference.setAttribute('role', 'button');
    reference.setAttribute('aria-controls', note.id);
    reference.setAttribute('aria-expanded', 'false');
    let isPinned = false;
    const setPairActive = (active) => {
      const highlighted = active || isPinned;
      reference.classList.toggle('is-highlighted', highlighted);
      note.classList.toggle('is-highlighted', highlighted);
    };
    reference.addEventListener('mouseenter', () => setPairActive(true));
    reference.addEventListener('mouseleave', () => setPairActive(false));
    reference.addEventListener('focus', () => setPairActive(true));
    reference.addEventListener('blur', () => setPairActive(false));
    note.addEventListener('mouseenter', () => setPairActive(true));
    note.addEventListener('mouseleave', () => setPairActive(false));
    note.addEventListener('focusin', () => setPairActive(true));
    note.addEventListener('focusout', () => setPairActive(false));
    reference.addEventListener('click', (event) => {
      event.preventDefault();
      if (window.matchMedia('(max-width: 760px)').matches) {
        note.classList.toggle('is-expanded');
        reference.setAttribute('aria-expanded', String(note.classList.contains('is-expanded')));
      }
      isPinned = !isPinned;
      setPairActive(false);
      note.scrollIntoView({ block: 'center', behavior: 'smooth' });
      history.replaceState(null, '', `#${note.id}`);
    });
    note.querySelector('.marginnote-mark')?.addEventListener('click', (event) => {
      event.preventDefault();
      isPinned = !isPinned;
      setPairActive(false);
      reference.scrollIntoView({ block: 'center', behavior: 'smooth' });
      reference.focus({ preventScroll: true });
      history.replaceState(null, '', `#${reference.id}`);
    });
  });
  container.querySelectorAll('#article-notes .note').forEach((note) => {
    if (!referenceIds.has(note.id)) {
      note.hidden = false;
      container.querySelector('#article-notes').hidden = false;
    }
  });

  container.querySelectorAll('.research-figure').forEach((figure) => figure.remove());
  /* Research articles remain text-first. The image archive lives on its own dark gallery page. */
}
