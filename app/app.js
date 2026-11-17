import { rank } from './search.js';

const API = (document.querySelector('meta[name="api-base"]').content || location.origin).replace(/\/$/, '');
const $ = (s, el = document) => el.querySelector(s);
const topbar = $('#topbar'), main = $('#main'), player = $('#player');
const statusEl = $('#status'), autoEl = $('#auto'), prevBtn = $('#prev'), playBtn = $('#play'), nextBtn = $('#next'), retryBtn = $('#retry'), controls = $('#controls');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const toIndic = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const STROKE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const REPEAT = `<path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" ${STROKE}/>`;
const svg = (inner, cls = '') => `<svg class="${cls}" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${inner}</svg>`;
const ICON = {
  play: svg('<path d="M8 5v14l11-7z" fill="currentColor"/>'),
  pause: svg('<path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor"/>'),
  prev: svg('<path d="M6 6h2v12H6zM9.5 12L18 18V6z" fill="currentColor"/>'),
  next: svg('<path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" fill="currentColor"/>'),
  back: svg('<path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'),
  sun: svg('<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  spinner: svg('<path d="M12 3a9 9 0 1 0 9 9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>', 'spin'),
  // Three repeat states with three different shapes, so the state never rests on color alone.
  repeat_off: svg(`${REPEAT}<path d="M4 4l16 16" ${STROKE}/>`),
  repeat_ayah: svg(`${REPEAT}<path d="M11 10l1.5-1v6" ${STROKE}/>`),
  repeat_surah: svg(REPEAT),
  queue: svg(`<path d="M4 6h11M4 12h11M4 18h7M18 14v7M14.5 17.5h7" ${STROKE}/>`),
  plus: svg(`<path d="M12 5v14M5 12h14" ${STROKE}/>`),
  check: svg(`<path d="M5 12.5l4.5 4.5L19 7" ${STROKE}/>`),
  close: svg(`<path d="M6 6l12 12M18 6L6 18" ${STROKE}/>`),
};
prevBtn.innerHTML = ICON.prev;
nextBtn.innerHTML = ICON.next;
$('#queue-open').insertAdjacentHTML('afterbegin', ICON.queue);

async function getJSON(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
const cache = new Map();
// Cache the promise, not the data, so callers always get a promise; a failed fetch is evicted so "Muat ulang" retries.
function load(path) {
  if (!cache.has(path)) cache.set(path, getJSON(path).catch((e) => { cache.delete(path); throw e; }));
  return cache.get(path);
}

/* ---------- Theme ---------- */
const isDark = () => (document.documentElement.dataset.theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
function toggleTheme() {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch {}
  renderThemeButton();
}
function renderThemeButton() {
  const btn = $('#theme');
  if (!btn) return;
  btn.innerHTML = isDark() ? ICON.sun : ICON.moon;
  btn.setAttribute('aria-label', isDark() ? 'Ganti ke tema terang' : 'Ganti ke tema gelap');
}

/* ---------- Queue ---------- */
// Surah numbers to play after the current surah ends, kept on this device only.
let queue = [];
try { queue = JSON.parse(localStorage.getItem('queue') ?? '[]').filter(Number.isInteger); } catch {}
let autoplayOnOpen = false; // set when the queue moves on, so the opened surah starts by itself
const dlg = $('#queue');

function saveQueue() {
  try { localStorage.setItem('queue', JSON.stringify(queue)); } catch {}
  renderQueueButtons();
}
function renderQueueButtons() {
  for (const b of document.querySelectorAll('[data-queue-open]')) {
    const badge = b.querySelector('.badge');
    badge.textContent = queue.length;
    badge.hidden = !queue.length;
    b.setAttribute('aria-label', queue.length ? `Antrean, ${queue.length} surah` : 'Antrean, kosong');
  }
  for (const b of document.querySelectorAll('[data-queue-toggle]')) {
    const inQueue = queue.includes(Number(b.dataset.queueToggle));
    b.innerHTML = inQueue ? ICON.check : ICON.plus;
    b.classList.toggle('is-on', inQueue);
    b.setAttribute('aria-label', `${inQueue ? 'Hapus' : 'Tambah'} ${b.dataset.name} ${inQueue ? 'dari' : 'ke'} antrean`);
  }
}
function toggleQueue(n) {
  const k = queue.indexOf(n);
  if (k < 0) queue.push(n); else queue.splice(k, 1);
  saveQueue();
}
// Opens the next queued surah and starts it; false when the queue is empty.
function playQueueNext() {
  const n = queue.shift();
  if (n === undefined) return false;
  saveQueue();
  autoplayOnOpen = true;
  const hash = `#/surah/${n}`;
  if (location.hash === hash) route(); else location.hash = hash;
  return true;
}
async function renderQueueList() {
  const byN = new Map((await load('/surahs').catch(() => [])).map((s) => [s.number, s]));
  $('#queue-list').innerHTML = queue.map((n, k) => {
    const s = byN.get(n), name = s?.nameLatin ?? `Surah ${n}`;
    return `<li><span class="num">${k + 1}</span>
      <span class="names"><span>${esc(name)}</span>${s ? `<span class="meta">${s.ayahCount} ayat</span>` : ''}</span>
      <button type="button" class="icon-btn" data-remove="${n}" aria-label="Hapus ${esc(name)} dari antrean">${ICON.close}</button></li>`;
  }).join('');
  $('#queue-empty').hidden = queue.length > 0;
  $('#queue-play').hidden = $('#queue-clear').hidden = !queue.length;
}
async function openQueue() {
  await renderQueueList();
  dlg.showModal();
}
$('#queue-close').innerHTML = ICON.close;
$('#queue-close').addEventListener('click', () => dlg.close());
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // tap on the backdrop
$('#queue-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-remove]');
  if (!b) return;
  toggleQueue(Number(b.dataset.remove));
  renderQueueList().then(() => $('#queue-close').focus()); // the pressed button is gone; keep focus inside
});
$('#queue-play').addEventListener('click', () => { dlg.close(); playQueueNext(); });
$('#queue-clear').addEventListener('click', () => { queue = []; saveQueue(); renderQueueList(); $('#queue-close').focus(); });
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-queue-open]')) openQueue();
  const t = e.target.closest('[data-queue-toggle]');
  if (t) toggleQueue(Number(t.dataset.queueToggle));
});

