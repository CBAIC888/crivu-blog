import { bundle, deploymentVersion, pageBySlug } from './_content.js';
import { htmlHeaders, renderAbout, renderNotFound } from '../src/renderers/public-site.js';
export async function onRequest({env,request}){const {db}=await bundle(env),origin=new URL(request.url).origin,page=await pageBySlug(db,'about'),assetVersion=deploymentVersion(env);return new Response(page?renderAbout({page,origin,assetVersion}):renderNotFound({origin,assetVersion}),{status:page?200:404,headers:htmlHeaders});}
