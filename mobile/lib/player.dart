import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';

enum Status { idle, loading, playing, paused, stopped, done, error }

enum Repeat { off, ayah, surah }

/// One player for the whole app. The audio is a native playlist: the surah being played
/// followed by every queued surah, one file each. Moving between ayat seeks inside a file,
/// and moving between queued surahs is a gapless native transition, so both keep going
/// with the phone locked (the Android media service owns playback, not the UI).
class PlayerController extends ChangeNotifier {
  PlayerController() {
    _player.playerStateStream.listen(_onPlayerState);
    _player.currentIndexStream.listen(_onIndex);
    _player.playbackEventStream.listen((_) {}, onError: (Object e, StackTrace _) => _set(Status.error));
    _player.createPositionStream(minPeriod: const Duration(milliseconds: 50), maxPeriod: const Duration(milliseconds: 200))
        .listen(_onPosition);
    _restore();
  }

  final _player = AudioPlayer();
  Surah? surah; // surah whose audio is loaded (null before the first play)
  int ayah = -1; // index into surah.ayat, -1 before the first ayah
  bool basmalah = false; // the standalone basmalah clip is loaded instead of the playlist
  int wordPos = 0; // 1-based position of the word being recited, 0 before the first
  Status status = Status.idle;
  Repeat repeat = Repeat.off;
  bool autoContinue = true;
  List<int> queue = []; // surah numbers to play after the current one
  final _surahChanged = StreamController<int>.broadcast();
  /// Emits the surah number when the queue moves on, so the open screen can follow it.
  Stream<int> get surahChanged => _surahChanged.stream;

  List<int> _playlist = []; // surah numbers in the native playlist, current first

  // ---------- persistence ----------
  Future<void> _restore() async {
    try {
      final p = await SharedPreferences.getInstance();
      queue = (p.getStringList('queue') ?? []).map(int.parse).toList();
      repeat = Repeat.values.byName(p.getString('repeat') ?? 'off');
      await _player.setLoopMode(repeat == Repeat.surah ? LoopMode.one : LoopMode.off);
      notifyListeners();
    } catch (_) {} // a corrupt or missing preference just means defaults
  }

  Future<void> _save() async {
    try {
      final p = await SharedPreferences.getInstance();
      await p.setStringList('queue', queue.map((n) => '$n').toList());
      await p.setString('repeat', repeat.name);
    } catch (_) {}
  }

  // ---------- playback ----------
  AudioSource _source(int number, String url, String title) => AudioSource.uri(Uri.parse(url),
      tag: MediaItem(id: '$number', title: title, artist: 'Mishary Rashid Alafasy', album: 'Murottal Juz 30'));

  /// Plays [s] from ayah [i], with the queue lined up behind it.
  Future<void> playAyah(Surah s, int i) async {
    if (i < 0 || i >= s.ayat.length) return;
    final sameFile = !basmalah && surah?.meta.number == s.meta.number && _player.audioSource != null;
    surah = s;
    ayah = i;
    basmalah = false;
    wordPos = 0;
    _set(Status.loading);
    try {
      if (!sameFile) {
        _playlist = [s.meta.number, ...queue];
        final metas = {for (final m in await api.surahs()) m.number: m};
        final sources = <AudioSource>[_source(s.meta.number, s.audioUrl, s.meta.nameLatin)];
        for (final n in queue) {
          final q = await api.surah(n);
          sources.add(_source(n, q.audioUrl, metas[n]?.nameLatin ?? 'Surah $n'));
        }
        await _player.setAudioSources(sources, initialIndex: 0, initialPosition: Duration(milliseconds: s.ayat[i].start));
      } else {
        await _player.seek(Duration(milliseconds: s.ayat[i].start), index: 0);
      }
      _player.play(); // not awaited: completes only when playback stops
    } catch (_) {
      _set(Status.error);
    }
  }

  /// The basmalah plays only when tapped, on its own, and stops at its end.
  Future<void> playBasmalah(Surah s) async {
    final b = s.basmalah;
    if (b == null) return;
    surah = s;
    ayah = -1;
    basmalah = true;
    wordPos = 0;
    _playlist = [];
    _set(Status.loading);
    try {
      await _player.setAudioSource(_source(s.meta.number, b.audioUrl, '${s.meta.nameLatin}, basmalah'));
      _player.play();
    } catch (_) {
      _set(Status.error);
    }
  }

  void togglePlay(Surah shown) {
    switch (status) {
      case Status.playing || Status.loading:
        _player.pause();
      case Status.paused:
        _player.play();
      case Status.stopped:
        playAyah(surah!, ayah + 1);
      case Status.error:
        basmalah ? playBasmalah(surah!) : playAyah(surah!, ayah < 0 ? 0 : ayah);
      case Status.done || Status.idle:
        playAyah(shown, 0);
    }
  }

  void next() {
    if (surah != null && ayah + 1 < surah!.ayat.length) playAyah(surah!, ayah + 1);
  }

