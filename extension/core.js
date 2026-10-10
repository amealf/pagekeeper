/* Shared by the extension and its focused Node tests. No website requests. */
(() => {
  const DAY = 86400000;
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  function calendarBack(now, count, unit) {
    const d = new Date(now), day = d.getUTCDate();
    d.setUTCDate(1);
    if (unit === 'month') d.setUTCMonth(d.getUTCMonth() - count);
    else d.setUTCFullYear(d.getUTCFullYear() - count);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
    return d.getTime();
  }
  function dateRange(raw, now = Date.now()) {
    const s = String(raw || '').trim().split('•')[0].trim();
    let m = s.match(/^(\d{4})[-年](\d{1,2})[-月](\d{1,2})(?:日)?$/);
    if (!m) {
      const en = s.match(/^(\d{1,2})\s+([a-z]{3,9})\s+(\d{4})$/i);
      if (en && months.includes(en[2].slice(0,3).toLowerCase())) m = [en[0],en[3],months.indexOf(en[2].slice(0,3).toLowerCase()) + 1,en[1]];
    }
    if (m) {
      const t = Date.UTC(+m[1], +m[2]-1, +m[3]), d = new Date(t);
      if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2]-1 || d.getUTCDate() !== +m[3]) return null;
      return {lower: t, upper: t + DAY - 1, precision: 'day', raw: s};
    }
    if (/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(s)) {
      const t = Date.parse(s);
      return Number.isFinite(t) ? {lower:t, upper:t, precision:'exact', raw:s} : null;
    }
    m = s.match(/^(\d+)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|months?|mo|years?|yr|y|秒|分钟|小时|天|周|个月|月|年)(?:\s*(?:ago|前))?$/i);
    if (!m) return null;
    const n = +m[1], u = m[2].toLowerCase();
    const unit = /^(months?|mo|个月|月)$/.test(u) ? 'month' : /^(years?|yr|y|年)$/.test(u) ? 'year' : null;
    const scale = /^(seconds?|secs?|s|秒)$/.test(u) ? 1000 : /^(minutes?|mins?|m|分钟)$/.test(u) ? 60000 : /^(hours?|hrs?|h|小时)$/.test(u) ? 3600000 : /^(days?|d|天)$/.test(u) ? DAY : 7 * DAY;
    // Rounded relative dates are ranges: "3mo" never becomes an invented exact date.
    return {lower: unit ? calendarBack(now,n+1,unit) : now-(n+1)*scale,
      upper: unit ? calendarBack(now,n,unit) : now-n*scale, precision:'relative_range', raw:s};
  }
  function beforeCutoff(record, cutoff) { return !!record.date && record.date.upper < cutoff; }
  function reachedBoundary(records, cutoff, adapter) {
    if (!cutoff || !adapter.newestFirst) return false;
    const ordered = records.filter(x => !x.pinned);
    // A visible chronological inversion invalidates the assumed ordering.
    let previous;
    for (const row of ordered) {
      if (!row.date) continue;
      if (previous && row.date.lower > previous.upper) return false;
      previous=row.date;
    }
    const tail = ordered.slice(-adapter.boundaryItems);
    return tail.length === adapter.boundaryItems && tail.every(x => beforeCutoff(x,cutoff));
  }
  function bottomResult({atBottom, unchanged, busy, ended, hasNext, paginated}) {
    if (busy) return null;
    if (ended) return {reason:'end_marker', coverage:'end_confirmed'};
    if (unchanged >= 4 && (atBottom || (paginated && !hasNext))) return {reason:'no_new_content', coverage:'partial'};
    return null;
  }
  function closeAllowed(tab, expectedUrl, allComplete) { return allComplete && tab?.url === expectedUrl; }
  function validateAdapter(input) {
    const a = {...input};
    for (const key of ['id','name','itemSelector','dateSelector','dateAttribute','linkSelector','idAttribute','scrollSelector','endSelector','busySelector','nextSelector','pinnedSelector']) {
      if (a[key] == null) a[key] = '';
      if (typeof a[key] !== 'string' || a[key].length > 2000) throw new Error(`配置项 ${key} 无效`);
    }
    if (!a.id || !a.name) throw new Error('请填写配置 id 和 name');
    if (!['page','end','next'].includes(a.mode)) throw new Error('mode 只能是 page、end 或 next');
    if (a.mode === 'next' && !a.nextSelector) throw new Error('下一页模式需要 nextSelector');
    if (a.newestFirst && (!a.itemSelector || !a.dateSelector)) throw new Error('日期停止需要内容块和日期选择器');
    a.intervalMs = Number(a.intervalMs ?? 2500);
    a.maxSteps = Number(a.maxSteps ?? 250);
    a.boundaryItems = Number(a.boundaryItems ?? 3);
    if (!Number.isInteger(a.intervalMs) || a.intervalMs < 1000 || a.intervalMs > 60000) throw new Error('翻页间隔须为 1000–60000 毫秒');
    if (!Number.isInteger(a.maxSteps) || a.maxSteps < 1 || a.maxSteps > 2000) throw new Error('最多翻页次数须为 1–2000');
    if (!Number.isInteger(a.boundaryItems) || a.boundaryItems < 1 || a.boundaryItems > 20) throw new Error('边界确认条数须为 1–20');
    if (typeof a.newestFirst !== 'boolean') throw new Error('newestFirst 须为 true 或 false');
    return a;
  }
  globalThis.PageTurnerCore = {dateRange, reachedBoundary, bottomResult, closeAllowed, validateAdapter};
})();
