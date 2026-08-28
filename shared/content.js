const DEFAULT_SITE_ORIGIN = 'https://cbc688.com';

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

const inlineMarkdownLink = (label, href, baseOrigin) => {
  const safeHref = sanitizeUrl(href, { baseOrigin });
  return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(label)}</a>`;
};

const normalizeCmsMarkdown = (raw) =>
  String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/^\\(#{1,6}\s+)/gm, '$1')
    .replace(/^\\(>\s?)/gm, '$1')
    .replace(/^\\([-*]\s+)/gm, '$1')
    .replace(/^\\(\d+\.\s+)/gm, '$1')
    .replace(/^\\(---+)$/gm, '$1')
    .replace(/\\(\*{1,3})([^*\n]+?)\\\1/g, '$1$2$1')
    .replace(/\\(\*\*[^*\n]+?\*\*)/g, '$1')
    .replace(/\\(\*[^*\n]+?\*)/g, '$1')
    .replace(/\\(~~[^~\n]+?~~)/g, '$1')
    .replace(/\\(`[^`\n]+?`)/g, '$1')
    .replace(/\\(!\[[^\]\n]*?\]\([^)]+?\))/g, '$1')
    .replace(/\\(\[[^\]\n]+?\]\([^)]+?\))/g, '$1')
    .replace(/([。，、；：！？.,;:!?])\\\1/g, '$1')
    .replace(/\\\\([^\\\n]+?)\\\\/g, '**$1**')
    .replace(/\\([^\\\n]+?)\\/g, '*$1*')
    .replace(/\\(?=。|，|、|；|：|！|？|）|」|』|》|〉|\.|,|;|:|!|\?|\)|\]|}|$)/gm, '');

const inlineMarkdown = (text, baseOrigin) => {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/`([^`]+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]\n]+?)\]\{(red|blue|green|gold|gray|seal)\}/g, '<span class="md-color md-color--$2">$1</span>')
    .replace(/==(.*?)==/g, '<mark>$1</mark>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/ {2,}$/gm, '<br />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => inlineMarkdownLink(label, href, baseOrigin));
};

