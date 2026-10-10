// Explicitly labelled fixture. Excluded from every extension release package.
(() => {
  const listeners=[],local={},session={binding:{tabId:2,url:'https://example.test/news',origin:'https://example.test'},running:false};
  let page=0;const downloads=new Map();
  const store=data=>({async get(key){if(Array.isArray(key))return Object.fromEntries(key.map(k=>[k,data[k]]));return {[key]:data[key]};},async set(value){Object.assign(data,value);}});
  const rows=()=>Array.from({length:Math.min(3+page,8)},(_,i)=>({key:`demo-${i}`,text:`示例内容 ${i+1}\n这是一条用于测试本地存档的公开示例记录。`,html:`<p>示例内容 ${i+1}</p>`,links:[`https://example.test/news/${i+1}`],source_url:session.binding.url,date_raw:'2026-10-10',date:{lower:1791590400000,upper:1791676799999},pinned:false,observed_at:new Date().toISOString()}));
  globalThis.chrome={storage:{local:store(local)},permissions:{async request(){return true;}},runtime:{onMessage:{addListener:f=>listeners.push(f)},async sendMessage(m){
    if(m.type==='PT_STATE'||m.type==='PT_PREPARE')return{ok:true,...session};
    if(m.type==='PT_RUNNING'){session.running=m.value;return{ok:true};}
    if(m.type==='PT_OPEN'){session.binding={tabId:2,url:m.url,origin:new URL(m.url).origin};page=0;return{ok:true,binding:session.binding};}
    if(m.type==='PT_DOWNLOAD'){
      const id=downloads.size+1,path=`Downloads/${m.filename}`;
      const file=await (await fetch(m.blobUrl)).blob();const url=URL.createObjectURL(file);const link=document.createElement('a');link.href=url;link.download=m.filename.split('/').pop();link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
      downloads.set(id,{id,state:'complete',filename:path});const closeStatus=m.closeAfterSave?'closed_after_save':'kept_by_choice';local[`download:${id}`]={closeStatus};
      setTimeout(()=>listeners.forEach(f=>f({type:'PT_SAVED',id,path,closeStatus})),100);return{ok:true,id};
    }
    return{ok:false,error:'预览不支持这个命令'};
  }},tabs:{async sendMessage(id,m){if(m.type==='PT_STEP'){page++;return{ok:true};}return{ok:true,snapshot:{url:session.binding.url,title:'示例新闻列表',items:rows(),atBottom:page>=5,missingItems:false,position:page*500,height:4000,ended:false,busy:false,hasNext:page<5}};}},downloads:{async search({id}){return [downloads.get(id)];}}};
})();
