import { articles, bundle, deploymentVersion } from './_content.js';
import { applyPublicSettings, htmlHeaders, renderArticles } from '../src/renderers/public-site.js';
export async function onRequest({env,request}){const {db,settings}=await bundle(env);return new Response(applyPublicSettings(renderArticles({items:await articles(db),origin:new URL(request.url).origin,assetVersion:deploymentVersion(env)}),settings),{headers:htmlHeaders});}
