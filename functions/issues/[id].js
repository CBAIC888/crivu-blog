import { bundle, collectionById } from '../_content.js';
import { htmlHeaders, renderCollection, renderNotFound } from '../../src/renderers/public-site.js';
export async function onRequest({env,request,params}){const {db}=await bundle(env),origin=new URL(request.url).origin,item=await collectionById(db,params.id);return new Response(item?renderCollection({item,origin}):renderNotFound({origin}),{status:item?200:404,headers:htmlHeaders});}
