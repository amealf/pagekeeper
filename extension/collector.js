(() => {
  if (globalThis.__localPageTurner) return;
  globalThis.__localPageTurner = true;
  const Core = globalThis.PageTurnerCore;
  const visible = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  function hash(text) {
    let h = 2166136261;
    for (let i=0;i<text.length;i++) h = Math.imul(h ^ text.charCodeAt(i),16777619);
    return (h >>> 0).toString(16);
  }
  function safeHtml(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('script,style,iframe,object,embed,link,meta,input,textarea,select').forEach(x=>x.remove());
    for (const node of [clone,...clone.querySelectorAll('*')]) {
      for (const attr of [...node.attributes]) {
        if (/^on/i.test(attr.name) || ['src','srcset','style','action','formaction','srcdoc','ping'].includes(attr.name) || (/^(href|xlink:href)$/i.test(attr.name) && !/^(https?:|mailto:|#)/i.test(attr.value))) node.removeAttribute(attr.name);
      }
    }
    return clone.outerHTML;
  }
  function selectors(a) {
    for (const key of ['itemSelector','dateSelector','linkSelector','scrollSelector','endSelector','busySelector','nextSelector','pinnedSelector']) {
      if (a[key]) document.querySelector(a[key]); // Validate before scrolling.
    }
  }
  function read(a, now) {
    selectors(a);
    const scroller = a.scrollSelector ? document.querySelector(a.scrollSelector) : document.scrollingElement;
    if (!scroller) throw new Error('找不到指定的滚动区域');
    const roots = a.itemSelector ? [...document.querySelectorAll(a.itemSelector)].filter(visible) : [document.querySelector('main') || document.body];
    const items = roots.map(el => {
      const text = el.innerText || '';
      // Date belongs to the first selected header, never a date inferred from the post body.
      const dateEl = a.dateSelector ? el.querySelector(a.dateSelector) : null;
      const rawDate = dateEl ? (a.dateAttribute && dateEl.getAttribute(a.dateAttribute)) || dateEl.innerText?.split('\n').map(x=>x.trim()).find(Boolean) || '' : '';
      const urls = [...el.querySelectorAll('a[href]')].map(x=>x.href).filter(x=>/^(https?:|mailto:)/i.test(x));
      const link = a.linkSelector ? el.querySelector(a.linkSelector)?.href : null;
      const identity = a.idAttribute && el.getAttribute(a.idAttribute);
      const key = identity || (a.itemSelector && link) || `text:${hash(text)}`;
      return {key, text, html:safeHtml(el), links:[...new Set(urls)], identity:identity || null,
        url:link || null, date:Core.dateRange(rawDate,now), date_raw:rawDate,
        pinned:!!a.pinnedSelector && (el.matches(a.pinnedSelector) || !!el.querySelector(a.pinnedSelector)),
        observed_at:new Date().toISOString(), source_url:location.href};
    }).filter(x=>x.text.trim());
    const next = a.nextSelector && document.querySelector(a.nextSelector);
    const hasNext = !!next && visible(next) && !next.disabled && next.getAttribute('aria-disabled') !== 'true';
    return {url:location.href,title:document.title,items, missingItems:!!a.itemSelector && roots.length===0,
      atBottom: scroller.scrollHeight-scroller.scrollTop-scroller.clientHeight <= 8,
      position:scroller.scrollTop,height:scroller.scrollHeight,
      ended:!!a.endSelector && visible(document.querySelector(a.endSelector)),
      busy:!!a.busySelector && visible(document.querySelector(a.busySelector)),hasNext};
  }
  chrome.runtime.onMessage.addListener((m, sender, reply) => {
    if (sender.id !== chrome.runtime.id || !['PT_READ','PT_STEP'].includes(m.type)) return;
    try {
      const a = Core.validateAdapter(m.adapter);
      if (m.type === 'PT_STEP') {
        selectors(a);
        if (a.mode === 'next') {
          const next = document.querySelector(a.nextSelector);
          if (!visible(next) || next.disabled || next.getAttribute('aria-disabled') === 'true') throw new Error('下一页按钮不可用');
          if (next.tagName === 'A') {
            const target = new URL(next.href,location.href);
            if (target.origin !== location.origin) throw new Error('下一页跳到其他网站，已停止');
            if (next.target && next.target !== '_self') throw new Error('下一页会打开新标签页，请调整网站配置');
          }
          // Reply before a full navigation destroys this content-script context.
          setTimeout(()=>next.click(),0);
        } else {
          const el = a.scrollSelector ? document.querySelector(a.scrollSelector) : document.scrollingElement;
          if (!el) throw new Error('滚动区域已消失');
          if (a.mode === 'end') el.scrollTo({top:el.scrollHeight,behavior:'instant'});
          else el.scrollBy({top:Math.max(200,Math.floor(el.clientHeight * .85)),behavior:'instant'});
        }
        reply({ok:true});
      } else reply({ok:true,snapshot:read(a,m.now)});
    } catch(e) { reply({ok:false,error:e.message}); }
  });
})();
