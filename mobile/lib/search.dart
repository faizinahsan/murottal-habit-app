// Port of app/search.js: surah search that tolerates Indonesian and English spellings
// (An-Nas / An-Naas, Asy-Syams / Ash-Shams, Al-Kautsar / Al-Kawthar) and ranks the closest name first.
import 'api.dart';

String latinKey(String s) {
  var k = s.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
  for (final p in [
    [RegExp('sy|sh'), 's'],
    [RegExp('dh|dz'), 'd'],
    [RegExp('th|ts'), 't'],
    [RegExp('kh'), 'k'],
    [RegExp('gh'), 'g'],
    [RegExp('q'), 'k'],
    [RegExp('y'), 'i'],
    [RegExp('w'), 'u'],
  ]) {
    k = k.replaceAll(p[0] as RegExp, p[1] as String);
  }
  return k.replaceAllMapped(RegExp(r'(.)\1+'), (m) => m[1]!);
}

String _stripArticle(String s) =>
    s.trim().replaceFirst(RegExp(r"^(al|an|ar|as|at|ad|az|ash|asy|adh|ath)[\s'-]+", caseSensitive: false), '');

String arabicKey(String s) =>
    s.replaceAll(RegExp('[ً-ٰٟـ\\s]'), '').replaceAll(RegExp('[أإآٱ]'), 'ا');

// Lower is better: 0 exact name, 1 name starts with the query, 2 name contains it, 3 meaning contains it.
double _score(SurahMeta s, String q) {
  if (RegExp(r'^\d+$').hasMatch(q)) {
    final n = '${s.number}';
    return n == q ? 0 : (n.startsWith(q) ? 1 : double.infinity);
  }
  if (RegExp('[؀-ۿ]').hasMatch(q)) {
    String bare(String x) => x.replaceFirst(RegExp('^ال'), '');
    final a = arabicKey(s.nameArabic), k = arabicKey(q);
    if (a == k || bare(a) == bare(k)) return 0;
    if (bare(a).startsWith(bare(k))) return 1;
    return a.contains(k) ? 2 : double.infinity;
  }
  final qFull = latinKey(q), qBase = latinKey(_stripArticle(q));
  if (qFull.isEmpty) return 0;
  var best = double.infinity;
  for (final name in [s.nameLatin, ...s.aliases]) {
    final full = latinKey(name), base = latinKey(_stripArticle(name));
    if (full == qFull || (qBase.isNotEmpty && base == qBase)) return 0;
    if (full.startsWith(qFull) || (qBase.isNotEmpty && base.startsWith(qBase))) {
      best = best < 1 ? best : 1;
    } else if (full.contains(qFull)) {
      best = best < 2 ? best : 2;
    }
  }
  if (best == double.infinity && latinKey(s.meaning).contains(qFull)) best = 3;
  return best;
}

/// Matching surahs, best first; ties keep surah order. An empty query returns all of them.
List<SurahMeta> rank(String query, List<SurahMeta> surahs) {
  final q = query.trim();
  if (q.isEmpty) return List.of(surahs);
  final scored = <(SurahMeta, int, double)>[];
  for (var i = 0; i < surahs.length; i++) {
    final sc = _score(surahs[i], q);
    if (sc != double.infinity) scored.add((surahs[i], i, sc));
  }
  scored.sort((a, b) => a.$3 != b.$3 ? a.$3.compareTo(b.$3) : a.$2.compareTo(b.$2));
  return scored.map((x) => x.$1).toList();
}
