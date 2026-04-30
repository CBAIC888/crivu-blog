export const FALLBACK_COVER = '/assets/img/cover-01.svg';
export const DEFAULT_SITE_ORIGIN = 'https://cbc688.com';
export const BUILD_VERSION_PLACEHOLDER = '__BUILD_VERSION__';

const PLACEHOLDER_PATTERNS = [
  /yourname/i,
  /your city/i,
  /你的城市/u,
  /hello@yourname\.com/i,
  /這裡是你的個人博客/u,
  /your-domain\.com/i,
];

const collapseWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const resolveBaseOrigin = (baseOrigin) => {
  const raw = collapseWhitespace(baseOrigin);
  if (!raw) return DEFAULT_SITE_ORIGIN;
  try {
    return new URL(raw).origin;
  } catch {
    return DEFAULT_SITE_ORIGIN;
  }
};

export const isPlaceholderText = (value) => {
  const text = collapseWhitespace(value);
  if (!text) return false;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text));
};

export const normalizeText = (value, options = {}) => {
  const { allowPlaceholder = false } = options;
  const text = collapseWhitespace(value);
  if (!text) return '';
  if (!allowPlaceholder && isPlaceholderText(text)) return '';
  return text;
};

export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeText(value, { allowPlaceholder: true }));

export const escapeHtml = (input) =>
  String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const sanitizeUrl = (value, options = {}) => {
  const { allowHash = true, baseOrigin = DEFAULT_SITE_ORIGIN } = options;
  const input = String(value ?? '').trim();
  if (!input) return '#';
  if (allowHash && input.startsWith('#')) return '#';
  if (input.startsWith('/') || input.startsWith('./') || input.startsWith('../')) return input;

  try {
    const parsed = new URL(input, resolveBaseOrigin(baseOrigin));
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:') return parsed.href;
  } catch {
    return '#';
  }

  return '#';
};

export const safeCoverUrl = (value, options = {}) => {
  const safe = sanitizeUrl(value, { allowHash: false, baseOrigin: options.baseOrigin });
  return safe === '#' ? FALLBACK_COVER : safe;
};

export const getBuildVersion = (doc = globalThis?.document) => {
  if (!doc || typeof doc.querySelector !== 'function') return '';
  const raw = doc.querySelector('meta[name="build-version"]')?.getAttribute('content') || '';
  const version = raw.trim();
  if (!version || version === BUILD_VERSION_PLACEHOLDER) return '';
  return version;
};

export const withBuildVersion = (url, version = getBuildVersion()) => {
  if (!version) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(version)}`;
};

export const articlePath = (slug) => {
  const normalized = normalizeText(slug, { allowPlaceholder: true });
  return normalized ? `/articles/${encodeURIComponent(normalized)}` : '/articles.html';
};

export const formatDate = (iso) => {
  const raw = normalizeText(iso, { allowPlaceholder: true });
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw;
  return `${match[1]}/${match[2]}/${match[3]}`;
};

const trimDescription = (value, maxLength) => {
  const text = collapseWhitespace(value);
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

export const stripMarkdown = (raw) => {
  const src = String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\[audio\]\((.*?)\)/g, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n+/g, ' ');
  return collapseWhitespace(src);
};

export const buildDescription = (post, maxLength = 140) => {
  const excerpt = normalizeText(post?.excerpt);
  if (excerpt) return trimDescription(excerpt, maxLength);
  const bodyText = stripMarkdown(post?.body ?? '');
  return trimDescription(bodyText, maxLength);
};

export const buildSearchText = (post) => {
  const tags = Array.isArray(post?.tags) ? post.tags.map((tag) => normalizeText(tag, { allowPlaceholder: true })) : [];
  return collapseWhitespace(
    [
      normalizeText(post?.title, { allowPlaceholder: true }),
      normalizeText(post?.excerpt, { allowPlaceholder: true }),
      stripMarkdown(post?.body ?? ''),
      normalizeText(post?.category, { allowPlaceholder: true }),
      normalizeText(post?.issue, { allowPlaceholder: true }),
      tags.join(' '),
    ]
      .filter(Boolean)
      .join(' ')
  );
};

const buildSnippetWindow = (text, query, maxLength) => {
  const source = collapseWhitespace(text);
  if (!source) return '';
  if (!query) return trimDescription(source, maxLength);

  const lower = source.toLowerCase();
  const target = query.toLowerCase();
  const at = lower.indexOf(target);
  if (at === -1) return trimDescription(source, maxLength);

  const radius = Math.max(18, Math.floor((maxLength - target.length) / 2));
  const start = Math.max(0, at - radius);
  const end = Math.min(source.length, at + target.length + radius);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < source.length ? '…' : '';
  return `${prefix}${source.slice(start, end).trim()}${suffix}`;
};

export const buildSearchSnippet = (post, query, maxLength = 88) => {
  const normalizedQuery = normalizeText(query, { allowPlaceholder: true });
  const candidates = [
    normalizeText(post?.excerpt, { allowPlaceholder: true }),
    stripMarkdown(post?.body ?? ''),
    normalizeText(post?.title, { allowPlaceholder: true }),
  ].filter(Boolean);

  const matched = candidates.find((candidate) => candidate.toLowerCase().includes(normalizedQuery.toLowerCase()));
  if (matched) return buildSnippetWindow(matched, normalizedQuery, maxLength);
  return buildDescription(post, maxLength);
};

const inlineMarkdownLink = (label, href, baseOrigin) => {
  const safeHref = sanitizeUrl(href, { baseOrigin });
  return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(label)}</a>`;
};

