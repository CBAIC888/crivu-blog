const blockedFiles=new Set(['/.gitignore','/package.json','/wrangler.jsonc','/DEPLOYMENT.md']);
const blockedPrefixes=['/functions/','/migrations/','/scripts/','/src/','/posts/'];
export async function onRequest(context){
  const path=new URL(context.request.url).pathname;
  if(blockedFiles.has(path)||blockedPrefixes.some(prefix=>path.startsWith(prefix))||/^\/\.(?:git|env|hg|svn)(?:\/|$)/.test(path))return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}});
  const response=await context.next(),headers=new Headers(response.headers);
  headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','strict-origin-when-cross-origin');headers.set('Permissions-Policy','geolocation=(), microphone=(), camera=()');
  if(path.startsWith('/api/')||path.startsWith('/admin/'))headers.set('Cache-Control','no-store, max-age=0');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