/* ---------- Router ---------- */
let view = 0; // bumps on every navigation so a late fetch never renders into another screen
function route() {
  stopAudio();
  const m = location.hash.match(/^#\/surah\/(\d+)$/);
  if (m) showSurah(Number(m[1])); else showList();
}
addEventListener('hashchange', route);

function focusHeading() {
  if (document.activeElement && document.activeElement !== document.body) $('h1', document)?.focus({ preventScroll: true });
}

/* ---------- Surah list ---------- */
let listQuery = ''; // kept while the app is open, so going back from a surah keeps the search
async function showList() {
  const my = ++view;
  document.title = 'Murottal Juz 30';
  player.hidden = true;
  topbar.innerHTML = `<div class="col bar">
    <div><h1 tabindex="-1">Juz 30</h1><p class="meta">37 surah, An-Naba' sampai An-Nas</p></div>
    <button type="button" class="icon-btn q-open" data-queue-open>${ICON.queue}<span class="badge" aria-hidden="true" hidden></span></button>
    <button type="button" class="icon-btn" id="theme"></button></div>`;
  renderThemeButton();
  renderQueueButtons();
  $('#theme').addEventListener('click', toggleTheme);
  main.innerHTML = `<div class="col"><ul class="skeleton" aria-busy="true" aria-label="Memuat daftar surah">${
    '<li><span class="bone" style="width:20px"></span><span class="bone" style="width:45%"></span></li>'.repeat(8)}</ul></div>`;
  window.scrollTo(0, 0);
  try {
    const list = await load('/surahs');
    if (my !== view) return;
    main.innerHTML = `<div class="col">
      <div class="search">
        <label for="q">Cari surah</label>
        <input id="q" type="search" placeholder="Nama, arti, atau nomor" autocomplete="off" spellcheck="false" enterkeyhint="search">
        <p id="q-count" class="sr-only" aria-live="polite"></p>
      </div>
      <ul class="surahs">${list.map((s) => `<li>
      <a class="row" href="#/surah/${s.number}">
        <span class="num">${s.number}</span>
        <span class="names"><span>${esc(s.nameLatin)}</span><span class="meta">${esc(s.meaning)}, ${s.ayahCount} ayat</span></span>
        <span class="ar" lang="ar" dir="rtl">${esc(s.nameArabic)}</span>
      </a>
      <button type="button" class="icon-btn q-toggle" data-queue-toggle="${s.number}" data-name="${esc(s.nameLatin)}"></button></li>`).join('')}</ul>
      <div class="message message-inline" id="q-empty" hidden>
        <p id="q-empty-text"></p>
        <p class="meta">Coba ejaan lain, arti surah, atau nomornya, misalnya 112.</p>
        <button type="button" class="btn" id="q-clear">Hapus pencarian</button>
      </div></div>`;
    const input = $('#q'), ul = $('.surahs', main);
    const byNumber = new Map([...ul.children].map((li, k) => [list[k].number, li]));
    let order = list, shown = list.length;
    const apply = () => {
      listQuery = input.value;
      order = rank(listQuery, list);
      shown = order.length;
      byNumber.forEach((li) => { li.hidden = true; });
      for (const s of order) { const li = byNumber.get(s.number); li.hidden = false; ul.appendChild(li); } // best match on top
      const q = listQuery.trim();
      $('#q-empty').hidden = shown > 0;
      $('#q-empty-text').textContent = `Tidak ada surah untuk "${q}".`;
      $('#q-count').textContent = !q ? '' : shown ? `${shown} surah cocok` : 'Tidak ada surah yang cocok';
    };
    input.value = listQuery;
    input.addEventListener('input', apply);
    // Enter opens the best match.
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && listQuery.trim() && shown) location.hash = `#/surah/${order[0].number}`;
    });
    $('#q-clear').addEventListener('click', () => { input.value = ''; apply(); input.focus(); });
    apply();
    renderQueueButtons();
  } catch {
    if (my !== view) return;
    main.innerHTML = `<div class="col message">
      <p>Daftar surah gagal dimuat.</p>
      <p class="meta">Periksa koneksi internet, lalu muat ulang.</p>
      <button type="button" class="btn" id="reload">Muat ulang daftar</button></div>`;
    $('#reload').addEventListener('click', showList);
  }
  focusHeading();
}

