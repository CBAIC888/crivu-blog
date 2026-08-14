export function onRequest({ request }) { return Response.redirect(new URL('/articles',request.url),308); }
