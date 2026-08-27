const legacyPostTarget = (request) => {
  const url=new URL(request.url),slug=String(url.searchParams.get('slug')||'').trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? `/articles/${encodeURIComponent(slug)}` : '/articles';
};

export const redirectLegacyPost = (request) => Response.redirect(new URL(legacyPostTarget(request),request.url),301);
export function onRequest({request}){return redirectLegacyPost(request);}
