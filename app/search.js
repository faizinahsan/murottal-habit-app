// Surah search that tolerates the many ways surah names are spelled in Latin script
// (An-Nas / An-Naas, Asy-Syams / Ash-Shams, Al-Kautsar / Al-Kawthar, Quraisy / Quraysh)
// and ranks the closest name first.

// Reduce a Latin name to a rough sound skeleton: letters and digits only, common
// transliteration pairs folded together, doubled letters collapsed.
export function latinKey(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]/g, '')
    .replace(/sy|sh/g, 's')
    .replace(/dh|dz/g, 'd')
    .replace(/th|ts/g, 't')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/q/g, 'k')
    .replace(/y/g, 'i')
    .replace(/w/g, 'u')
    .replace(/(.)\1+/g, '$1');
}

// "An-Nas" -> "Nas", "Asy-Syams" -> "Syams": the article must not decide the ranking.
const stripArticle = (s) => s.trim().replace(/^(al|an|ar|as|at|ad|az|ash|asy|adh|ath)[\s'-]+/i, '');

// Arabic: drop harakat and tatweel, fold the alef variants, drop the article.
export function arabicKey(s) {
  return s.replace(/[ً-ٰٟـ\s]/g, '').replace(/[أإآٱ]/g, 'ا');
}

// Lower is better: 0 exact name, 1 name starts with the query, 2 name contains it, 3 meaning contains it.
function score(s, q) {
  if (/^\d+$/.test(q)) {
    const n = String(s.number);
    return n === q ? 0 : n.startsWith(q) ? 1 : Infinity;
  }
  if (/[؀-ۿ]/.test(q)) {
    const a = arabicKey(s.nameArabic), k = arabicKey(q), bare = (x) => x.replace(/^ال/, '');
    return a === k || bare(a) === bare(k) ? 0 : bare(a).startsWith(bare(k)) ? 1 : a.includes(k) ? 2 : Infinity;
  }
  const qFull = latinKey(q), qBase = latinKey(stripArticle(q));
  if (!qFull) return 0;
  let best = Infinity;
  for (const name of [s.nameLatin, ...(s.aliases ?? [])]) {
    const full = latinKey(name), base = latinKey(stripArticle(name));
    if (full === qFull || (qBase && base === qBase)) return 0;
    if (full.startsWith(qFull) || (qBase && base.startsWith(qBase))) best = Math.min(best, 1);
    else if (full.includes(qFull)) best = Math.min(best, 2);
  }
  if (best === Infinity && latinKey(s.meaning).includes(qFull)) best = 3;
  return best;
}

// Matching surahs, best first; ties keep surah order. An empty query returns all of them.
export function rank(query, surahs) {
  const q = query.trim();
  if (!q) return [...surahs];
  return surahs
    .map((s, i) => ({ s, i, sc: score(s, q) }))
    .filter((x) => x.sc !== Infinity)
    .sort((a, b) => a.sc - b.sc || a.i - b.i)
    .map((x) => x.s);
}
