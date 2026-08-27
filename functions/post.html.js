import { redirectLegacyPost } from './post.js';

export function onRequest({request}){return redirectLegacyPost(request);}
