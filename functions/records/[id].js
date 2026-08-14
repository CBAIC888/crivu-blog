import { bundle, projectBySlug } from '../_content.js';
import { htmlHeaders, renderNotFound, renderProject } from '../../src/renderers/public-site.js';
export async function onRequest({env,request,params}){const {db}=await bundle(env),origin=new URL(request.url).origin,item=await projectBySlug(db,params.id);return new Response(item?renderProject({item,origin}):renderNotFound({origin}),{status:item?200:404,headers:htmlHeaders});}
