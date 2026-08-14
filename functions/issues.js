import { bundle, collections, deploymentVersion } from './_content.js';
import { htmlHeaders, renderCollections } from '../src/renderers/public-site.js';
export async function onRequest({env,request}){const {db}=await bundle(env);return new Response(renderCollections({items:await collections(db),origin:new URL(request.url).origin,assetVersion:deploymentVersion(env)}),{headers:htmlHeaders});}
