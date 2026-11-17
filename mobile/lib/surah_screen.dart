import 'dart:async';

import 'package:flutter/material.dart';

import 'api.dart';
import 'main.dart';
import 'player.dart';
import 'queue_sheet.dart';

void openSurah(NavigatorState nav, int n, {bool autoplay = false, bool replace = false}) {
  final route = MaterialPageRoute<void>(builder: (_) => SurahScreen(number: n, autoplay: autoplay));
  replace ? nav.pushReplacement(route) : nav.push(route);
}

class SurahScreen extends StatefulWidget {
  const SurahScreen({super.key, required this.number, this.autoplay = false});
  final int number;
  final bool autoplay;

  static int _open = 0;
  static bool get isOpen => _open > 0;

  @override
  State<SurahScreen> createState() => _SurahScreenState();
}

class _SurahScreenState extends State<SurahScreen> {
  late int _number = widget.number;
  late Future<Surah> _surah = api.surah(_number);
  final _keys = <int, GlobalKey>{}; // ayah index (-1 = basmalah) -> key, for auto-scroll
  int? _scrolledTo;
  StreamSubscription<int>? _sub;

  @override
  void initState() {
    super.initState();
    SurahScreen._open++;
    // The queue moved on natively: show the surah that is now playing.
    _sub = player.surahChanged.listen((n) {
      if (mounted && ModalRoute.of(context)?.isCurrent == true) {
        setState(() {
          _number = n;
          _surah = api.surah(n);
          _scrolledTo = null;
        });
      }
    });
    if (widget.autoplay) _surah.then((s) => player.playAyah(s, 0));
  }

  @override
  void dispose() {
    _sub?.cancel();
    SurahScreen._open--;
    // Leaving the surah screens stops playback (DESIGN.md: no global mini player in v1).
    // A replaced route counts the new screen first, so a queue hand-over keeps playing.
    if (SurahScreen._open == 0) player.stop();
    super.dispose();
  }

  void _scrollTo(int i) {
    if (_scrolledTo == i) return;
    _scrolledTo = i;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final c = _keys[i]?.currentContext;
      if (c != null) {
        Scrollable.ensureVisible(c, alignment: .4, duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : const Duration(milliseconds: 300));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = Tokens.of(context);
    return FutureBuilder<Surah>(
      future: _surah,
      builder: (context, snap) {
        final s = snap.data;
        return Scaffold(
          appBar: AppBar(title: Text(s?.meta.nameLatin ?? 'Juz 30', style: TextStyle(fontSize: 16, color: t.inkMuted))),
          bottomNavigationBar: s == null ? null : _PlayerBar(s),
          body: snap.hasError
              ? Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Ayat surah ini gagal dimuat.', style: TextStyle(fontSize: 16)),
                    Text('Periksa koneksi internet, lalu muat ulang.', style: TextStyle(color: t.inkMuted)),
                    const SizedBox(height: 12),
                    FilledButton(onPressed: () => setState(() => _surah = api.surah(_number)), child: const Text('Muat ulang ayat')),
                  ]),
                )
              : s == null
                  ? const Center(child: CircularProgressIndicator(semanticsLabel: 'Memuat ayat'))
                  : ListenableBuilder(
                      listenable: player,
                      builder: (context, _) {
                        final mine = player.surah?.meta.number == s.meta.number;
                        final active = !mine ? null : (player.basmalah ? -1 : (player.ayah >= 0 ? player.ayah : null));
                        if (active != null) _scrollTo(active);
                        return ListView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 32), children: [
                          Text(s.meta.nameArabic, textAlign: TextAlign.center, textDirection: TextDirection.rtl, style: arabic(56, t.ink, height: 1.7)),
                          Text('${s.meta.nameLatin}, ${s.meta.meaning}, ${s.meta.ayahCount} ayat',
                              textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: t.inkMuted)),
                          const SizedBox(height: 24),
                          if (s.basmalah != null)
                            _Block(
                              key: _keys.putIfAbsent(-1, GlobalKey.new),
                              label: 'Putar basmalah',
                              words: s.basmalah!.words,
                              meanings: s.basmalah!.wordMeanings,
                              translation: s.basmalah!.translation,
                              active: active == -1,
                              centered: true,
                              onTap: () => player.basmalah && mine && player.status != Status.idle
                                  ? player.togglePlay(s)
                                  : player.playBasmalah(s),
                            ),
                          const SizedBox(height: 8),
                          for (final (i, a) in s.ayat.indexed)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: _Block(
                                key: _keys.putIfAbsent(i, GlobalKey.new),
                                label: 'Ayat ${a.number}',
                                words: a.words,
                                meanings: a.wordMeanings,
                                translation: a.translation,
                                number: a.number,
                                active: active == i,
                                onTap: () => mine && !player.basmalah && player.ayah == i &&
                                        {Status.playing, Status.loading, Status.paused}.contains(player.status)
                                    ? player.togglePlay(s)
                                    : player.playAyah(s, i),
                              ),
                            ),
                          const SizedBox(height: 16),
                          Text('Terjemahan: Kementerian Agama RI, lewat Quran.com.', style: TextStyle(fontSize: 14, color: t.inkMuted)),
                          if (mine && player.status == Status.done) _DoneCard(s),
                        ]);
                      },
                    ),
        );
      },
    );
  }
}

