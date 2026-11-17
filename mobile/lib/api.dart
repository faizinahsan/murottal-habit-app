import 'dart:convert';

import 'package:http/http.dart' as http;

/// Same API as the PWA (api/server.js). Pass the address at build time:
/// flutter build apk --dart-define=API_BASE=https://your-host
/// The default reaches the Mac from the Android emulator.
const apiBase = String.fromEnvironment('API_BASE', defaultValue: 'http://10.0.2.2:8787');

List<String> _strings(dynamic v) => (v as List? ?? const []).cast<String>();

class SurahMeta {
  SurahMeta.fromJson(Map<String, dynamic> j)
      : number = j['number'],
        nameLatin = j['nameLatin'],
        nameArabic = j['nameArabic'],
        meaning = j['meaning'],
        aliases = _strings(j['aliases']),
        ayahCount = j['ayahCount'];
  final int number;
  final String nameLatin, nameArabic, meaning;
  final List<String> aliases;
  final int ayahCount;
}

/// The basmalah recitation: its own short file.
class Basmalah {
  Basmalah.fromJson(Map<String, dynamic> j)
      : words = _strings(j['words']),
        translation = j['translation'] ?? '',
        audioUrl = j['audioUrl'];
  final List<String> words;
  final String translation, audioUrl;
}

class Ayah {
  Ayah.fromJson(Map<String, dynamic> j)
      : number = j['number'],
        words = _strings(j['words']),
        translation = j['translation'] ?? '',
        start = (j['start'] as num).toInt(),
        end = (j['end'] as num).toInt();
  final int number;
  final List<String> words;
  final String translation;
  final int start, end; // ms inside the surah file
}

class Surah {
  Surah.fromJson(Map<String, dynamic> j)
      : meta = SurahMeta.fromJson(j),
        audioUrl = j['audioUrl'],
        basmalah = j['basmalah'] == null ? null : Basmalah.fromJson(j['basmalah']),
        ayat = (j['ayat'] as List).map((a) => Ayah.fromJson(a)).toList();
  final SurahMeta meta;
  final String audioUrl; // one file for the whole surah: playback seeks inside it
  final Basmalah? basmalah;
  final List<Ayah> ayat;

  /// Index of the ayah playing at surah time [ms].
  int ayahAt(int ms) {
    var k = 0;
    while (k + 1 < ayat.length && ayat[k + 1].start <= ms) {
      k++;
    }
    return k;
  }
}

class Api {
  final _cache = <String, Future<dynamic>>{};

  // Cache the future; a failed request is dropped so "Muat ulang" really retries.
  Future<dynamic> _get(String path) => _cache.putIfAbsent(path, () async {
        try {
          final res = await http.get(Uri.parse('$apiBase$path')).timeout(const Duration(seconds: 20));
          if (res.statusCode != 200) throw Exception('HTTP ${res.statusCode}');
          return jsonDecode(utf8.decode(res.bodyBytes));
        } catch (_) {
          _cache.remove(path);
          rethrow;
        }
      });

  Future<List<SurahMeta>> surahs() async =>
      ((await _get('/surahs')) as List).map((j) => SurahMeta.fromJson(j)).toList();

  Future<Surah> surah(int n) async => Surah.fromJson(await _get('/surahs/$n'));
}

final api = Api();
