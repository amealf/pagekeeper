import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../extension/worker.js',import.meta.url),'utf8'),core=await readFile(new URL('../extension/core.js',import.meta.url),'utf8');
function fixture({url='https://example.test/list',downloadState='in_progress',session,local}={}){
  session=session || {controlId:1,binding:{tabId:2,url:'https://example.test/list',origin:'https://example.test'},running:false};local=local || {};
  const closed=[],messages=[];let changed,listener;const tabs=new Map([[1,{id:1,url:'chrome-extension://test/control.html'}],[2,{id:2,url}]]);
  const store=data=>({async get(keys){return typeof keys==='string'?{[keys]:data[keys]}:Object.fromEntries(keys.map(k=>[k,data[k]]));},async set(values){Object.assign(data,values);}});
  const downloads=new Map();
  const chrome={runtime:{id:'test',getURL:x=>`chrome-extension://test/${x}`,onMessage:{addListener:fn=>listener=fn},async sendMessage(m){messages.push(m);}},action:{onClicked:{addListener(){}}},storage:{session:store(session),local:store(local)},scripting:{async executeScript(){}},permissions:{async contains(){return true;}},tabs:{async get(id){if(!tabs.has(id))throw Error('No tab with id');return tabs.get(id);},async remove(id){closed.push(id);tabs.delete(id);}},downloads:{async download(){downloads.set(10,{id:10,state:downloadState,filename:'/downloads/pagekeeper/example.html'});return 10;},async search({id}){return downloads.has(id)?[downloads.get(id)]:[];},onChanged:{addListener:fn=>changed=fn}}};
  const context=vm.createContext({chrome,console,URL,crypto:{randomUUID:()=> 'fixture-browser-session'},importScripts(){vm.runInContext(core,context);}});vm.runInContext(code,context);
  async function send(m,sender={id:'test',url:'chrome-extension://test/control.html',tab:{id:1}}){return new Promise(resolve=>{const result=listener(m,sender,resolve);if(result!==true)resolve(null);});}
  async function complete(){downloads.get(10).state='complete';changed({id:10,state:{current:'complete'}});await new Promise(r=>setTimeout(r,25));}
  return {send,complete,closed,local,session,tabs,downloads,messages};
}
const save={type:'PT_DOWNLOAD',tabId:2,url:'https://example.test/list',blobUrl:'blob:chrome-extension://test/file',filename:'pagekeeper/example-2026-10-10T10-00-00Z.html',closeAfterSave:true};
test('source stays open until completed download and only bound source closes',async()=>{
  const f=fixture();assert.equal((await f.send(save)).ok,true);assert.deepEqual(f.closed,[]);await f.complete();assert.deepEqual(f.closed,[2]);assert.equal(f.local['download:10'].closeStatus,'closed_after_save');assert.ok(f.tabs.has(1));
});
test('navigation changes and incomplete downloads preserve the source',async()=>{
  const f=fixture({url:'https://example.test/other'});await f.send(save);await f.complete();assert.deepEqual(f.closed,[]);assert.equal(f.local['download:10'].closeStatus,'kept_navigation_changed');
});
test('tiny completed download is handled even before onChanged fires',async()=>{
  const f=fixture({downloadState:'complete'});await f.send(save);assert.deepEqual(f.closed,[2]);
});
test('untrusted messages, blobs, filenames and mismatched bindings are rejected',async()=>{
  const f=fixture();assert.equal(await f.send(save,{id:'test',url:'https://example.test/list',tab:{id:2}}),null);
  assert.equal((await f.send({...save,tabId:3})).ok,false);assert.equal((await f.send({...save,blobUrl:'https://example.test/file'})).ok,false);assert.equal((await f.send({...save,filename:'../outside.html'})).ok,false);
});
test('recovered archive can export without adopting or closing a new bound source',async()=>{
  const f=fixture();const result=await f.send({...save,tabId:99,closeAfterSave:false});assert.equal(result.ok,true);await f.complete();assert.deepEqual(f.closed,[]);
});
test('a completed old download after a browser restart does not close new tabs',async()=>{
  const f=fixture();await f.send(save);f.session.sessionNonce='different-browser-session';await f.complete();assert.deepEqual(f.closed,[]);assert.equal(f.local['download:10'].closeStatus,'kept_browser_restarted');
});
