import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {zip} from './binary.mjs';
const root=new URL('../extension/',import.meta.url),files=[];
const allow=new Set(['manifest.json','core.js','collector.js','worker.js','control.js','control.css','control.html','guide.html','privacy.html','adapters.json','icons/icon-16.png','icons/icon-32.png','icons/icon-48.png','icons/icon-128.png']);
async function collect(base=''){
  for(const item of await readdir(new URL(base,root),{withFileTypes:true})){
    const relative=base+item.name;if(item.isDirectory())await collect(relative+'/');
    else {if(!allow.has(relative))throw Error(`Non-release file in extension/: ${relative}`);files.push([relative,await readFile(new URL(relative,root))]);}
  }
}
await collect();if(files.length!==allow.size)throw Error('Missing release asset');
files.sort((a,b)=>a[0].localeCompare(b[0]));
const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
const dist=new URL('../dist/',import.meta.url);await mkdir(dist,{recursive:true});
await writeFile(new URL(`pagekeeper-${manifest.version}.zip`,dist),zip(files));
console.log(`dist/pagekeeper-${manifest.version}.zip`);