export const simpleMarkdown = (raw, options = {}) => {
  const baseOrigin = resolveBaseOrigin(options.baseOrigin);
  const src = normalizeCmsMarkdown(raw);
  const lines = src.split('\n');
  const out = [];
  let listType = '';
  let paragraph = [];
  let quote = [];
  let inCode = false;
  let code = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const html = paragraph
      .map((item, index) => {
        const hardBreak = /\\$/.test(item);
        const clean = hardBreak ? item.replace(/\\$/, '') : item;
        const separator = index < paragraph.length - 1 ? (hardBreak ? '<br />' : ' ') : '';
        return `${inlineMarkdown(clean, baseOrigin)}${separator}`;
      })
      .join('');
    out.push(`<p>${html}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!listType) return;
    out.push(`</${listType}>`);
    listType = '';
  };

  const flushQuote = () => {
    if (quote.length === 0) return;
    out.push(`<blockquote>${quote.map((item) => `<p>${inlineMarkdown(item, baseOrigin)}</p>`).join('')}</blockquote>`);
    quote = [];
  };

  const flushCode = () => {
    out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
    code = [];
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

  const splitTableRow = (row) =>
    row
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());

  const isTableDivider = (row) => {
    const cells = splitTableRow(row);
    return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
  };

  const renderTable = (headerLine, dividerLine, rowLines) => {
    const headers = splitTableRow(headerLine);
    const aligns = splitTableRow(dividerLine).map((cell) => {
      if (/^:-+:$/.test(cell)) return 'center';
      if (/-+:$/.test(cell)) return 'right';
      if (/^:-+/.test(cell)) return 'left';
      return '';
    });
    const alignAttr = (index) => (aligns[index] ? ` style="text-align:${aligns[index]}"` : '');
    const headHtml = headers
      .map((cell, index) => `<th${alignAttr(index)}>${inlineMarkdown(cell, baseOrigin)}</th>`)
      .join('');
    const bodyHtml = rowLines
      .map((row) => {
        const cells = splitTableRow(row);
        return `<tr>${headers
          .map((_cell, index) => `<td${alignAttr(index)}>${inlineMarkdown(cells[index] || '', baseOrigin)}</td>`)
          .join('')}</tr>`;
      })
      .join('');
    return `<table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^(```|~~~)/.test(trimmed)) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        flushQuote();
        closeList();
        inCode = true;
        code = [];
      }
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushQuote();
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
          flushQuote();
          closeList();
          out.push(blockHtml);
        }
        i += captionMatch ? 2 : 1;
        continue;
      }
    }

    const imageMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imageMatch) {
      let caption = '';
      let skip = 0;
      const nextLine = (lines[i + 1] || '').trim();
      const presetMatch = nextLine.match(/^<!--\s*preset:.*?\s*-->$/);
      if (presetMatch) skip = 1;
      const afterPresetLine = (lines[i + 1 + skip] || '').trim();
      const captionMatch = afterPresetLine.match(/^\*(.*?)\*$/);
      if (captionMatch) {
        caption = captionMatch[1];
        skip += 1;
      }
      const altText = caption || imageMatch[1];
      const blockHtml = renderImageBlock(imageMatch[2], altText);
      if (blockHtml) {
        flushParagraph();
        flushQuote();
        closeList();
        out.push(blockHtml);
      }
      i += skip;
      continue;
    }

    if (/^<!--\s*preset:.*?\s*-->$/.test(trimmed)) {
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushParagraph();
      flushQuote();
      closeList();
      out.push('<hr />');
      continue;
    }

    if (trimmed.includes('|') && isTableDivider(lines[i + 1] || '')) {
      const rows = [];
      let cursor = i + 2;
      while (cursor < lines.length && lines[cursor].trim().includes('|')) {
        rows.push(lines[cursor]);
        cursor += 1;
      }
      flushParagraph();
      flushQuote();
      closeList();
      out.push(renderTable(line, lines[i + 1], rows));
      i = cursor - 1;
      continue;
    }

    if (/^(\*\*\*+|___+)$/.test(trimmed)) {
      flushParagraph();
      flushQuote();
      closeList();
      out.push('<hr />');
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      flushParagraph();
      closeList();
      quote.push(trimmed.replace(/^>\s?/, ''));
      continue;
    }

    if (/^###\s+/.test(trimmed)) {
      flushParagraph();
      flushQuote();
      closeList();
      out.push(`<h3>${inlineMarkdown(trimmed.replace(/^###\s+/, ''), baseOrigin)}</h3>`);
      continue;
    }

    if (/^##\s+/.test(trimmed)) {
      flushParagraph();
      flushQuote();
      closeList();
      out.push(`<h2>${inlineMarkdown(trimmed.replace(/^##\s+/, ''), baseOrigin)}</h2>`);
      continue;
    }

    if (/^#\s+/.test(trimmed)) {
      flushParagraph();
      flushQuote();
      closeList();
      out.push(`<h1>${inlineMarkdown(trimmed.replace(/^#\s+/, ''), baseOrigin)}</h1>`);
      continue;
    }

    if (/^第[一二三四五六七八九十百千〇零\d]+[场場回幕折]\s*$/.test(trimmed)) {
      flushParagraph();
      flushQuote();
      closeList();
      out.push(`<h2>${inlineMarkdown(trimmed, baseOrigin)}</h2>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      flushQuote();
      const nextListType = /^\d+\.\s+/.test(trimmed) ? 'ol' : 'ul';
      if (listType && listType !== nextListType) closeList();
      if (!listType) {
        out.push(`<${nextListType}>`);
        listType = nextListType;
      }
      let itemText = trimmed.replace(/^([-*]|\d+\.)\s+/, '');
      const taskMatch = itemText.match(/^\[( |x|X)\]\s+(.*)$/);
      if (taskMatch) {
        const checked = taskMatch[1].toLowerCase() === 'x' ? ' checked' : '';
        itemText = `<input type="checkbox" disabled${checked} /> ${inlineMarkdown(taskMatch[2], baseOrigin)}`;
        out.push(`<li class="task-list-item">${itemText}</li>`);
      } else {
        out.push(`<li>${inlineMarkdown(itemText, baseOrigin)}</li>`);
      }
      continue;
    }

    closeList();
    flushQuote();
    paragraph.push(trimmed);
  }

  if (inCode) flushCode();
  flushParagraph();
  flushQuote();
  closeList();
  return out.join('\n');
};