/* ---------- Surah page ---------- */
async function showSurah(n) {
  if (n < 78 || n > 114) { location.hash = '#/'; return; }
  const my = ++view;
  document.title = 'Murottal Juz 30';
  player.hidden = true;
  topbar.innerHTML = `<div class="col bar"><a class="back" href="#/" aria-label="Kembali ke daftar surah">${ICON.back}<span aria-hidden="true">Juz 30</span></a></div>`;
  main.innerHTML = `<div class="col skeleton-ayah" aria-busy="true" aria-label="Memuat ayat">${'<span class="bone"></span>'.repeat(5)}</div>`;
  window.scrollTo(0, 0);
  let s;
  try {
    s = await load(`/surahs/${n}`);
  } catch {
    if (my !== view) return;
    main.innerHTML = `<div class="col message">
      <p>Ayat surah ini gagal dimuat.</p>
      <p class="meta">Periksa koneksi internet, lalu muat ulang.</p>
      <button type="button" class="btn" id="reload">Muat ulang ayat</button></div>`;
    $('#reload').addEventListener('click', () => showSurah(n));
    return;
  }
  if (my !== view) return;
  document.title = `${s.nameLatin}, Murottal Juz 30`;
  const next = n < 114 ? (await load('/surahs').catch(() => null))?.find((x) => x.number === n + 1) : null;
  if (my !== view) return;
  main.innerHTML = `<div class="col">
    <div class="surah-head">
      <h1 lang="ar" dir="rtl" tabindex="-1">${esc(s.nameArabic)}</h1>
      <p class="meta">${esc(s.nameLatin)}, ${esc(s.meaning)}, ${s.ayahCount} ayat</p>
      ${s.basmalah ? `<button type="button" class="basmalah" id="basmalah">
        <span class="sr-only">Putar basmalah: </span>
        <span class="ar" lang="ar" dir="rtl">${esc(s.basmalah.words.join(' '))}</span>
        <span class="tr">${esc(s.basmalah.translation)}</span>
      </button>` : '<p class="basmalah" lang="ar" dir="rtl">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>'}
    </div>
    <ol class="ayat">${s.ayat.map((a, i) => `<li data-i="${i}">
      <button type="button" class="ayah" data-i="${i}">
        <span class="sr-only">Ayat ${a.number}: </span>
        <span class="ar" lang="ar" dir="rtl">${esc(a.words.join(' '))} <span class="mark">۝${toIndic(a.number)}</span></span>
        ${a.translation ? `<span class="tr">${esc(a.translation)}</span>` : ''}
      </button></li>`).join('')}</ol>
    <p class="meta source">Terjemahan: Kementerian Agama RI, lewat Quran.com.</p>
    <section class="done" id="done" hidden aria-labelledby="done-title">
      <p id="done-title">Surah ${esc(s.nameLatin)} selesai</p>
      ${next
        ? `<p class="meta">Berikutnya: ${esc(next.nameLatin)}, ${next.ayahCount} ayat</p><a class="btn" href="#/surah/${next.number}">Buka surah ${esc(next.nameLatin)}</a>`
        : `<p class="meta">Ini surah terakhir di Juz 30.</p><a class="btn" href="#/">Kembali ke daftar surah</a>`}
    </section></div>`;
  $('.ayat').addEventListener('click', (e) => {
    const btn = e.target.closest('.ayah');
    if (btn) onAyahTap(Number(btn.dataset.i));
  });
  $('button#basmalah')?.addEventListener('click', onBasmalahTap);
  P.surah = s;
  player.hidden = false;
  render();
  renderQueueButtons();
  focusHeading();
  if (autoplayOnOpen) { autoplayOnOpen = false; playAyah(0); }
}

