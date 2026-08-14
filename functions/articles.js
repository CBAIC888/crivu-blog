import { articles, bundle } from './_content.js';
import { htmlHeaders, renderArticles } from '../src/renderers/public-site.js';
export async function onRequest({env,request}){const {db}=await bundle(env);return new Response(renderArticles({items:await articles(db),origin:new URL(request.url).origin}),{headers:htmlHeaders});}
