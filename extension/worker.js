importScripts('core.js');
const state = () => chrome.storage.session.get(['controlId','binding','running']);
const controlUrl = chrome.runtime.getURL('control.html');
const httpUrl = value => {
  const u = new URL(value);
  if (!['http:','https:'].includes(u.protocol) || u.username || u.password) throw new Error('请填写普通 HTTP／HTTPS 网址');
  return u.href;
};
async function inject(tabId) {
  await chrome.scripting.executeScript({target:{tabId},files:['core.js','collector.js']});
}
chrome.action.onClicked.addListener(async tab => {
  try {
    const s = await state();
    let control;
    if (s.controlId) { try { control = await chrome.tabs.get(s.controlId); } catch {} }
    if (control?.url?.startsWith(controlUrl) && s.running) {
      await chrome.tabs.update(control.id,{active:true});
      return;
    }
    let binding = null;
    if (tab.url && /^https?:/.test(tab.url)) {
      await inject(tab.id);
      binding = {tabId:tab.id,url:tab.url,origin:new URL(tab.url).origin};
    }
    await chrome.storage.session.set({binding,running:false});
    if (control?.url?.startsWith(controlUrl)) await chrome.tabs.update(control.id,{active:true});
    else {
      control = await chrome.tabs.create({url:controlUrl});
      await chrome.storage.session.set({controlId:control.id});
    }
    await chrome.runtime.sendMessage({type:'PT_BOUND',binding}).catch(()=>{});
  } catch(e) { console.error('Page Turner:',e.message); }
});
async function finishDownload(id) {
  const key = `download:${id}`, data = await chrome.storage.local.get(key), job = data[key];
  if (!job || job.done) return;
  const [download] = await chrome.downloads.search({id});
  if (download?.state !== 'complete') return;
  let closeStatus = 'kept_by_choice';
  if (job.closeAfterSave) {
    try {
      const tab = await chrome.tabs.get(job.tabId);
      if (PageTurnerCore.closeAllowed(tab,job.url,true)) {
        await chrome.tabs.remove(job.tabId);
        closeStatus = 'closed_after_save';
      } else closeStatus = 'kept_navigation_changed';
    } catch(e) { closeStatus = /No tab|Invalid tab/i.test(e.message) ? 'source_already_closed' : 'close_failed'; }
  }
  await chrome.storage.local.set({[key]:{...job,done:true,path:download.filename,closeStatus}});
  await chrome.runtime.sendMessage({type:'PT_SAVED',id,path:download.filename,closeStatus}).catch(()=>{});
}
// Completion and closing survive the control page closing and MV3 worker suspension.
chrome.downloads.onChanged.addListener(delta => {
  if (delta.state?.current === 'complete') finishDownload(delta.id).catch(console.error);
});
chrome.runtime.onMessage.addListener((m,sender,reply) => {
  if (sender.id !== chrome.runtime.id || sender.url?.split('?')[0] !== controlUrl) return;
  (async () => {
    const s = await state();
    if (s.controlId && s.controlId !== sender.tab?.id) {
      let owner;
      try {owner=await chrome.tabs.get(s.controlId);} catch {}
      if (owner?.url?.startsWith(controlUrl)) throw new Error('请使用已经打开的 Pagekeeper 控制页');
    }
    if (m.type === 'PT_STATE') {
      await chrome.storage.session.set({controlId:sender.tab?.id});
      return s;
    }
    if (m.type === 'PT_OPEN') {
      if (s.running) throw new Error('已有任务正在运行');
      const url = httpUrl(m.url), origin = new URL(url).origin;
      if (!await chrome.permissions.contains({origins:[`${origin}/*`]})) throw new Error('请先允许此网站');
      // One bound source at a time: never abandon an existing source to open another.
      if (s.binding) {
        try { await chrome.tabs.get(s.binding.tabId); throw new Error('请先保存并关闭当前来源页'); }
        catch(e) { if (e.message === '请先保存并关闭当前来源页') throw e; }
      }
      const tab = await chrome.tabs.create({url,active:true});
      const binding = {tabId:tab.id,url,origin};
      await chrome.storage.session.set({binding,controlId:sender.tab?.id ?? s.controlId});
      return {binding};
    }
    if (m.type === 'PT_PREPARE') {
      if (!s.binding) throw new Error('请先打开或绑定来源页');
      const tab = await chrome.tabs.get(s.binding.tabId);
      if (!tab.url || new URL(tab.url).origin !== s.binding.origin) throw new Error('来源页已跳到其他网站');
      await inject(tab.id);
      return {binding:{...s.binding,url:tab.url}};
    }
    if (m.type === 'PT_RUNNING') {
      await chrome.storage.session.set({running:!!m.value});
      return {};
    }
    if (m.type === 'PT_DOWNLOAD') {
      if (m.closeAfterSave && (!s.binding || s.binding.tabId !== m.tabId)) throw new Error('保存任务的来源页不匹配');
      if (!m.blobUrl?.startsWith(`blob:chrome-extension://${chrome.runtime.id}/`)) throw new Error('保存文件来源无效');
      if (!/^pagekeeper\/[a-z0-9._-]+\.(html|txt|json)$/i.test(m.filename)) throw new Error('保存路径无效');
      const id = await chrome.downloads.download({url:m.blobUrl,filename:m.filename,saveAs:false,conflictAction:'uniquify'});
      await chrome.storage.local.set({[`download:${id}`]:{tabId:m.tabId,url:m.url,closeAfterSave:!!m.closeAfterSave,done:false,created_at:new Date().toISOString()}});
      await finishDownload(id); // Also catches a tiny download finishing before its job was stored.
      return {id};
    }
    throw new Error('未知的控制命令');
  })().then(result=>reply({ok:true,...result}),e=>reply({ok:false,error:e.message}));
  return true;
});
