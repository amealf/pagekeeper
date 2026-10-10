/* Control lives in a visible extension tab, not an expiring service-worker timer. */
const $ = id => document.getElementById(id);
const Core = globalThis.PageTurnerCore;
const labels = {date_boundary:'已到达日期边界',end_marker:'已看到页面结束标记',no_new_content:'页面没有继续加载，已保存部分进度',user_stop:'已按要求停止',step_limit:'已达到本次翻页上限',time_limit:'已达到本次时间上限',size_limit:'本次保存内容已达到容量上限',error:'读取中断，已保留进度',control_closed:'控制页曾关闭，已恢复保存记录'};
let adapters = [], binding = null, run = null, records = new Map(), working = false, starting = false, saving = false, stopRequested = false, wake = null;
let database;
const pendingObjectUrls = new Map();
const dbReady = new Promise((resolve,reject) => {
  const request = indexedDB.open('local-page-turner',1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore('runs',{keyPath:'id'});
    request.result.createObjectStore('records',{keyPath:'storageKey'});
  };
  request.onsuccess = () => {database=request.result;resolve();};
  request.onerror = () => reject(request.error);
});
async function dbPut(meta, changed=[]) {
  await dbReady;
  return new Promise((resolve,reject) => {
    const tx = database.transaction(['runs','records'],'readwrite');
    tx.objectStore('runs').put({...meta});
    for (const row of changed) tx.objectStore('records').put({...row,storageKey:`${meta.id}|${row.key}`,runId:meta.id});
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
async function dbGetLatest() {
  await dbReady;
  const all = await new Promise((resolve,reject) => {const r=database.transaction('runs').objectStore('runs').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const meta = all.sort((a,b)=>b.started_at.localeCompare(a.started_at))[0];
  if (!meta) return null;
  const rows = await new Promise((resolve,reject) => {
    const range = IDBKeyRange.bound(`${meta.id}|`,`${meta.id}|\uffff`);
    const r=database.transaction('records').objectStore('records').getAll(range);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  return {meta,rows};
}
async function command(message) {
  const r = await chrome.runtime.sendMessage(message);
  if (!r?.ok) throw new Error(r?.error || '插件连接中断');
  return r;
}
function controls() {
  for (const id of ['source','open','adapter','cutoff','mode','format','ordered','close','config','save-adapter','start','recover','import-adapter','export-adapter','clear-date']) $(id).disabled=working || starting || saving;
  document.querySelectorAll('[data-months]').forEach(el=>{el.disabled=working || starting || saving;});
  $('stop').disabled=!working || saving;
  $('export').disabled=!run || working || saving;
  $('state-dot').className=`state-dot ${working ? 'running' : run?.status==='saved' ? 'saved' : ''}`;
}
function setMessage(text,kind='info') {
  $('message').dataset.kind=kind;$('message').setAttribute('role',kind==='error'?'alert':'status');$('message').textContent=text;
}
function showError(e) { setMessage(e.message || String(e),'error'); }
function parseConfig(text) {
  try {return JSON.parse(text);} catch {throw new Error('网站配置的 JSON 格式不正确，请检查引号、逗号和括号。');}
}
function showBinding() {
  $('binding').textContent=binding ? '已绑定来源页。完成保存后仅关闭这个页面。' : '也可以在来源页点击插件图标，绑定当前页面。';
  if (binding) $('source').value=binding.url;
}
function showAdapter(a) {
  $('config').value=JSON.stringify(a,null,2);$('mode').value=a.mode;$('ordered').checked=a.newestFirst;
}
function populateAdapters(id) {
  $('adapter').replaceChildren(...adapters.map(a=>{const option=document.createElement('option');option.value=a.id;option.textContent=a.name;return option;}));
  if (id) $('adapter').value=id;
  showAdapter(adapters.find(a=>a.id===$('adapter').value) || adapters[0]);
}
function progress() {
  const dates = [...records.values()].map(x=>x.date?.lower).filter(x=>Number.isFinite(x));
  const earliest = dates.length ? new Date(Math.min(...dates)).toISOString().slice(0,10) : '尚未识别';
  $('progress').textContent=`已翻页 ${run?.steps || 0} 次；保存 ${records.size} 个内容记录。最早日期范围起点：${earliest}。`;
}
function wait(ms) { return new Promise(resolve=>{const t=setTimeout(()=>{wake=null;resolve();},ms);wake=()=>{clearTimeout(t);wake=null;resolve();};}); }
async function read(adapter) {
  // Navigation replaces the content script. Re-inject only after the bound page is ready.
  let lastError;
  for (let attempt=0;attempt<3;attempt++) {
    try {
      const r=await chrome.tabs.sendMessage(binding.tabId,{type:'PT_READ',adapter,now:Date.now()});
      if (!r?.ok) throw new Error(r?.error || '来源页无响应');
      if (new URL(r.snapshot.url).origin !== binding.origin) throw new Error('来源页已跳到其他网站');
      if (adapter.mode!=='next' && r.snapshot.url!==binding.url) throw new Error('来源页网址已改变，停止读取并保留该页面');
      return r.snapshot;
    } catch(e) {
      lastError=e;
      if (attempt<2) {await command({type:'PT_PREPARE'});await wait(500);}
    }
  }
  throw lastError;
}
async function capture(snapshot) {
  const changed=[];
  for (const row of snapshot.items) {
    const previous=records.get(row.key);
    if (!previous || previous.text !== row.text || previous.html !== row.html) {
      const merged={...row,first_observed_at:previous?.first_observed_at || row.observed_at,order:previous?.order ?? records.size,
        previous_text:previous && previous.text !== row.text ? previous.text : previous?.previous_text || null};
      run.content_size += merged.text.length + merged.html.length - (previous ? previous.text.length+previous.html.length : 0);
      records.set(row.key,merged);changed.push(merged);
    }
  }
  run.last_url=snapshot.url;run.last_observed_at=new Date().toISOString();run.title=snapshot.title;
  run.position=snapshot.position;run.missing_items=snapshot.missingItems;
  await dbPut(run,changed);progress();
  return changed.length;
}
async function start() {
  if (working || starting || saving) return;
  starting=true;controls();
  $('message').textContent='';$('saved').textContent='';
  try {
    const adapter=Core.validateAdapter({...parseConfig($('config').value),mode:$('mode').value,newestFirst:$('ordered').checked});
    const cutoff=$('cutoff').value;
    if (cutoff && adapter.newestFirst && (!adapter.itemSelector || !adapter.dateSelector)) throw new Error('日期停止需要填写内容块与日期选择器');
    const prepared=await command({type:'PT_PREPARE'});binding=prepared.binding;showBinding();
    const initial=await read(adapter);
    if (initial.missingItems) throw new Error('未找到内容块。请调整网站配置后再开始。');
    run={id:crypto.randomUUID(),source_url:binding.url,last_url:binding.url,source_tab_id:binding.tabId,
      started_at:new Date().toISOString(),cutoff_date:cutoff || null,adapter,format:$('format').value,
      close_after_save:$('close').checked,steps:0,content_size:0,coverage:'partial',reason:null,status:'running'};
    records=new Map();stopRequested=false;working=true;starting=false;controls();
    await command({type:'PT_RUNNING',value:true});
    $('status').textContent='正在翻页';
    await capture(initial);
    let unchanged=0, snapshot=initial;
    while (true) {
      if (stopRequested) {run.reason='user_stop';break;}
      if (snapshot.missingItems) {run.reason='error';run.error='页面内容块消失，配置可能已失效';break;}
      const cutoffTime=cutoff ? Date.parse(`${cutoff}T00:00:00Z`) : null;
      if (Core.reachedBoundary(snapshot.items,cutoffTime,adapter)) {
        run.reason='date_boundary';
        // Unreadable dates remain real coverage gaps, including earlier snapshots.
        const unknown=[...records.values()].filter(x=>!x.pinned && !x.date).length;
        run.unknown_date_items=unknown;run.coverage=unknown ? 'partial' : 'date_boundary_reached';break;
      }
      const bottom=Core.bottomResult({...snapshot,unchanged,paginated:adapter.mode==='next'});
      if (bottom) {Object.assign(run,bottom);break;}
      if (run.steps>=adapter.maxSteps) {run.reason='step_limit';break;}
      if (Date.now()-Date.parse(run.started_at)>30*60*1000) {run.reason='time_limit';break;}
      if (run.content_size>12*1024*1024 || records.size>=3000) {run.reason='size_limit';break;}
      if (adapter.mode!=='next' || snapshot.hasNext) {
        const step=await chrome.tabs.sendMessage(binding.tabId,{type:'PT_STEP',adapter});
        if (!step?.ok) throw new Error(step?.error || '翻页未成功');
        run.steps++;
      }
      await wait(adapter.intervalMs);
      snapshot=await read(adapter);
      const changes=await capture(snapshot);unchanged=changes===0 ? unchanged+1 : 0;
    }
    // Preserve the last loaded page when Stop was pressed during a loading interval.
    if (run.reason==='user_stop') {try {await capture(await read(adapter));} catch(e) {run.error=e.message;}}
  } catch(e) {
    if (!working) {starting=false;controls();showError(e);return;}
    run.reason='error';run.error=e.message;showError(e);
  }
  if (working) {
    working=false;run.status='stopped';run.stopped_at=new Date().toISOString();
    $('status').textContent=labels[run.reason] || '已停止';
    if (run.error) $('message').textContent=run.error;
    try {await dbPut(run);await exportRun();} catch(e) {showError(e);}
    await command({type:'PT_RUNNING',value:false}).catch(showError);controls();
  }
}
const escapeHtml = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function buildFile(meta,rows) {
  const payload={schema:'local-page-save/v1',run:meta,records:rows.map(({storageKey,runId,...row})=>row)};
  if (meta.format==='json') return {text:JSON.stringify(payload,null,2),type:'application/json'};
  const heading=[meta.title,`来源：${meta.source_url}`,`最后页面：${meta.last_url}`,`开始：${meta.started_at}`,`停止：${labels[meta.reason] || meta.reason}`,`覆盖：${meta.coverage}`,`截止日期：${meta.cutoff_date || '未指定'}`,meta.error ? `待处理：${meta.error}` : ''].filter(Boolean).join('\n');
  if (meta.format==='txt') return {text:heading+'\n\n'+rows.map((x,i)=>`===== ${i+1} =====\n观察时间：${x.observed_at}\n日期原文：${x.date_raw || '未知'}\n所在页面：${x.source_url}\n${x.text}\n\n链接：\n${x.links.join('\n')}`).join('\n\n'),type:'text/plain'};
  // Inert archive: no external resource loads or executable website scripts.
  const json=JSON.stringify(payload).replace(/</g,'\\u003c');
  const body=rows.map((x,i)=>`<article><h2>记录 ${i+1}</h2><p>${escapeHtml(x.date_raw || '日期未知')} · ${escapeHtml(x.source_url)}</p>${x.html}<details><summary>原始文本与链接</summary><pre>${escapeHtml(x.text+'\n\n'+x.links.join('\n'))}</pre></details></article>`).join('\n');
  return {type:'text/html',text:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(meta.title || '本地页面保存')}</title><style>body{max-width:900px;margin:30px auto;padding:20px;font:16px/1.65 system-ui;color:#26332e}pre{white-space:pre-wrap;overflow-wrap:anywhere}article{border-top:1px solid #ddd;padding:20px 0}a{color:#286747}</style></head><body><pre>${escapeHtml(heading)}</pre>${body}<script type="application/json" id="page-save-data">${json}</script></body></html>`};
}
async function exportRun() {
  if (!run || saving || working) return;
  saving=true;controls();$('saved').textContent='正在保存文件；完成后再关闭来源页。';
  let objectUrl, id, completed=false;
  try {
    const rows=[...records.values()].sort((a,b)=>a.order-b.order);
    const file=buildFile(run,rows);
    objectUrl=URL.createObjectURL(new Blob([file.text],{type:`${file.type};charset=utf-8`}));
    const hostname=new URL(run.source_url).hostname.replace(/[^a-z0-9.-]/gi,'_');
    const filename=`pagekeeper/${hostname}-${run.started_at.replace(/[:.]/g,'-')}-${run.id.slice(0,8)}.${run.format}`;
    const result=await command({type:'PT_DOWNLOAD',blobUrl:objectUrl,filename,tabId:run.source_tab_id,url:run.last_url,
      closeAfterSave:run.close_after_save});
    id=result.id;pendingObjectUrls.set(id,objectUrl);run.download_id=id;await dbPut(run);
    // onChanged closes the exact source immediately, without waiting for this UI poll.
    let download;
    const end=Date.now()+120000;
    do {
      [download]=await chrome.downloads.search({id:result.id});
      if (download?.state==='interrupted') {completed=true;throw new Error(`保存未完成：${download.error || '下载中断'}。来源页保持打开。`);}
      if (download?.state==='complete') {completed=true;break;}
      await wait(500);
    } while(Date.now()<end);
    if (download?.state!=='complete') throw new Error('保存仍在等待 Chrome 完成，请查看下载列表。来源页将在保存完成后关闭。');
    run.status='saved';run.saved_at=new Date().toISOString();run.saved_path=download.filename;await dbPut(run);
    const data=await chrome.storage.local.get(`download:${id}`);
    const status=data[`download:${id}`]?.closeStatus;
    $('saved').textContent=`文件已保存：${download.filename}${status==='closed_after_save' ? ' 来源页已关闭。' : ''}`;
  } finally { if(objectUrl && (completed || !id)) {URL.revokeObjectURL(objectUrl);if(id) pendingObjectUrls.delete(id);} saving=false;controls(); }
}
$('adapter').addEventListener('change',()=>showAdapter(adapters.find(a=>a.id===$('adapter').value)));
document.querySelectorAll('[data-months]').forEach(button=>button.addEventListener('click',()=>{
  const now=new Date(), day=now.getDate();now.setDate(1);now.setMonth(now.getMonth()-Number(button.dataset.months));
  now.setDate(Math.min(day,new Date(now.getFullYear(),now.getMonth()+1,0).getDate()));
  $('cutoff').value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}));
$('clear-date').addEventListener('click',()=>{$('cutoff').value='';});
$('export-adapter').addEventListener('click',()=>{
  try {
    const a=Core.validateAdapter(parseConfig($('config').value));
    const url=URL.createObjectURL(new Blob([JSON.stringify(a,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`pagekeeper-${a.id.replace(/[^a-z0-9_-]/gi,'_')}.json`;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
  } catch(e) {showError(e);}
});
$('import-adapter').addEventListener('change',async event=>{
  try {
    const file=event.target.files[0];if(!file)return;
    if(file.size>65536) throw new Error('网站配置文件太大');
    const a=Core.validateAdapter(parseConfig(await file.text()));
    adapters=adapters.filter(x=>x.id!==a.id).concat(a);await chrome.storage.local.set({adapters});populateAdapters(a.id);
    setMessage('网站配置已导入。');
  } catch(e) {showError(e);} finally {event.target.value='';}
});
$('save-adapter').addEventListener('click',async()=>{
  try {
    const a=Core.validateAdapter(parseConfig($('config').value));
    adapters=adapters.filter(x=>x.id!==a.id).concat(a);
    await chrome.storage.local.set({adapters});populateAdapters(a.id);setMessage('配置已保存。');
  } catch(e) {showError(e);}
});
$('open').addEventListener('click',async()=>{
  try {
    const url=new URL($('source').value);
    if (!['https:','http:'].includes(url.protocol) || url.username || url.password) throw new Error('请填写普通 HTTP／HTTPS 网址');
    // Request directly inside the click gesture, only for this single website.
    const granted=await chrome.permissions.request({origins:[`${url.origin}/*`]});
    if (!granted) throw new Error('尚未允许这个网站');
    const r=await command({type:'PT_OPEN',url:url.href});binding=r.binding;showBinding();
    if (url.hostname==='www.linkedin.com') {$('adapter').value='linkedin-activity';showAdapter(adapters.find(a=>a.id==='linkedin-activity'));}
    setMessage('来源页已打开，等内容加载后点击「开始翻页」。');
  } catch(e) {showError(e);}
});
$('start').addEventListener('click',start);
$('stop').addEventListener('click',()=>{stopRequested=true;wake?.();$('status').textContent='正在停止并保存';});
$('export').addEventListener('click',()=>exportRun().catch(showError));
$('recover').addEventListener('click',async()=>{
  try {
    const stored=await dbGetLatest();if(!stored) throw new Error('还没有保存记录');
    run=stored.meta;records=new Map(stored.rows.map(x=>[x.key,x]));
    if (run.status==='running') {run.reason='control_closed';run.status='stopped';run.coverage='partial';run.stopped_at=new Date().toISOString();}
    // Recovering never adopts or closes a currently unrelated source.
    run.close_after_save=false;
    $('status').textContent=labels[run.reason] || '已恢复记录';progress();controls();
    $('saved').textContent='记录已恢复，可重新保存。来源页需要重新绑定才可继续新任务。';
  } catch(e) {showError(e);}
});
chrome.runtime.onMessage.addListener(m=>{
  if (m.type==='PT_BOUND' && !working && !saving) {binding=m.binding;showBinding();}
  if (m.type==='PT_SAVED' && (!run || !run.download_id || run.download_id===m.id)) {
    const url=pendingObjectUrls.get(m.id);if(url){URL.revokeObjectURL(url);pendingObjectUrls.delete(m.id);}
    const suffix={closed_after_save:'来源页已关闭。',kept_navigation_changed:'来源页已切换到其他页面，已保留。',source_already_closed:'来源页已经关闭。',kept_by_choice:'按本次设置保留来源页。',kept_browser_restarted:'浏览器曾重启，已保留当前页面。',close_failed:'保存已完成，关闭页面未成功；请手动关闭来源页。'}[m.closeStatus] || '';
    $('saved').textContent=`文件已保存：${m.path} ${suffix}`;
  }
});
window.addEventListener('beforeunload',e=>{if(working || starting || saving){e.preventDefault();e.returnValue='';}});
(async()=>{
  const defaults=await (await fetch('adapters.json')).json();
  const stored=await chrome.storage.local.get('adapters');adapters=stored.adapters || defaults;populateAdapters();
  const s=await command({type:'PT_STATE'});binding=s.binding;showBinding();
  if (s.running) {
    await command({type:'PT_RUNNING',value:false});
    setMessage('前一次控制页已中断。可恢复最近记录，翻页不会自动重启。');
  }
  if (binding && new URL(binding.url).hostname==='www.linkedin.com') {$('adapter').value='linkedin-activity';showAdapter(adapters.find(a=>a.id==='linkedin-activity'));}
  controls();
})().catch(showError);
