export function onRequest({request}){return Response.redirect(new URL('/issues',request.url),308);}