/* ---------- Player ---------- */
// `audio` plays the whole surah as one file and only ever seeks inside it, so sound never stops
// between ayat (phones end background playback and drop the lock-screen controls at such a gap).
// `bsmAudio` plays the basmalah, only when its block is tapped.
const audio = new Audio(), bsmAudio = new Audio();
audio.preload = bsmAudio.preload = 'auto';
// status: idle | loading | playing | paused | stopped (ayah ended, auto off) | done (surah ended) | error
// bsm: the basmalah is playing (P.i is -1 meanwhile, so "next" goes to ayah 1).
const P = { surah: null, i: -1, bsm: false, status: 'idle', timer: 0 };
const cur = () => (P.bsm ? bsmAudio : audio);
const REPEAT_NOTE = { off: '', ayah: ', diulang', surah: ', surah diulang' };
const clip = () => (P.bsm ? P.surah?.basmalah : P.surah?.ayat[P.i]);

function render() {
  const total = P.surah?.ayat.length ?? 0, n = P.i + 1;
  const text = P.bsm && ['loading', 'playing', 'paused', 'error'].includes(P.status) ? {
    loading: 'Memuat basmalah',
    playing: 'Basmalah',
    paused: 'Dijeda di basmalah',
    error: 'Audio basmalah gagal dimuat. Periksa koneksi internet.',
  }[P.status] : {
    idle: 'Ketuk ayat untuk mulai mendengarkan',
    ready: `Ketuk putar untuk memulai ${P.surah?.nameLatin ?? ''}`,
    loading: `Memuat ayat ${n}`,
    playing: `Ayat ${n} dari ${total}${REPEAT_NOTE[repeat]}`,
    paused: `Dijeda di ayat ${n} dari ${total}${REPEAT_NOTE[repeat]}`,
    stopped: `Ayat ${n} selesai. Lanjut otomatis sedang mati.`,
    done: `Surah ${P.surah?.nameLatin ?? ''} selesai`,
    error: `Audio ayat ${n} gagal dimuat. Periksa koneksi internet.`,
  }[P.status];
  statusEl.textContent = text;
  statusEl.classList.toggle('is-error', P.status === 'error');
  const err = P.status === 'error';
  controls.hidden = err;
  retryBtn.hidden = !err;
  retryBtn.textContent = P.bsm ? 'Putar ulang basmalah' : `Putar ulang ayat ${n}`;
  const busy = P.status === 'playing' || P.status === 'loading';
  playBtn.innerHTML = P.status === 'loading' ? ICON.spinner : busy ? ICON.pause : ICON.play;
  playBtn.setAttribute('aria-label', busy ? 'Jeda' : 'Putar ayat');
  prevBtn.disabled = P.i <= 0;
  nextBtn.disabled = P.i >= total - 1;
}
function setStatus(s) { P.status = s; render(); updateMediaSession(); }

// Lock screen / notification: what is playing, the seek bar over the whole surah, and the buttons.
const ms = navigator.mediaSession;
function updateMediaSession() {
  if (!ms) return;
  if (!P.surah || (P.i < 0 && !P.bsm)) { ms.metadata = null; ms.playbackState = 'none'; return; }
  ms.metadata = new MediaMetadata({
    title: P.bsm ? `${P.surah.nameLatin}, basmalah` : `${P.surah.nameLatin}, ayat ${P.i + 1}`,
    artist: 'Mishary Rashid Alafasy',
    album: 'Murottal Juz 30',
    // shortcut: SVG placeholder artwork, some lock screens need a PNG; swap in a PNG once the real logo exists
    artwork: [{ src: new URL('icon.svg', location.href).href, sizes: '512x512', type: 'image/svg+xml' }],
  });
  ms.playbackState = P.status === 'playing' || P.status === 'loading' ? 'playing' : 'paused';
  const el = cur();
  if (ms.setPositionState && Number.isFinite(el.duration)) {
    try { ms.setPositionState({ duration: el.duration, position: Math.min(el.currentTime, el.duration), playbackRate: el.playbackRate }); } catch {}
  }
}