/// One ayah (or the basmalah): Arabic words that light up with the recitation, the meaning of
/// the word being recited, and the Indonesian translation. The whole block is one button.
class _Block extends StatelessWidget {
  const _Block({super.key, required this.label, required this.words, required this.meanings, required this.translation,
      required this.active, required this.onTap, this.number, this.centered = false});
  final String label, translation;
  final List<String> words, meanings;
  final int? number;
  final bool active, centered;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = Tokens.of(context);
    final pos = active ? player.wordPos : null;
    Color wordColor(int k) => pos == null || pos < 0
        ? t.ink
        : (k + 1 < pos ? t.ink : (k + 1 == pos ? t.accent : t.inkMuted));
    final k = words.isEmpty ? 0 : ((pos ?? 1).clamp(1, words.length) - 1);
    return Semantics(
      button: true,
      label: label,
      child: Material(
        color: active ? t.accentSoft : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: centered ? CrossAxisAlignment.center : CrossAxisAlignment.stretch, children: [
              Text.rich(
                TextSpan(children: [
                  for (final (i, w) in words.indexed) TextSpan(text: '$w ', style: TextStyle(color: wordColor(i))),
                  if (number != null) TextSpan(text: '۝${toIndic(number!)}', style: TextStyle(color: active ? t.accent : t.inkMuted)),
                ]),
                textDirection: TextDirection.rtl,
                textAlign: centered ? TextAlign.center : TextAlign.right,
                style: arabic(28, t.ink),
              ),
              if (active && meanings.length == words.length)
                ExcludeSemantics( // visual only, like the word highlight
                  child: Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Column(crossAxisAlignment: centered ? CrossAxisAlignment.center : CrossAxisAlignment.start, children: [
                      Text('Arti kata', style: TextStyle(fontSize: 12, color: t.inkMuted)),
                      Row(mainAxisSize: centered ? MainAxisSize.min : MainAxisSize.max, crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
                        Text(words[k], textDirection: TextDirection.rtl, style: arabic(22, t.accent, height: 1.6)),
                        const SizedBox(width: 12),
                        Flexible(child: Text(meanings[k], style: TextStyle(fontWeight: FontWeight.w600, color: t.ink))),
                      ]),
                    ]),
                  ),
                ),
              if (translation.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(translation, textAlign: centered ? TextAlign.center : TextAlign.left,
                    style: TextStyle(fontSize: 16, height: 1.6, color: active ? t.ink : t.inkMuted)),
              ],
            ]),
          ),
        ),
      ),
    );
  }
}

class _DoneCard extends StatelessWidget {
  const _DoneCard(this.s);
  final Surah s;

  @override
  Widget build(BuildContext context) {
    final t = Tokens.of(context);
    final last = s.meta.number >= 114;
    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: t.accentSoft, borderRadius: BorderRadius.circular(12)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Surah ${s.meta.nameLatin} selesai', style: const TextStyle(fontSize: 16)),
        Text(last ? 'Ini surah terakhir di Juz 30.' : 'Lanjutkan ke surah berikutnya.', style: TextStyle(color: t.inkMuted)),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: () => last ? Navigator.of(context).pop() : openSurah(Navigator.of(context), s.meta.number + 1, replace: true),
          child: Text(last ? 'Kembali ke daftar surah' : 'Buka surah berikutnya'),
        ),
      ]),
    );
  }
}

