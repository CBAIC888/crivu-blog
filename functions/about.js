import { bundle, deploymentVersion, pageBySlug } from './_content.js';
import { applyPublicSettings, htmlHeaders, renderAbout, renderNotFound } from '../src/renderers/public-site.js';
export async function onRequest({env,request}){const {db,settings}=await bundle(env),origin=new URL(request.url).origin,page=await pageBySlug(db,'about'),assetVersion=deploymentVersion(env);return new Response(applyPublicSettings(page?renderAbout({page,origin,assetVersion}):renderNotFound({origin,assetVersion}),settings),{status:page?200:404,headers:htmlHeaders});}