const inlineMarkdown = (text, baseOrigin) => {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => inlineMarkdownLink(label, href, baseOrigin));
};

export const simpleMarkdown = (raw, options = {}) => {
  const baseOrigin = resolveBaseOrigin(options.baseOrigin);
  const src = String(raw || '').replace(/\r\n/g, '\n');
  const lines = src.split('\n');
  const out = [];
  let inList = false;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    out.push(`<p>${inlineMarkdown(paragraph.join(' '), baseOrigin)}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!inList) return;
    out.push('</ul>');
    inList = false;
  };

  const renderAudioBlock = (audioSrc, title, caption) => {
    const safeSrc = sanitizeUrl(audioSrc, { allowHash: false, baseOrigin });
    if (safeSrc === '#') return '';
    const safeTitle = escapeHtml(title || '');
    const safeCaption = escapeHtml(caption || '');
    const titleHtml = safeTitle ? `<div class="post-audio-title">${safeTitle}</div>` : '';
    const captionHtml = safeCaption ? `<figcaption>${safeCaption}</figcaption>` : '';
    return `<figure class="post-audio">${titleHtml}<audio controls preload="metadata" src="${escapeHtml(safeSrc)}"></audio>${captionHtml}</figure>`;
  };

  const renderImageBlock = (imageSrc, altText) => {
    const safeSrc = sanitizeUrl(imageSrc, { allowHash: false, baseOrigin });
    if (safeSrc === '#') return '';
    const safeAlt = escapeHtml(altText || '');
    const captionHtml = safeAlt ? `<figcaption>${safeAlt}</figcaption>` : '';
    return `<figure class="post-image"><img src="${escapeHtml(safeSrc)}" alt="${safeAlt}" loading="lazy" />${captionHtml}</figure>`;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }

    const audioMatch = trimmed.match(/^\[audio\]\((.*?)\)$/);
    if (audioMatch) {
      const next = (lines[i + 1] || '').trim();
      const titleMatch = next.match(/^<!--\s*title:(.*?)\s*-->$/);
      if (titleMatch) {
        const captionLine = (lines[i + 2] || '').trim();
        const captionMatch = captionLine.match(/^\*(.*?)\*$/);
        const blockHtml = renderAudioBlock(audioMatch[1], titleMatch[1], captionMatch ? captionMatch[1] : '');
        if (blockHtml) {
          flushParagraph();
          closeList();
          out.push(blockHtml);
        }
        i += captionMatch ? 2 : 1;
        continue;
      }
    }

    const imageMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imageMatch) {
      const blockHtml = renderImageBlock(imageMatch[2], imageMatch[1]);
      if (blockHtml) {
        flushParagraph();
        closeList();
        out.push(blockHtml);
      }
      continue;
    }

    if (/^###\s+/.test(trimmed)) {
      flushParagraph();
      closeList();
      out.push(`<h3>${inlineMarkdown(trimmed.replace(/^###\s+/, ''), baseOrigin)}</h3>`);
      continue;
    }

    if (/^##\s+/.test(trimmed)) {
      flushParagraph();
      closeList();
      out.push(`<h2>${inlineMarkdown(trimmed.replace(/^##\s+/, ''), baseOrigin)}</h2>`);
      continue;
    }

    if (/^#\s+/.test(trimmed)) {
      flushParagraph();
      closeList();
      out.push(`<h1>${inlineMarkdown(trimmed.replace(/^#\s+/, ''), baseOrigin)}</h1>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inlineMarkdown(trimmed.replace(/^([-*]|\d+\.)\s+/, ''), baseOrigin)}</li>`);
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  closeList();
  return out.join('\n');
};

export const renderNavItems = (items, currentPath, options = {}) => {
  const baseOrigin = resolveBaseOrigin(options.baseOrigin);
  if (!Array.isArray(items) || items.length === 0) return '';

  return items
    .filter((item) => item && normalizeText(item.label) && normalizeText(item.href, { allowPlaceholder: true }))
    .map((item) => {
      const safeHref = sanitizeUrl(item.href, { baseOrigin });
      const normalized = new URL(safeHref, baseOrigin).pathname.replace(/\/index\.html$/, '/') || '/';
      const isHome = normalized === '/';
      const normalizedBase = normalized.endsWith('.html') ? normalized.replace(/\.html$/, '') : normalized;
      const isActive = isHome
        ? currentPath === '/'
        : currentPath === normalized ||
          currentPath.startsWith(`${normalized}/`) ||
          (normalizedBase !== normalized && (currentPath === normalizedBase || currentPath.startsWith(`${normalizedBase}/`)));
      return `<a href="${escapeHtml(safeHref)}"${isActive ? ' class="active"' : ''}>${escapeHtml(item.label)}</a>`;
    })
    .join('');
};
