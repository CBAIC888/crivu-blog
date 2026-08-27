import { bundle, collections, deploymentVersion, projects } from './_content.js';
import { applyPublicSettings, htmlHeaders, renderCollections } from '../src/renderers/public-site.js';
export async function onRequest({env,request}){const {db,settings}=await bundle(env),[items,projectItems]=await Promise.all([collections(db),projects(db)]);return new Response(applyPublicSettings(renderCollections({items,projects:projectItems,origin:new URL(request.url).origin,assetVersion:deploymentVersion(env)}),settings),{headers:htmlHeaders});}
