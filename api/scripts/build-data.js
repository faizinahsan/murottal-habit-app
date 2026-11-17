// Fetch Juz 30 (surah 78-114) text, names and Alafasy word timings from Quran.com once,
// and write data/juz30.json so the server never calls an outside API at runtime.
import { writeFile } from 'node:fs/promises';

const API = 'https://api.quran.com/api/v4';
const AUDIO_BASE = 'https://verses.quran.com/';
const RECITER = 7; // Mishary Rashid Alafasy (murattal)
const TRANSLATION = 33; // Indonesian, Kementerian Agama RI
// Other names these surah are commonly known by in Indonesia, so search finds them.
const ALIASES = { 94: ['Al-Insyirah', 'Alam Nasyrah'], 96: ['Iqra'], 111: ['Al-Lahab', 'Tabbat'] };

async function get(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

async function fetchChapter(id) {
  const [{ verses }, { audio_files }] = await Promise.all([
    get(`/verses/by_chapter/${id}?per_page=50&words=true&word_fields=text_uthmani&translations=${TRANSLATION}&language=id`),
    get(`/recitations/${RECITER}/by_chapter/${id}?per_page=50&fields=segments`),
  ]);
  const audio = new Map(audio_files.map((a) => [a.verse_key, a]));
  return verses.map((v) => {
    const a = audio.get(v.verse_key);
    return {
      number: v.verse_number,
      words: v.words.filter((w) => w.char_type_name === 'word').map((w) => w.text_uthmani),
      // Indonesian meaning of each word, same order as `words` (language=id above).
      wordMeanings: v.words.filter((w) => w.char_type_name === 'word')
        .map((w) => (w.translation?.language_name === 'indonesian' ? w.translation.text : '')),
      // Footnote markers (<sup foot_note=..>1</sup>) and any other markup removed: clients get plain text.
      translation: (v.translations?.[0]?.text ?? '').replace(/<sup[^>]*>.*?<\/sup>/g, '').replace(/<[^>]+>/g, '').trim(),
      audioUrl: a ? AUDIO_BASE + a.url : null,
      // [word position (1-based), start ms, end ms]; malformed segments dropped
      segments: (a?.segments ?? []).filter((s) => s.length >= 4).map((s) => [s[1], s[2], s[3]]).sort((x, y) => x[1] - y[1]),
    };
  });
}

// Al-Fatihah 1:1 is the basmalah recitation; every surah in Juz 30 opens with it.
const [fatihah1] = await fetchChapter(1);
const { number: _n, ...basmalah } = fatihah1;

const { chapters } = await get('/chapters?language=id');
const surahs = [];
for (const ch of chapters.filter((c) => c.id >= 78)) {
  // One continuous file per surah: background playback on phones stops when audio ends between
  // separate per-ayah files, so the app plays this file and seeks inside it.
  const [ayat, { audio_file: full }] = await Promise.all([
    fetchChapter(ch.id),
    get(`/chapter_recitations/${RECITER}/${ch.id}?segments=true`),
  ]);
  const timing = new Map(full.timestamps.map((t) => [t.verse_key, t]));
  for (const a of ayat) {
    const t = timing.get(`${ch.id}:${a.number}`);
    a.start = t?.timestamp_from ?? null; // ms inside the surah file
    a.end = t?.timestamp_to ?? null;
    a.surahSegments = (t?.segments ?? []).filter((s) => s.length === 3).sort((x, y) => x[1] - y[1]); // [word, start, end] in surah ms
  }
  surahs.push({
    number: ch.id,
    nameLatin: ch.name_simple,
    nameArabic: ch.name_arabic,
    meaning: ch.translated_name.name,
    aliases: ALIASES[ch.id] ?? [],
    ayahCount: ch.verses_count,
    audioUrl: full.audio_url,
    basmalah,
    ayat,
  });
  process.stdout.write(`${ch.id} `);
}

if (basmalah.words.length !== 4 || !basmalah.audioUrl || !basmalah.segments.length) throw new Error('basmalah data incomplete');
const total = surahs.reduce((n, s) => n + s.ayat.length, 0);
if (surahs.length !== 37 || total !== 564) throw new Error(`expected 37 surah / 564 ayat, got ${surahs.length} / ${total}`);
for (const s of surahs) {
  if (s.ayat.length !== s.ayahCount) throw new Error(`surah ${s.number}: ${s.ayat.length} of ${s.ayahCount} ayat`);
  if (!s.audioUrl) throw new Error(`no surah audio for ${s.number}`);
  s.ayat.forEach((a, k) => {
    if (a.start === null || a.end === null || a.end <= a.start || !a.surahSegments.length) throw new Error(`no surah timing for ${s.number}:${a.number}`);
    if (k && a.start < s.ayat[k - 1].start) throw new Error(`ayat out of order in ${s.number}`);
  });
  for (const a of s.ayat) {
    if (!a.audioUrl) throw new Error(`no audio for ${s.number}:${a.number}`);
    if (!a.translation) throw new Error(`no translation for ${s.number}:${a.number}`);
    if (a.wordMeanings.some((m) => !m)) throw new Error(`missing word meaning in ${s.number}:${a.number}`);
  }
}
await writeFile(new URL('../data/juz30.json', import.meta.url), JSON.stringify(surahs));
console.log(`\nwrote ${surahs.length} surah, ${total} ayat`);
