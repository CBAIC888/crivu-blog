import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDescription,
  buildSearchText,
  escapeHtml,
  simpleMarkdown,
  stripMarkdown,
} from "../shared/content.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputFlagIndex = process.argv.indexOf("--output");
const outputArgument =
  outputFlagIndex >= 0 ? process.argv[outputFlagIndex + 1] : "preview";
if (!outputArgument || outputArgument.startsWith("--")) {
  throw new Error("--output requires a directory path");
}

const source = path.join(root, "src");
const preview = path.resolve(root, outputArgument);

const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const write = (relativePath, content) => {
  const target = path.join(preview, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${content.trim()}\n`);
};
const copy = (sourcePath, outputPath = sourcePath) => {
  const from = path.join(source, sourcePath);
  const to = path.join(preview, outputPath);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
};

const posts = (readJson("posts/posts.json").items || []).filter(
  (post) => post?.published !== false,
);
const issues = (readJson("posts/issues.json").issues || []).filter(
  (issue) => issue?.published !== false,
);
const records = (readJson("posts/records.json").records || []).filter(
  (record) => record?.published === true,
);
const site = readJson("posts/site.json");
const bySlug = new Map(posts.map((post) => [post.slug, post]));

[
  ["templates/research.html", "research.html"],
  ["templates/research-en.html", "research-en.html"],
  ["templates/research-gallery.html", "research-gallery.html"],
  ["content/world-research.html", "research-content.html"],
  ["content/world-research-en.md", "research-content-en.md"],
  ["styles/style.css", "style.css"],
  ["styles/typography.css", "typography.css"],
  ["styles/gallery.css", "gallery.css"],
  ["scripts/site.js", "site.js"],
  ["scripts/gallery.js", "gallery.js"],
].forEach(([from, to]) => copy(from, to));

for (const file of fs.readdirSync(path.join(source, "assets/world-gallery"))) {
  if (file.endsWith(".webp")) {
    copy(`assets/world-gallery/${file}`, `assets/world-gallery/${file}`);
  }
}

const isoDate = (value) =>
  String(value || "").match(/^\d{4}-\d{2}-\d{2}/)?.[0] || "";
const yearOf = (value) => isoDate(value).slice(0, 4) || "未標日期";
const monthDay = (value) => isoDate(value).slice(5).replace("-", ".") || "—";
const kindOf = (post) => (post.issue === "opera" ? "劇本" : "一般");
const previewPostHref = (slug) =>
  `/preview/articles/${encodeURIComponent(slug)}.html`;
const cleanExcerpt = (post, length = 76) => {
  const raw = String(post.excerpt || buildDescription(post, length) || "")
    .replace(/\s+/g, " ")
    .trim();
  return raw.length > length ? `${raw.slice(0, length - 1).trim()}…` : raw;
};

const head = ({
  title,
  description = "",
  lang = "zh-Hant",
  styleVersion = "",
}) => `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${escapeHtml(title)} · CRIVU</title>
  ${description ? `<meta name="description" content="${escapeHtml(description)}" />` : ""}
  <link rel="icon" href="/assets/img/favicon.png" type="image/png" />
  <link rel="alternate" type="application/rss+xml" title="CRIVU RSS" href="/rss.xml" />
  <link rel="stylesheet" href="/preview/typography.css" />
  <link rel="stylesheet" href="/preview/style.css${styleVersion ? `?v=${styleVersion}` : ""}" />
</head>`;

const comments = (
  slug,
  className = "",
) => `<section class="comments-preview ${className}" data-comments data-comments-slug="${escapeHtml(slug)}" data-comments-empty="暫無評論。" aria-labelledby="comments-${escapeHtml(slug)}">
  <h2 id="comments-${escapeHtml(slug)}">評論</h2>
  <div class="comments-list" data-comments-list><p class="comments-empty">評論載入中。</p></div>
  <form class="comments-form" data-comments-form>
    <div class="comments-fields">
      <label><span>稱呼</span><input name="authorName" maxlength="32" autocomplete="name" required /></label>
      <label><span>電郵（不公開）</span><input name="email" type="email" maxlength="160" autocomplete="email" /></label>
    </div>
    <label><span>評論</span><textarea name="body" maxlength="1200" required></textarea></label>
    <label class="comments-trap" aria-hidden="true"><span>Website</span><input name="website" tabindex="-1" autocomplete="off" /></label>
    <div class="comments-verification"><span>驗證</span><div data-comments-turnstile></div></div>
    <div class="comments-actions"><button type="submit" data-comments-submit disabled>提交</button><p class="comments-status" data-comments-status aria-live="polite"></p></div>
  </form>
</section>`;

const scripts = ({
  withComments = false,
} = {}) => `  <script type="module" src="/preview/site.js"></script>
  ${withComments ? '<script type="module" src="/assets/js/comments.js"></script>' : ""}`;

const normalizeBodyForPreview = (post) => {
  const html = simpleMarkdown(post.body || "");
  return html.replace(
    /<a href="([^"]+)" target="_blank"/g,
    '<a href="$1" target="_blank"',
  );
};

const normalizeScriptSource = (raw) =>
  String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/^\\(#{1,6}\s+)/gm, "$1")
    .replace(/^\\(>\s?)/gm, "$1")
    .replace(/^\\(\*{1,3})/gm, "$1")
    .replace(/\\(?=\*)/g, "")
    .replace(/\\(\*{1,3})([^*\n]+?)\\\1/g, "$1$2$1")
    .replace(/\\(\*\*[^*\n]+?\*\*)/g, "$1")
    .replace(/\\(\*[^*\n]+?\*)/g, "$1")
    .replace(/^\\\s+/gm, "")
    .replace(/\\(?=。|，|、|；|：|！|？|）|」|』|》|〉|\.|,|;|:|!|\?|\)|\]|}|$)/gm, "");

const stripScriptEmphasis = (value) =>
  String(value || "")
    .trim()
    .replace(/^(\*{1,3}|_{1,3})([\s\S]*?)\1$/, "$2")
    .trim();

const cleanScriptHeading = (value) =>
  String(value || "")
    .replace(/^[一二三四五六七八九十百千万零〇两\d]+[、.．)）]\s*/u, "")
    .trim();

const isScriptModeLabel = (value) => {
  const mode = String(value || "")
    .replace(/\s+/gu, "")
    .trim();

  if (!mode || mode.length > 12 || /[，。；！？、：,.!?;:〖〗【】（）；]/u.test(mode)) {
    return false;
  }

  if (/^(?:内|同|内同)?(?:白|念)$/u.test(mode)) return true;
  if (/^(?:引子|数板|回龙|三叫头|叫头|哭头|哭|扑灯蛾牌)$/u.test(mode)) {
    return true;
  }

  return /^(?:内)?(?:西皮|二黄|反二黄|南梆子|四平调|高拨子|娃娃调|吹腔|昆曲)[一-龥0-9]{0,8}$/u.test(
    mode,
  );
};

const parseScriptSceneHeading = (value) => {
  const match = String(value || "")
    .trim()
    .match(
      /^(?:#{1,6}\s*)?(?:【\s*)?(第[一二三四五六七八九十百千万零〇两\d]+[场場回幕折])(?:\s*】)?(?:\s*[：:—–-]?\s*(.*))?$/u,
    );
  if (!match) return null;
  const suffix = (match[2] || "").trim();
  return {
    title: suffix ? `${match[1]} · ${suffix}` : match[1],
  };
};

const parseScriptSpeech = (rawLine) => {
  const line = stripScriptEmphasis(rawLine);
  let source = line;
  const boldLabel = source.match(/^\*\*(.+?)\*\*\s*(.*)$/u);
  if (boldLabel) source = `${boldLabel[1]} ${boldLabel[2]}`.trim();

  const roleMode = source.match(
    /^([^（(]{1,80}?)[ \t]*[（(]([^）)]{1,24})[）)][ \t]*[:：]?[ \t]*(.*)$/u,
  );
  if (roleMode) {
    const speaker = roleMode[1].replace(/[：:]\s*$/u, "").trim();
    const mode = roleMode[2].trim();
    if (speaker && isScriptModeLabel(mode)) {
      return {
        type: "speech",
        speaker,
        mode,
        text: roleMode[3].trim(),
      };
    }
  }

  const modeOnly = source.match(
    /^[（(]([^）)]{1,24})[）)][ \t]*[:：]?[ \t]*(.*)$/u,
  );
  if (
    modeOnly &&
    isScriptModeLabel(modeOnly[1]) &&
    !/^(?:完|幕落|场终|終了)$/u.test(modeOnly[1].trim())
  ) {
    return {
      type: "speech",
      speaker: "",
      mode: modeOnly[1].trim(),
      text: modeOnly[2].trim(),
    };
  }

  return null;
};

const isScriptDirection = (value) => {
  const line = stripScriptEmphasis(value);
  return /^(?:[（(][\s\S]*[）)]|【[\s\S]*】|\[[\s\S]*\]|〖[\s\S]*〗)[\s\S]*$/u.test(line);
};

const isScriptSong = (mode) => {
  const label = String(mode || "").replace(/\s+/gu, "").trim();
  return isScriptModeLabel(label) && !/白$/u.test(label);
};

const isScriptCue = (value) => {
  const line = stripScriptEmphasis(value);
  return line.length <= 18 && /[，。！？；：,.!?;:]$/u.test(line);
};

const parseScriptLine = (rawLine) => {
  const line = String(rawLine || "").trim();
  if (!line) return { type: "blank" };

  const scene = parseScriptSceneHeading(line);
  if (scene) return { type: "scene", ...scene };

  const heading = line.match(/^#{1,6}\s+(.+)$/u);
  if (heading) return { type: "heading", title: heading[1].trim() };

  const speech = parseScriptSpeech(line);
  if (speech) return { ...speech, song: isScriptSong(speech.mode) };

  if (isScriptDirection(line)) {
    return { type: "direction", text: stripScriptEmphasis(line) };
  }

  return {
    type: isScriptCue(line) ? "cue" : "text",
    text: stripScriptEmphasis(line),
  };
};

const renderScriptInline = (value) => {
  const html = simpleMarkdown(String(value || ""));
  if (html.startsWith("<p>") && html.endsWith("</p>")) {
    return html.slice(3, -4);
  }
  return html;
};

const renderScriptLines = (lines) => {
  const out = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const item = parseScriptLine(lines[lineIndex]);
    if (item.type === "blank") continue;

    if (item.type === "speech") {
      const classNames = ["script-speech"];
      if (item.song) classNames.push("script-speech--song");
      if (!item.speaker) classNames.push("script-speech--anonymous");

      const speechLines = item.text ? [item.text] : [];
      if (item.song) {
        let continuationIndex = lineIndex + 1;
        while (continuationIndex < lines.length) {
          const continuation = parseScriptLine(lines[continuationIndex]);
          if (continuation.type === "blank") {
            continuationIndex += 1;
            continue;
          }
          if (continuation.type !== "text" && continuation.type !== "cue") break;
          speechLines.push(continuation.text);
          continuationIndex += 1;
        }
        lineIndex = continuationIndex - 1;
      }

      const speechContent = speechLines
        .map(
          (line, speechLineIndex) =>
            `<p${speechLineIndex > 0 ? ' class="script-song-line"' : ""}>${renderScriptInline(line)}</p>`,
        )
        .join("");
      out.push(`<div class="${classNames.join(" ")}" data-script-kind="${item.song ? "song" : "speech"}"${item.speaker ? ` data-speaker="${escapeHtml(item.speaker)}"` : ""}${item.mode ? ` data-mode="${escapeHtml(item.mode)}"` : ""}>
  <div class="script-speech__label">${item.speaker ? `<span class="script-speaker">${escapeHtml(item.speaker)}</span>` : ""}${item.mode ? `<span class="script-mode">（${escapeHtml(item.mode)}）</span>` : ""}</div>
  <div class="script-speech__content">${speechContent}</div>
</div>`);
      continue;
    }

    if (item.type === "direction") {
      out.push(`<p class="script-direction">${renderScriptInline(item.text)}</p>`);
      continue;
    }

    if (item.type === "cue") {
      out.push(`<p class="script-cue">${renderScriptInline(item.text)}</p>`);
      continue;
    }

    if (item.type === "heading") {
      out.push(`<h3 class="script-inline-heading">${renderScriptInline(item.title)}</h3>`);
      continue;
    }

    out.push(simpleMarkdown(item.text));
  }

  return out.join("\n");
};

// opera-v1 keeps the editorial layers stable for future CMS entries:
// front matter → scenes → stage directions / speeches / song lines.
const parseScriptDocument = (post) => {
  const lines = normalizeScriptSource(post.body || "").split("\n");
  const scenes = [];
  let scriptMarker = null;

  lines.forEach((line, index) => {
    const item = parseScriptLine(line);
    if (item.type === "scene") scenes.push({ ...item, index });
    if (
      !scriptMarker &&
      item.type === "heading" &&
      /(?:剧本|劇本|正文|全本)/u.test(item.title)
    ) {
      scriptMarker = { ...item, index };
    }
  });

  const firstContentIndex = scenes[0]?.index ?? (scriptMarker ? scriptMarker.index + 1 : 0);
  const frontEnd = scenes[0]?.index ?? scriptMarker?.index ?? lines.length;
  const frontLines = lines.slice(0, frontEnd);
  if (scriptMarker && scriptMarker.index < frontEnd) {
    frontLines.splice(scriptMarker.index, 1);
  }

  const sections = scenes.length
    ? scenes.map((scene, sceneIndex) => ({
        id: `script-scene-${sceneIndex + 1}`,
        title: scene.title,
        lines: lines.slice(scene.index + 1, scenes[sceneIndex + 1]?.index ?? lines.length),
      }))
    : [
        {
          id: "script-main",
          title: scriptMarker ? cleanScriptHeading(scriptMarker.title) : "正文",
          lines: lines.slice(firstContentIndex),
        },
      ];

  const cast = [];
  const seenCast = new Set();
  for (const section of sections) {
    for (const line of section.lines) {
      const item = parseScriptLine(line);
      if (item.type !== "speech" || !item.speaker) continue;
      for (const name of item.speaker.split(/[、，,]/u).map((part) => part.trim()).filter(Boolean)) {
        if (seenCast.has(name)) continue;
        seenCast.add(name);
        cast.push(name);
      }
    }
  }

  return {
    frontmatter: frontLines.join("\n").trim(),
    sections,
    cast,
    hasScenes: scenes.length > 0,
  };
};

const renderScriptContents = (document) => {
  if (document.sections.length < 2 || !document.hasScenes) return "";
  return `<nav class="script-contents" aria-label="劇本場次">
  <span class="script-contents__label">場次</span>
  <div class="script-contents__links">${document.sections
    .map((section) => `<a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a>`)
    .join("")}</div>
</nav>`;
};

const renderScriptCast = (document) =>
  document.cast.length
    ? `<details class="script-cast">
  <summary>人物</summary>
  <div class="script-cast__list">${document.cast.map((name) => `<span>${escapeHtml(name)}</span>`).join("")}</div>
</details>`
    : "";

const renderScriptSections = (document) =>
  document.sections
    .map(
      (section) => `<section class="script-section" id="${escapeHtml(section.id)}" data-script-scene="${escapeHtml(section.title)}">
  <h2 class="script-scene-heading">${escapeHtml(section.title)}</h2>
  <div class="script-scene-body">${renderScriptLines(section.lines)}</div>
</section>`,
    )
    .join("\n");

const renderCover = (post, className = "article-cover") =>
  post.cover
    ? `<figure class="${className}"><img src="${escapeHtml(post.cover)}" alt="${escapeHtml(post.title || "")}" loading="eager" /></figure>`
    : "";

const renderGeneralPost = (
  post,
) => `${head({ title: post.title, description: cleanExcerpt(post, 150) })}
<body data-current="articles">
  <main class="page-main article-page">
    <article class="article-simple">
      <header class="article-header">
        <h1>${escapeHtml(post.title || "")}</h1>
        <p class="article-meta">${escapeHtml(isoDate(post.date))} · ${escapeHtml(post.category || "一般")}</p>
        ${post.excerpt ? `<p class="article-deck">${escapeHtml(post.excerpt)}</p>` : ""}
        ${renderCover(post)}
      </header>
      <div class="prose">${normalizeBodyForPreview(post)}</div>
      ${comments(post.slug)}
    </article>
  </main>
${scripts({ withComments: true })}
</body>
</html>`;

const renderScriptPost = (
  post,
) => {
  const document = parseScriptDocument(post);
  const frontmatterHtml = document.frontmatter
    ? `<section class="script-frontmatter prose" aria-label="編校說明">${simpleMarkdown(document.frontmatter)}</section>`
    : "";

  return `${head({
    title: post.title,
    description: cleanExcerpt(post, 150),
    styleVersion: "script-template-20260814-r5",
  })}
<body data-current="articles">
  <main class="script-page migrated-script" data-script-template="opera-v1">
    <header class="script-head">
      <h1>${escapeHtml(post.title || "")}</h1>
      <p class="article-meta">${escapeHtml(isoDate(post.date))} · 劇本</p>
      <dl class="script-facts">
        <div><dt>劇種</dt><dd>${escapeHtml(post.category || "京劇")}</dd></div>
        <div><dt>載體</dt><dd>全本劇本</dd></div>
        <div><dt>期刊</dt><dd>京劇</dd></div>
        <div><dt>整理</dt><dd>CRIVU</dd></div>
      </dl>
      ${renderCover(post, "script-cover")}
    </header>
    ${frontmatterHtml}
    <div class="script-layout">
      <article class="script-body script-prose">${renderScriptSections(document)}</article>
      <aside class="script-side" aria-label="劇本導覽">
        ${renderScriptContents(document)}
        ${renderScriptCast(document)}
      </aside>
    </div>
    ${comments(post.slug, "script-comments")}
  </main>
${scripts({ withComments: true })}
</body>
</html>`;
};

const renderEntry = ({
  kind,
  date,
  title,
  href,
}) => `<li class="entry" data-kind="${escapeHtml(kind)}">
  <time class="entry__date" datetime="${escapeHtml(isoDate(date))}">${escapeHtml(monthDay(date))}</time>
  <h3 class="entry__title"><a href="${escapeHtml(href)}">${escapeHtml(title)}</a></h3>
</li>`;

const renderCollectionCard = ({
  href,
  cover,
  alt,
  label,
  title,
  meta = "",
  className = "",
}) => `<a class="record collection-item ${className}" href="${escapeHtml(href)}">
  <span class="collection-item__cover"><img src="${escapeHtml(cover || "")}" alt="${escapeHtml(alt || "")}" loading="lazy" /></span>
  <div class="collection-item__body">
    <span class="collection-item__label">${escapeHtml(label)}</span>
    <h2 class="collection-item__title">${escapeHtml(title || "")}</h2>
    ${meta ? `<span class="collection-item__meta">${escapeHtml(meta)}</span>` : ""}
  </div>
</a>`;

const researchIndexItem = {
  kind: "研究",
  date: "2026-07-23",
  title: "對『世界』的探索",
  excerpt:
    "從先秦兩漢的舊字、東漢譯經與佛教宇宙論出發，追索「世界」一詞近兩千年的形成與變化。",
  href: "/preview/research.html",
};

for (const post of posts) {
  write(
    `articles/${post.slug}.html`,
    post.issue === "opera" ? renderScriptPost(post) : renderGeneralPost(post),
  );
}

const indexItems = [
  ...posts.map((post) => ({
    kind: kindOf(post),
    date: post.date,
    title: post.title,
    excerpt: cleanExcerpt(post),
    href: previewPostHref(post.slug),
  })),
  researchIndexItem,
].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

const indexGroups = [...new Set(indexItems.map((item) => yearOf(item.date)))]
  .map((year) => {
    const entries = indexItems
      .filter((item) => yearOf(item.date) === year)
      .map(renderEntry)
      .join("\n");
    return `<section class="year-group"><h2 class="year-label">${escapeHtml(year)}</h2><ol class="entry-list">${entries}</ol></section>`;
  })
  .join("\n");

write(
  "articles.html",
  `${head({ title: "文章", description: "CRIVU 全部文章、研究與劇本。" })}
<body data-current="articles">
  <main class="page-main articles-main">
    <nav class="category-nav" aria-label="文章分類">
      <button class="is-active" data-filter="全部">全部</button><button data-filter="一般">一般</button><button data-filter="研究">研究</button><button data-filter="劇本">劇本</button>
    </nav>
    ${indexGroups}
  </main>
${scripts()}
</body>
</html>`,
);

const issueCards = issues
  .map((issue) => {
    const linked = (issue.posts || [])
      .map((slug) => bySlug.get(typeof slug === "string" ? slug : slug?.slug))
      .filter(Boolean);
    const year = isoDate(issue.publishDate).slice(0, 4) || "未標日期";
    return renderCollectionCard({
      href: `/preview/issues/${encodeURIComponent(issue.id)}.html`,
      cover: issue.cover,
      alt: `${issue.title || ""}封面`,
      label: `期刊 · ${year}`,
      title: issue.title,
      meta: `${linked.length} 篇`,
      className: "collection-item--issue",
    });
  })
  .join("\n");

write(
  "issues.html",
  `${head({ title: "期刊", description: "CRIVU 期刊與專題合集。", styleVersion: "collections-mobile-left-20260814" })}
<body data-current="issues">
  <main class="page-main collection-page collection-page--issues"><div class="records-list">${issueCards}</div></main>
${scripts()}
</body>
</html>`,
);

for (const issue of issues) {
  const linked = (issue.posts || [])
    .map((slug) => bySlug.get(typeof slug === "string" ? slug : slug?.slug))
    .filter(Boolean);
  const entries = linked
    .map((post) =>
      renderEntry({
        kind: kindOf(post),
        date: post.date,
        title: post.title,
        excerpt: cleanExcerpt(post),
        href: previewPostHref(post.slug),
      }),
    )
    .join("\n");
  write(
    `issues/${issue.id}.html`,
    `${head({ title: issue.title, description: issue.editorNote || issue.theme || "" })}
<body data-current="issues">
  <main class="page-main issue-page">
    <header class="issue-head">
      <img src="${escapeHtml(issue.cover || "")}" alt="${escapeHtml(issue.title || "")}封面" />
      <div><h1>${escapeHtml(issue.title || "")}</h1><p>${escapeHtml(stripMarkdown(issue.editorNote || issue.theme || ""))}</p><p class="issue-meta">${escapeHtml(isoDate(issue.publishDate))} · ${linked.length} 篇</p></div>
    </header>
    <ol class="entry-list issue-entry-list">${entries}</ol>
  </main>
${scripts()}
</body>
</html>`,
  );
}

const worldRecord = records.find(
  (record) => record.id === "world-word-history",
);
const videoRecord = records.find((record) => record.id === "zrc");
const recordCards = records
  .map((record) => {
    const href =
      record.id === "world-word-history"
        ? "/preview/research.html"
        : `/preview/records/${encodeURIComponent(record.id)}.html`;
    const year = isoDate(record.date).slice(0, 4) || "未標日期";
    return renderCollectionCard({
      href,
      cover: record.cover,
      alt: `${record.title || ""}封面`,
      label: `紀錄 · ${year}`,
      title: record.title,
      className: "collection-item--record",
    });
  })
  .join("\n");

write(
  "records.html",
  `${head({ title: "紀錄", description: "CRIVU 專題紀錄。", styleVersion: "collections-mobile-left-20260814" })}
<body data-current="records">
  <main class="page-main collection-page collection-page--records"><div class="records-list">${recordCards}</div></main>
${scripts()}
</body>
</html>`,
);

if (videoRecord) {
  const videoCards = (videoRecord.videos || [])
    .filter((video) => video?.published !== false)
    .map((video) => {
      const href =
        String(video.url || "").match(/https?:\/\/[^\s]+/)?.[0] || "#";
      return `<a class="video-card" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"><span class="video-card__media"><img src="${escapeHtml(video.cover || "")}" alt="" loading="lazy" /><span class="video-card__play" aria-hidden="true">▶</span></span><h2>${escapeHtml(video.title || "")}</h2>${video.description ? `<p>${escapeHtml(video.description)}</p>` : ""}</a>`;
    })
    .join("\n");
  write(
    `records/${videoRecord.id}.html`,
    `${head({ title: videoRecord.title, description: videoRecord.summary })}
<body data-current="records">
  <main class="page-main record-detail-preview">
    <header class="record-detail-head"><img src="${escapeHtml(videoRecord.cover || "")}" alt="${escapeHtml(videoRecord.title || "")}封面" /><div><h1>${escapeHtml(videoRecord.title || "")}</h1><p class="article-meta">${escapeHtml(isoDate(videoRecord.date))} · 專題紀錄</p><p>${escapeHtml(videoRecord.summary || "")}</p></div></header>
    <section class="video-grid" aria-label="視頻">${videoCards}</section>
  </main>
${scripts()}
</body>
</html>`,
  );
}

