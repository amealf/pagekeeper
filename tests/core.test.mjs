import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const context=vm.createContext({});vm.runInContext(await readFile(new URL('../extension/core.js',import.meta.url),'utf8'),context);const Core=context.PageTurnerCore;
const now=Date.parse('2026-10-10T12:00:00Z'),cutoff=Date.parse('2026-07-10T00:00:00Z');
const profile=JSON.parse(await readFile(new URL('../extension/adapters.json',import.meta.url),'utf8'))[1];
test('rounded months retain uncertainty and use calendar months',()=>{
  const d=Core.dateRange('3mo • Edited',now);assert.equal(d.upper,Date.parse('2026-07-10T12:00:00Z'));assert.equal(d.lower,Date.parse('2026-06-10T12:00:00Z'));
  assert.equal(Core.dateRange('3个月前',now).upper,d.upper);
  assert.equal(Core.dateRange('1mo',Date.parse('2026-03-31T12:00:00Z')).upper,Date.parse('2026-02-28T12:00:00Z'));
});
test('only known timestamps and unambiguous calendar dates parse',()=>{
  assert.equal(Core.dateRange('2026-02-30',now),null);assert.equal(Core.dateRange('08/09/26',now),null);assert.equal(Core.dateRange('applications close 2026-06-01',now),null);
  assert.equal(Core.dateRange('10 October 2026',now).lower,Date.parse('2026-10-10T00:00:00Z'));assert.equal(Core.dateRange('2026年10月10日',now).lower,Date.parse('2026-10-10T00:00:00Z'));
});
test('cutoff requires confirmed ordering and a fully known older tail',()=>{
  const old={date:Core.dateRange('4mo',now)},near={date:Core.dateRange('3mo',now)};
  assert.equal(Core.reachedBoundary([old,old,old],cutoff,profile),false);
  const ordered={...profile,newestFirst:true};assert.equal(Core.reachedBoundary([old,old,old],cutoff,ordered),true);
  assert.equal(Core.reachedBoundary([old,old,near],cutoff,ordered),false);assert.equal(Core.reachedBoundary([old,old,{date:null}],cutoff,ordered),false);
  assert.equal(Core.reachedBoundary([old,old,{date:null,pinned:true},old],cutoff,ordered),true);
  const earlier={date:Core.dateRange('6mo',now)};assert.equal(Core.reachedBoundary([earlier,old,old,old],cutoff,ordered),false);
});
test('stalled loading is partial, only explicit end marker confirms end',()=>{
  assert.equal(Core.bottomResult({atBottom:true,unchanged:3}),null);assert.equal(Core.bottomResult({atBottom:true,unchanged:4,busy:true}),null);
  assert.equal(Core.bottomResult({atBottom:true,unchanged:4}).coverage,'partial');assert.equal(Core.bottomResult({ended:true}).coverage,'end_confirmed');
});
test('close guard requires download completion and exact source URL',()=>{
  assert.equal(Core.closeAllowed({url:'https://example.test/a'},'https://example.test/a',true),true);
  assert.equal(Core.closeAllowed({url:'https://example.test/b'},'https://example.test/a',true),false);assert.equal(Core.closeAllowed({url:'https://example.test/a'},'https://example.test/a',false),false);
});
test('profile rejects missing next button, invalid limits and date gate without selectors',()=>{
  assert.throws(()=>Core.validateAdapter({...profile,mode:'next'}));assert.throws(()=>Core.validateAdapter({...profile,intervalMs:100}));assert.throws(()=>Core.validateAdapter({...profile,newestFirst:true,dateSelector:''}));
});
