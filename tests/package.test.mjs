import test from 'node:test';import assert from 'node:assert/strict';import {zip,crc32,png} from '../scripts/binary.mjs';import {inflateRawSync} from 'node:zlib';
test('release ZIP entries round-trip with CRC and no directory prefix',()=>{
  const input=Buffer.from('中文 local archive');const archive=zip([['manifest.json',input]]);
  assert.equal(archive.readUInt32LE(0),0x04034b50);const n=archive.readUInt16LE(26),length=archive.readUInt32LE(18);
  assert.equal(archive.subarray(30,30+n).toString(),'manifest.json');assert.deepEqual(inflateRawSync(archive.subarray(30+n,30+n+length)),input);
  assert.equal(archive.readUInt32LE(14),crc32(input));assert.equal(archive.readUInt32LE(archive.length-22),0x06054b50);
});
test('bundled icon encoder emits correct PNG dimensions',()=>{
  const image=png(16,16,Buffer.alloc(16*16*4));assert.equal(image.readUInt32BE(16),16);assert.equal(image.readUInt32BE(20),16);
});
