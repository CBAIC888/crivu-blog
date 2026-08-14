import { articles, bundle } from './_content.js';
import { escapeHtml, stripMarkdown } from '../shared/content.js';

const SITE_ORIGIN = 'https://cbc688.com';
const MAX_ITEMS = 30;
const LEGACY_FEED_URLS = {
  'world-word-exploration': '/records/world-word-history/',
};
const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (value) => String(value).padStart(2, '0');
const rfc822 = (value) => {
  const date = new Date(value);
  const valid = Number.isNaN(date.getTime()) ? new Date() : date;
  const shifted = new Date(valid.getTime() + 8 * 60 * 60 * 1000);
  return `${days[shifted.getUTCDay()]}, ${pad(shifted.getUTCDate())} ${months[shifted.getUTCMonth()]} ${shifted.getUTCFullYear()} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())} +0800`;
};
const trim = (value, maximum = 180) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maximum ? `${text.slice(0, maximum - 1).trimEnd()}…` : text;
};
const feedUrl = (item) => new URL(LEGACY_FEED_URLS[item.slug] || `/articles/${encodeURIComponent(item.slug)}`, SITE_ORIGIN).toString();

export async function onRequest({ env }) {
  const { db, settings } = await bundle(env);
  const items = (await articles(db)).slice(0, MAX_ITEMS);
  const siteName = settings.siteName || 'CRIVU';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeHtml(siteName)}</title>
    <link>${SITE_ORIGIN}/</link>
    <atom:link href="${SITE_ORIGIN}/rss.xml" rel="self" type="application/rss+xml" />
    <description>${escapeHtml(settings.siteDescription || '')}</description>
    <language>zh-Hant</language>
    <lastBuildDate>${rfc822(items[0]?.publishedAt || items[0]?.updatedAt)}</lastBuildDate>
${items.map((item) => {
    const url = feedUrl(item);
    const description = trim(item.summary || stripMarkdown(item.bodyMarkdown));
    const category = item.metadata?.category || item.metadata?.legacyIssue || (item.type === 'research' ? '研究' : item.type === 'script' ? '京劇' : '文章');
    return `    <item>
      <title>${escapeHtml(item.title)}</title>
      <link>${escapeHtml(url)}</link>
      <guid isPermaLink="true">${escapeHtml(url)}</guid>
      <pubDate>${rfc822(item.publishedAt || item.updatedAt)}</pubDate>
      <dc:creator>${escapeHtml(siteName)}</dc:creator>
      <category>${escapeHtml(category)}</category>
      <description>${escapeHtml(description)}</description>
    </item>`;
  }).join('\n')}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
