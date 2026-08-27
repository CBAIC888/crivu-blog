import { bundle, collections, deploymentVersion, projects } from './_content.js';
import { htmlHeaders, renderCollections } from '../src/renderers/public-site.js';
export async function onRequest({env,request}){const {db}=await bundle(env),[items,projectItems]=await Promise.all([collections(db),projects(db)]);return new Response(renderCollections({items,projects:projectItems,origin:new URL(request.url).origin,assetVersion:deploymentVersion(env)}),{headers:htmlHeaders});}