write(
  "about.html",
  `${head({ title: "關於", description: stripMarkdown(site.aboutBody || "") })}
<body data-current="about">
  <main class="page-main article-page"><article class="article-simple about-copy prose">${simpleMarkdown(site.aboutBody || "")}</article></main>
${scripts()}
</body>
</html>`,
);

const searchItems = [
  ...posts.map((post) => ({
    kind: kindOf(post),
    date: isoDate(post.date),
    title: post.title,
    excerpt: cleanExcerpt(post, 130),
    searchText: buildSearchText(post),
    href: previewPostHref(post.slug),
  })),
  {
    ...researchIndexItem,
    searchText: `${researchIndexItem.title} ${researchIndexItem.excerpt} 世界 佛教 漢語 語言史`,
  },
];
write("search-index.json", JSON.stringify(searchItems, null, 2));

const redirect = (title, href) =>
  `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(title)}</title><meta http-equiv="refresh" content="0;url=${escapeHtml(href)}" /><link rel="canonical" href="${escapeHtml(href)}" /></head><body><p><a href="${escapeHtml(href)}">繼續</a></p></body></html>`;
write(
  "index.html",
  `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>CRIVU</title>
  <meta http-equiv="refresh" content="0;url=/preview/articles.html" />
  <link rel="canonical" href="/preview/articles.html" />
</head>
<body><p><a href="/preview/articles.html">前往文章</a></p></body>
</html>`,
);
write("general.html", redirect("丙午立秋 · CRIVU", previewPostHref("bwlq")));
write(
  "script.html",
  redirect("《文姬歸漢》劇本 · CRIVU", previewPostHref("wjgh")),
);
write(
  "issue.html",
  redirect("二十四節氣 · CRIVU", "/preview/issues/solar-term.html"),
);

console.log(
  `Generated ${posts.length} articles, ${issues.length} issues and ${records.length} records in ${preview}.`,
);