class _PlayerBar extends StatelessWidget {
  const _PlayerBar(this.s);
  final Surah s;

  String _status() {
    final p = player;
    final total = (p.surah ?? s).ayat.length, n = p.ayah + 1;
    final note = switch (p.repeat) { Repeat.ayah => ', diulang', Repeat.surah => ', surah diulang', Repeat.off => '' };
    if (p.basmalah) {
      return switch (p.status) {
        Status.loading => 'Memuat basmalah',
        Status.paused => 'Dijeda di basmalah',
        Status.error => 'Audio basmalah gagal dimuat. Periksa koneksi internet.',
        _ => 'Basmalah',
      };
    }
    return switch (p.status) {
      Status.idle => 'Ketuk ayat untuk mulai mendengarkan',
      Status.loading => 'Memuat ayat $n',
      Status.playing => 'Ayat $n dari $total$note',
      Status.paused => 'Dijeda di ayat $n dari $total$note',
      Status.stopped => 'Ayat $n selesai. Lanjut otomatis sedang mati.',
      Status.done => 'Surah ${(p.surah ?? s).meta.nameLatin} selesai',
      Status.error => 'Audio ayat $n gagal dimuat. Periksa koneksi internet.',
    };
  }

  @override
  Widget build(BuildContext context) {
    final t = Tokens.of(context);
    return ListenableBuilder(
      listenable: player,
      builder: (context, _) {
        final p = player;
        final busy = p.status == Status.playing || p.status == Status.loading;
        final repeatIcon = switch (p.repeat) { Repeat.off => Icons.repeat, Repeat.ayah => Icons.repeat_one, Repeat.surah => Icons.repeat_on };
        return DecoratedBox(
          decoration: BoxDecoration(color: t.paper, border: Border(top: BorderSide(color: t.line))),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Row(children: [
                  Expanded(
                    child: Semantics(
                      liveRegion: true,
                      child: Text(_status(), style: TextStyle(fontSize: 14, color: p.status == Status.error ? t.ink : t.inkMuted)),
                    ),
                  ),
                  Text('Lanjut otomatis', style: TextStyle(fontSize: 14, color: t.ink)),
                  Switch(value: p.autoContinue, onChanged: p.setAutoContinue),
                ]),
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  IconButton(
                    tooltip: switch (p.repeat) { Repeat.off => 'Ulangi: mati', Repeat.ayah => 'Ulangi: ayat ini', Repeat.surah => 'Ulangi: surah ini' },
                    // Off is a crossed-out icon, so the state never rests on color alone.
                    icon: p.repeat == Repeat.off
                        ? Stack(alignment: Alignment.center, children: [Icon(repeatIcon, color: t.inkMuted), Transform.rotate(angle: .8, child: Container(width: 2, height: 26, color: t.inkMuted))])
                        : Icon(repeatIcon, color: t.accent),
                    onPressed: () => p.setRepeat(Repeat.values[(p.repeat.index + 1) % 3]),
                  ),
                  IconButton(tooltip: 'Ayat sebelumnya', icon: const Icon(Icons.skip_previous), onPressed: p.ayah > 0 && !p.basmalah ? p.prev : null),
                  SizedBox(
                    width: 56,
                    height: 56,
                    child: IconButton.filled(
                      tooltip: busy ? 'Jeda' : 'Putar ayat',
                      onPressed: () => p.togglePlay(s),
                      icon: p.status == Status.loading
                          ? SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: t.onAccent))
                          : Icon(busy ? Icons.pause : Icons.play_arrow),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Ayat berikutnya',
                    icon: const Icon(Icons.skip_next),
                    onPressed: p.surah == null || p.ayah + 1 < (p.surah?.ayat.length ?? 0) ? () => p.surah == null || p.basmalah ? p.playAyah(s, p.ayah + 1) : p.next() : null,
                  ),
                  const QueueButton(),
                ]),
                if (p.status == Status.error)
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () => p.togglePlay(s),
                      child: Text(p.basmalah ? 'Putar ulang basmalah' : 'Putar ulang ayat ${p.ayah + 1}'),
                    ),
                  ),
              ]),
            ),
          ),
        );
      },
    );
  }
}