  void prev() {
    if (surah != null && ayah > 0) playAyah(surah!, ayah - 1);
  }

  Future<void> stop() async {
    await _player.stop();
    surah = null;
    ayah = -1;
    basmalah = false;
    _playlist = [];
    _set(Status.idle);
  }

  void setRepeat(Repeat r) {
    repeat = r;
    _player.setLoopMode(r == Repeat.surah ? LoopMode.one : LoopMode.off);
    _save();
    notifyListeners();
  }

  void setAutoContinue(bool v) {
    autoContinue = v;
    notifyListeners();
  }

  // ---------- queue ----------
  bool inQueue(int n) => queue.contains(n);

  Future<void> toggleQueue(int n) async {
    final k = queue.indexOf(n);
    if (k < 0) {
      queue.add(n);
      if (_playlist.isNotEmpty) {
        // Line it up in the native playlist too, so it follows without the app's help.
        try {
          final s = await api.surah(n);
          await _player.addAudioSource(_source(n, s.audioUrl, s.meta.nameLatin));
          _playlist.add(n);
        } catch (_) {} // stays in the list; it joins the playlist on the next play
      }
    } else {
      queue.removeAt(k);
      final pk = _playlist.indexOf(n, 1);
      if (pk > 0) {
        await _player.removeAudioSourceAt(pk);
        _playlist.removeAt(pk);
      }
    }
    _save();
    notifyListeners();
  }

  Future<void> clearQueue() async {
    while (_playlist.length > 1) {
      await _player.removeAudioSourceAt(_playlist.length - 1);
      _playlist.removeLast();
    }
    queue = [];
    _save();
    notifyListeners();
  }

  /// Takes the first queued surah off the queue ("Putar antrean"); the surah screen then plays it.
  int? takeQueueHead() {
    if (queue.isEmpty) return null;
    final n = queue.removeAt(0);
    _save();
    notifyListeners();
    return n;
  }

  // ---------- events ----------
  void _set(Status s) {
    status = s;
    notifyListeners();
  }

  void _onPlayerState(PlayerState st) {
    final ps = st.processingState;
    if (ps == ProcessingState.completed) {
      if (basmalah) {
        basmalah = false;
        ayah = -1;
        _set(Status.idle);
      } else {
        wordPos = 1 << 20; // every word read
        _set(Status.done);
      }
    } else if (ps == ProcessingState.loading || ps == ProcessingState.buffering) {
      if (st.playing) _set(Status.loading);
    } else if (ps == ProcessingState.ready) {
      if (st.playing) {
        _set(Status.playing);
      } else if (status != Status.stopped && status != Status.error && status != Status.idle) {
        _set(Status.paused);
      }
    }
  }

  // The native playlist moved on to a queued surah: load its timings and follow it.
  Future<void> _onIndex(int? index) async {
    if (index == null || index == 0 || index >= _playlist.length || basmalah) return;
    final n = _playlist[index];
    _playlist = _playlist.sublist(index);
    queue = _playlist.sublist(1);
    _save();
    try {
      surah = await api.surah(n);
      ayah = 0;
      wordPos = 0;
      _surahChanged.add(n);
      notifyListeners();
    } catch (_) {}
  }

  void _onPosition(Duration p) {
    final s = surah;
    if (s == null || !_player.playing) return;
    final t = p.inMilliseconds;
    if (basmalah) {
      _paintWords(s.basmalah!.segments, t);
      return;
    }
    if (_player.currentIndex != 0 || ayah < 0) return; // queue transition in flight
    final a = s.ayat[ayah];
    // Repeat ayah: jump back inside the same file; no new playback is started, so it works locked.
    if (repeat == Repeat.ayah && (t >= a.end - 30 || s.ayahAt(t) != ayah)) {
      _player.seek(Duration(milliseconds: a.start));
      wordPos = 0;
      notifyListeners();
      return;
    }
    if (repeat == Repeat.off && !autoContinue && ayah < s.ayat.length - 1 && t >= a.end - 30 && t < a.end + 1000) {
      status = Status.stopped; // before pausing, so the state listener keeps it
      wordPos = 1 << 20;
      _player.pause();
      notifyListeners();
      return;
    }
    final k = s.ayahAt(t);
    final moved = k != ayah;
    if (moved) {
      ayah = k;
      wordPos = -1; // forces a repaint below
    }
    _paintWords(s.ayat[ayah].surahSegments, t);
  }

  // Rebuilds the UI only when the recited word (or ayah) actually changes.
  void _paintWords(List<List<int>> segs, int t) {
    var pos = 0;
    for (final g in segs) {
      if (g[1] <= t) {
        pos = g[0];
      } else {
        break;
      }
    }
    if (pos != wordPos) {
      wordPos = pos;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _player.dispose();
    _surahChanged.close();
    super.dispose();
  }
}

final player = PlayerController();
