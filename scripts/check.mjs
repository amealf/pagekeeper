import {readFile,readdir,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=new URL('../extension/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
if(manifest.manifest_version!==3)throw Error('Expected MV3');
if(manifest.host_permissions || manifest.externally_connectable)throw Error('Unexpected broad/external access');
if(manifest.permissions.join(',')!=='activeTab,scripting,storage,downloads')throw Error('Permission list changed: review required');
const context=vm.createContext({});vm.runInContext(await readFile(new URL('core.js',root),'utf8'),context);
for(const a of JSON.parse(await readFile(new URL('adapters.json',root),'utf8')))context.PageTurnerCore.validateAdapter(a);
for(const path of ['worker.js','control.html',...Object.values(manifest.icons)])await access(new URL(path,root));
for(const path of await readdir(root))if(path.endsWith('.js')){
  const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL(path,root))],{encoding:'utf8'});
  if(result.status!==0)throw Error(result.stderr);
}
for(const name of ['control.html','guide.html','privacy.html']){
  const html=await readFile(new URL(name,root),'utf8');
  if(/<script(?![^>]*\bsrc=)[^>]*>\s*\S/i.test(html))throw Error('Inline executable script');
  if(/(?:src|href)=["']https?:[^"']+\.(js|css|woff)/i.test(html))throw Error('Remote executable asset');
  for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g))if(!/^(https?:|#)/.test(m[1]))await access(new URL(m[1],root));
}
console.log('Extension release checks passed.');