// i = -1 marks the basmalah block, otherwise the ayah at index i.
function setActive(i) {
  const list = $('.ayat');
  if (!list) return;
  main.querySelector('.is-active')?.classList.remove('is-active');
  list.querySelector('[aria-current]')?.removeAttribute('aria-current');
  const li = i < 0 ? $('#basmalah') : list.children[i];
  li.classList.add('is-active');
  li.querySelector('.ayah')?.setAttribute('aria-current', 'true');
  li.scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
}

// Index of the ayah playing at surah time t (ms).
function ayahAt(t) {
  const ayat = P.surah.ayat;
  let k = 0;
  while (k + 1 < ayat.length && ayat[k + 1].start <= t) k++;
  return k;
}

// Runs at each ayah end (plus timeupdate as a backup): moves the highlight to the ayah playing,
// and stops at the ayah end when auto-continue is off. A timer, not frame callbacks: those are
// throttled on a locked phone. Highlight is per ayah only: Quran.com's word timings for these
// surah files run 1-3 s early in places, so word-level highlighting was removed.
function tick() {
  clearTimeout(P.timer);
  if (!P.surah || P.bsm) return;
  const el = cur(), t = el.currentTime * 1000;
  const a = P.surah.ayat[P.i], last = P.surah.ayat.length - 1;
  // Repeat ayah: jump back to its start inside the same file (no new play(), so it works locked).
  if (repeat === 'ayah' && P.status === 'playing' && (t >= a.end - 30 || ayahAt(t) !== P.i)) {
    audio.currentTime = a.start / 1000;
    P.timer = setTimeout(tick, 50);
    return;
  }
  if (repeat !== 'ayah' && !autoEl.checked && P.status === 'playing' && P.i < last && t >= a.end - 30 && t < a.end + 1000) {
    P.status = 'stopped'; // set first so the pause event keeps it
    audio.pause();
    render(); updateMediaSession();
    return;
  }
  const k = ayahAt(t);
  if (k !== P.i) { P.i = k; setActive(k); render(); updateMediaSession(); }
  if (el.paused) return;
  const wake = P.surah.ayat[P.i].end;
  if (wake > t) P.timer = setTimeout(tick, Math.max(16, (wake - t) / (el.playbackRate || 1)));
}

// NotAllowedError: the browser refused to start on its own (the queue moved on while the phone was
// locked). Not a network error; one tap on play, here or on the lock screen, starts it.
const onPlayError = (e) => { if (e.name === 'NotAllowedError') setStatus('ready'); else if (e.name !== 'AbortError') setStatus('error'); };

function playAyah(i) {
  if (!P.surah?.ayat[i]) return;
  $('#done').hidden = true;
  P.i = i;
  P.bsm = false;
  bsmAudio.pause();
  if (audio.getAttribute('src') !== P.surah.audioUrl) audio.src = P.surah.audioUrl;
  audio.currentTime = P.surah.ayat[i].start / 1000;
  setActive(i);
  setStatus('loading');
  audio.play().catch(onPlayError);
}
// The basmalah plays only when tapped, on its own, and stops at its end: chaining it into the
// surah would need a second play() at that moment, which a locked phone refuses.
function playBasmalah() {
  if (!P.surah?.basmalah) return;
  $('#done').hidden = true;
  P.bsm = true; // first, so the surah element's pause event is ignored
  P.i = -1;
  audio.pause();
  if (bsmAudio.getAttribute('src') !== P.surah.basmalah.audioUrl) bsmAudio.src = P.surah.basmalah.audioUrl;
  bsmAudio.currentTime = 0;
  setActive(-1);
  setStatus('loading');
  bsmAudio.play().catch(onPlayError);
}
function togglePlay() {
  if (!P.surah) return;
  if (P.status === 'playing' || P.status === 'loading') cur().pause();
  else if (P.status === 'paused') cur().play().catch(onPlayError);
  else if (P.status === 'error') { if (P.bsm) playBasmalah(); else playAyah(P.i); }
  else if (P.status === 'stopped') playAyah(Math.min(P.i + 1, P.surah.ayat.length - 1));
  else if (P.status === 'done') playAyah(0);
  else playAyah(Math.max(P.i, 0));
}
function onAyahTap(i) {
  if (!P.bsm && i === P.i && ['playing', 'loading', 'paused'].includes(P.status)) togglePlay();
  else playAyah(i);
}
function onBasmalahTap() {
  if (P.bsm && ['playing', 'loading', 'paused'].includes(P.status)) togglePlay();
  else playBasmalah();
}
function stopAudio() {
  clearTimeout(P.timer);
  for (const el of [audio, bsmAudio]) { el.pause(); el.removeAttribute('src'); el.load(); }
  Object.assign(P, { surah: null, i: -1, bsm: false, status: 'idle' });
  updateMediaSession();
}

