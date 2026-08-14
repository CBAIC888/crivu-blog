import { article, bundle } from '../_content.js';
import { htmlHeaders, renderArticle, renderNotFound } from '../../src/renderers/public-site.js';
export async function onRequest({env,request,params}){const {db}=await bundle(env),origin=new URL(request.url).origin,item=await article(db,params.slug);return new Response(item?renderArticle({item,origin}):renderNotFound({origin}),{status:item?200:404,headers:htmlHeaders});}
