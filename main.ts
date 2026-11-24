import { mkdir, readFile, writeFile, readdir, copyFile, stat } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here=resolve(fileURLToPath(new URL('.',import.meta.url)));
const args=process.argv.slice(2);
function option(flag:string,fallback:string):string {const i=args.indexOf(flag);return i<0?fallback:(args[i+1]??fallback);}
const source=option('--input','/input'), out=option('--output',process.env.MAKEFUN_OUTPUT_DIR||'/output');
const input=(await stat(source)).isDirectory()?join(source,'snapshot.json'):source;
const snapshot=parseSnapshot(await readFile(input,'utf8'));
const {rows,radar}=buildRadar(snapshot), issue=boardIssue(rows,snapshot.watchlist);
if(issue){console.error(issue);process.exit(1);}
await mkdir(out,{recursive:true});
await writeFile(join(out,'board.json'),JSON.stringify({rows},null,2)+'\n');
await writeFile(join(out,'data.js'),dataScript(radar));
async function copyTree(from:string,to:string):Promise<number>{
 await mkdir(to,{recursive:true});let count=0;
 for(const ent of await readdir(from,{withFileTypes:true})){
  if(ent.name.startsWith('.'))continue;
  const a=join(from,ent.name),b=join(to,ent.name);
  if(ent.isFile()){await copyFile(a,b);count++;}
  else if(ent.isDirectory())count+=await copyTree(a,b);
 }
 return count;
}
const dashboardFiles=await copyTree(join(here,'dashboard'),join(out,'dashboard'));
const shotSource=join(here,'screenshots'), shotOut=join(out,'screenshots');
await mkdir(shotOut,{recursive:true});
let shots=0,files=2+dashboardFiles;
for(const ent of await readdir(shotSource,{withFileTypes:true})){
 if(ent.name.startsWith('.'))continue;
 if(!/^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(ent.name))throw new Error('Invalid screenshot name: '+ent.name);
 if(!ent.isFile())continue;
 await copyFile(join(shotSource,ent.name),join(shotOut,ent.name));shots++;files++;
}
if(shots<3)throw new Error('At least three screenshots are required');
const dossier=buildDossier(out,{text_max_bytes:65536,screenshots:{max:4,max_bytes:524288},dashboard:{max_files:400,max_bytes:4194304}});
await writeFile(join(out,'dossier.json'),dossier);
console.log(`Protocols: ${snapshot.protocols.length}; watchlist: ${snapshot.watchlist.length}; rows scored: ${rows.length}`);
console.log(`Files written: ${files+2}`);