// Both elements share these handlers; events from the one not currently in use are ignored.
for (const el of [audio, bsmAudio]) {
  el.addEventListener('playing', () => { if (el === cur()) { setStatus('playing'); tick(); } });
  el.addEventListener('waiting', () => { if (el === cur() && P.status === 'playing') setStatus('loading'); });
  el.addEventListener('timeupdate', () => { if (el === cur() && !el.paused) tick(); });
  el.addEventListener('pause', () => {
    if (el !== cur()) return;
    clearTimeout(P.timer);
    if (el.getAttribute('src') && !el.ended && P.status !== 'error' && P.status !== 'stopped') setStatus('paused');
  });
  el.addEventListener('error', () => { if (el === cur() && el.getAttribute('src')) setStatus('error'); });
}
bsmAudio.addEventListener('ended', () => {
  if (!P.bsm) return;
  P.bsm = false;
  main.querySelector('.is-active')?.classList.remove('is-active');
  setStatus('idle');
});
// Only fires with repeat off: any repeat sets audio.loop, so the file never ends.
audio.addEventListener('ended', () => {
  if (P.bsm || !P.surah) return;
  if (playQueueNext()) return;
  setStatus('done');
  const done = $('#done');
  done.hidden = false;
  done.scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
});

// Repeat: off -> this ayah -> this surah. Kept on this device.
const repeatBtn = $('#repeat');
let repeat = 'off';
try { const r = localStorage.getItem('repeat'); if (r in REPEAT_NOTE) repeat = r; } catch {}
function renderRepeat() {
  repeatBtn.innerHTML = ICON[`repeat_${repeat}`];
  repeatBtn.classList.toggle('is-on', repeat !== 'off');
  repeatBtn.setAttribute('aria-label', { off: 'Ulangi: mati', ayah: 'Ulangi: ayat ini', surah: 'Ulangi: surah ini' }[repeat]);
  audio.loop = repeat !== 'off'; // the surah file loops instead of ending, so nothing has to start again
}
repeatBtn.addEventListener('click', () => {
  repeat = { off: 'ayah', ayah: 'surah', surah: 'off' }[repeat];
  try { localStorage.setItem('repeat', repeat); } catch {}
  renderRepeat();
  render();
});
renderRepeat();

playBtn.addEventListener('click', togglePlay);
retryBtn.addEventListener('click', () => (P.bsm ? playBasmalah() : playAyah(P.i)));
prevBtn.addEventListener('click', () => playAyah(P.i - 1));
nextBtn.addEventListener('click', () => playAyah(P.i + 1));

for (const [action, fn] of [
  ['play', () => { if (P.status !== 'playing' && P.status !== 'loading') togglePlay(); }],
  ['pause', () => cur().pause()],
  ['previoustrack', () => { if (!prevBtn.disabled) playAyah(P.i - 1); }],
  ['nexttrack', () => { if (!nextBtn.disabled) playAyah(P.i + 1); }],
  ['seekto', (d) => { if (!P.bsm && P.surah) { audio.currentTime = d.seekTime; tick(); updateMediaSession(); } }],
]) {
  try { ms?.setActionHandler(action, fn); } catch {} // an action the browser does not support is skipped
}

// Timers are throttled while the phone is locked; catch up as soon as the screen is back.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !cur().paused) tick();
});

// Web keyboard: Space play/pause, arrows move between ayat. Native controls keep their own keys.
addEventListener('keydown', (e) => {
  if (player.hidden || e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.('button, a, input')) return;
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  else if (e.key === 'ArrowRight' && !nextBtn.disabled) playAyah(P.i + 1);
  else if (e.key === 'ArrowLeft' && !prevBtn.disabled) playAyah(P.i - 1);
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
route();
