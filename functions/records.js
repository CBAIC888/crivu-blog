import { bundle, deploymentVersion, projects } from './_content.js';
import { htmlHeaders, renderProjects } from '../src/renderers/public-site.js';
export async function onRequest({env,request}){const {db}=await bundle(env);return new Response(renderProjects({items:await projects(db),origin:new URL(request.url).origin,assetVersion:deploymentVersion(env)}),{headers:htmlHeaders});}
