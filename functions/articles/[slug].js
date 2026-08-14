import { article, bundle, deploymentVersion } from '../_content.js';
import { htmlHeaders, renderArticle, renderNotFound } from '../../src/renderers/public-site.js';
export async function onRequest({env,request,params}){const {db}=await bundle(env),origin=new URL(request.url).origin,item=await article(db,params.slug),assetVersion=deploymentVersion(env);return new Response(item?renderArticle({item,origin,assetVersion}):renderNotFound({origin,assetVersion}),{status:item?200:404,headers:htmlHeaders});}
