import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { handler } from './server.js';

let server, base;
before(async () => {
  server = createServer(handler).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

test('GET /surahs lists 37 surah without ayat', async () => {
  const res = await fetch(`${base}/surahs`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  const list = await res.json();
  assert.equal(list.length, 37);
  assert.deepEqual([list[0].number, list.at(-1).number], [78, 114]);
  assert.equal(list[0].ayat, undefined);
  assert.equal(list[0].basmalah, undefined);
  assert.deepEqual(list.find((s) => s.number === 94).aliases, ['Al-Insyirah', 'Alam Nasyrah']);
});

test('GET /surahs/78 returns words, audio and segments for every ayah', async () => {
  const s = await (await fetch(`${base}/surahs/78`)).json();
  assert.equal(s.ayat.length, 40);
  const a = s.ayat[1];
  assert.equal(a.words.length, 3); // عن النبإ العظيم
  assert.match(a.audioUrl, /^https:\/\/verses\.quran\.com\/Alafasy\/mp3\/078002\.mp3$/);
  assert.ok(a.segments.length > 0);
  assert.equal(a.translation, 'Tentang berita yang besar (hari berbangkit),');
  assert.deepEqual(a.wordMeanings, ['dari/tentang', 'berita', 'besar']);
  assert.ok(s.ayat.every((x) => x.wordMeanings.length === x.words.length), 'one meaning per word');
  assert.match(s.audioUrl, /mishari_al_afasy\/murattal\/78\.mp3$/);
  assert.equal(s.ayat[0].start, 0);
  assert.ok(s.ayat.every((x, k) => x.end > x.start && (!k || x.start >= s.ayat[k - 1].start)), 'ayat timed in order');
  assert.equal(s.basmalah.words.length, 4);
  assert.match(s.basmalah.audioUrl, /Alafasy\/mp3\/001001\.mp3$/);
  assert.ok(s.basmalah.segments.length > 0);
  assert.ok(s.ayat.every((x) => x.translation && !x.translation.includes('<')), 'plain-text translation for every ayah');
});

test('serves the PWA but nothing outside app/ and no test files', async () => {
  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-type'), /text\/html/);
  assert.equal((await fetch(`${base}/app.js`)).status, 200);
  assert.equal((await fetch(`${base}/search.test.js`)).status, 404);
  assert.equal((await fetch(`${base}/%2e%2e/api/server.js`)).status, 404);
  assert.equal((await fetch(`${base}/..%2fapi%2fserver.js`)).status, 404);
});

test('unknown surah and non-GET are rejected', async () => {
  assert.equal((await fetch(`${base}/surahs/2`)).status, 404);
  assert.equal((await fetch(`${base}/surahs`, { method: 'POST' })).status, 405);
});
