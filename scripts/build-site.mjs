import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(root,'dist');
fs.rmSync(dist,{recursive:true,force:true});
fs.mkdirSync(dist,{recursive:true});
const copy=(from,to=from)=>{const source=path.join(root,from),target=path.join(dist,to);fs.mkdirSync(path.dirname(target),{recursive:true});fs.cpSync(source,target,{recursive:true});};
const write=(file,content)=>{const target=path.join(dist,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,`${content.trim()}\n`);};
const analyticsTag=(buildVersion)=>`<script defer src="/assets/academic/analytics.js?v=${buildVersion}"></script>`;
const withAnalytics=(html,buildVersion)=>String(html).replace(/<\/body>\s*<\/html>\s*$/i,`${analyticsTag(buildVersion)}</body></html>`);
const buildVersion=String(process.env.CF_PAGES_COMMIT_SHA||crypto.createHash('sha256').update(['src/styles/style.css','src/styles/typography.css','src/styles/gallery.css','src/scripts/public-site.js','src/scripts/guestbook.js','src/scripts/gallery.js','src/scripts/analytics.js'].map(file=>fs.readFileSync(path.join(root,file))).join('\n')).digest('hex')).slice(0,12);
const versionAssets=(html)=>html.replace(/((?:href|src)="\/assets\/(?:academic|css|js)\/[^"?]+)(")/g,`$1?v=${buildVersion}$2`);

copy('assets/img');
copy('admin/index.html');copy('admin/custom.css');copy('admin/custom.js');
copy('.well-known');copy('google974aaeec2e4594c9.html');
copy('src/styles/style.css','assets/academic/style.css');copy('src/styles/typography.css','assets/academic/typography.css');copy('src/styles/gallery.css','assets/academic/gallery.css');
copy('src/scripts/public-site.js','assets/academic/public-site.js');copy('src/scripts/guestbook.js','assets/academic/guestbook.js');copy('src/scripts/analytics.js','assets/academic/analytics.js');
write('assets/academic/gallery.js',fs.readFileSync(path.join(root,'src/scripts/gallery.js'),'utf8').replaceAll('/preview/assets/world-gallery/','/assets/world-gallery/').replaceAll('/preview/research-en.html','/articles/world-word-exploration-en'));
copy('src/assets/world-gallery','assets/world-gallery');
write('records/world-word-history/museum/index.html',withAnalytics(fs.readFileSync(path.join(root,'records/world-word-history/museum.html'),'utf8').replace(/^\s*<meta name="robots"[^>]*>\s*$/m,''),buildVersion));

let gallery=fs.readFileSync(path.join(root,'src/templates/research-gallery.html'),'utf8')
  .replace('<meta name="robots" content="noindex" />\n  ','')
  .replaceAll('/preview/typography.css','/assets/academic/typography.css')
  .replaceAll('/preview/gallery.css','/assets/academic/gallery.css')
  .replaceAll('/preview/gallery.js','/assets/academic/gallery.js')
  .replaceAll('/preview/research.html','/articles/world-word-exploration');
write('records/world-word-history/gallery/index.html',withAnalytics(versionAssets(gallery),buildVersion));

write('robots.txt',`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/v1/admin/\nSitemap: https://cbc688.com/sitemap.xml`);
write('_redirects',`/index.html /articles 308
/articles.html /articles 301
/issues.html /issues 301
/records.html /issues 301
/about.html /about 301
/preview /articles 301
/preview/index.html /articles 301
/preview/articles.html /articles 301
/preview/issues.html /issues 301
/preview/records.html /issues 301
/preview/about.html /about 301
/preview/research.html /articles/world-word-exploration 301
/preview/research-en.html /articles/world-word-exploration-en 301
/preview/research-gallery.html /records/world-word-history/gallery 301
/preview/articles/:slug.html /articles/:slug 301
/preview/issues/:id.html /issues/:id 301
/preview/records/:slug.html /records/:slug 301
/records/world-word-exploration /articles/world-word-exploration 308
/records/world-word-history /articles/world-word-exploration 308
/records/world-word-history/ /articles/world-word-exploration 308
/records/world-word-history/museum.html /records/world-word-history/museum/ 308`);
write('_headers',`/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  X-Frame-Options: DENY
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  Content-Security-Policy: default-src 'self'; base-uri 'self'; frame-ancestors 'none'; img-src 'self' data: https: blob:; media-src 'self' https: blob:; script-src 'self' https://challenges.cloudflare.com; style-src 'self'; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/admin/*
  Cache-Control: no-store
  X-Robots-Tag: noindex, nofollow

/records/world-word-history/museum/*
  ! X-Frame-Options
  ! Content-Security-Policy
  Content-Security-Policy: default-src 'self' data: blob:; frame-ancestors 'self'; img-src 'self' data: blob:; media-src 'self' blob:; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'

/.well-known/security.txt
  Cache-Control: public, max-age=86400
  Content-Type: text/plain; charset=UTF-8`);
write('_routes.json',JSON.stringify({version:1,include:['/','/articles','/articles/*','/issues','/issues/*','/records','/records/*','/post','/post.html','/about','/rss.xml','/sitemap.xml','/api/*','/media/*'],exclude:['/assets/*','/admin/*','/.well-known/*','/records/world-word-history/gallery/*','/records/world-word-history/museum/*']},null,2));
console.log(`Built CRIVU academic site in ${dist}`);
