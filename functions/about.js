import { bundle, pageBySlug } from './_content.js';
import { htmlHeaders, renderAbout, renderNotFound } from '../src/renderers/public-site.js';
export async function onRequest({env,request}){const {db}=await bundle(env),origin=new URL(request.url).origin,page=await pageBySlug(db,'about');return new Response(page?renderAbout({page,origin}):renderNotFound({origin}),{status:page?200:404,headers:htmlHeaders});}
