import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rank } from './search.js';

const surahs = JSON.parse(readFileSync(new URL('../api/data/juz30.json', import.meta.url), 'utf8'));
const find = (q) => rank(q, surahs).map((s) => s.number);

test('Indonesian and English transliterations put the same surah first', () => {
  for (const [q, n] of [
    ['An-Naas', 114], ['annas', 114], ['Asy-Syams', 91], ['Al-Kautsar', 108], ['Quraisy', 106],
    ['Adh-Dhuha', 93], ['Al-Lail', 92], ['Al-Ghasyiyah', 88], ['At-Takatsur', 102], ['ikhlas', 112],
  ]) assert.equal(find(q)[0], n, `${q} should rank ${n} first`);
});

test('closest name ranks above partial and meaning matches', () => {
  assert.deepEqual(find('naas'), [114, 110, 94]); // exact, then An-Nasr (prefix), then Alam Nasyrah (contains)
  assert.deepEqual(find('nas').slice(0, 2), [114, 110]);
  assert.deepEqual(find('fa'), [89, 113]); // Al-Fajr, Al-Falaq both start with "fa"; ties keep surah order
  assert.deepEqual(find('11'), [110, 111, 112, 113, 114]);
  assert.deepEqual(find('111'), [111]);
});

test('aliases, meaning and Arabic all match', () => {
  assert.deepEqual(find('Al-Insyirah'), [94]);
  assert.deepEqual(find('Al-Lahab'), [111]);
  assert.ok(find('gajah').includes(105));
  assert.equal(find('الفلق')[0], 113);
  assert.equal(find('فلق')[0], 113);
});

test('empty query keeps all in order, nonsense finds none', () => {
  assert.deepEqual(find('  '), surahs.map((s) => s.number));
  assert.deepEqual(find('xyzzy'), []);
});
