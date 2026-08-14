import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=new Set(process.argv.slice(2)),execute=args.has('--execute');
const bucketIndex=process.argv.indexOf('--bucket'),bucket=bucketIndex>=0?process.argv[bucketIndex+1]:'';
const walk=(directory)=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(directory,entry.name)):[path.join(directory,entry.name)]);
const roots=[['assets/img/uploads','assets/img/uploads'],['src/assets/world-gallery','research/world-gallery']];
const items=roots.flatMap(([source,prefix])=>walk(path.join(root,source)).map(file=>({file,key:`${prefix}/${path.relative(path.join(root,source),file).split(path.sep).join('/')}`})));
const summary={bucket:bucket||null,files:items.length,bytes:items.reduce((sum,item)=>sum+fs.statSync(item.file).size,0),execute};
if(!execute){console.log(JSON.stringify({...summary,instruction:'Review this inventory, then pass --execute --bucket <R2_BUCKET_NAME>. No remote changes were made.'},null,2));process.exit(0);}
if(!bucket)throw new Error('--bucket is required with --execute');
for(const item of items){const result=spawnSync('npx',['wrangler','r2','object','put',`${bucket}/${item.key}`,'--file',item.file,'--remote'],{cwd:root,stdio:'inherit'});if(result.status!==0)throw new Error(`Upload failed: ${item.key}`);}
console.log(JSON.stringify(summary,null,2));
