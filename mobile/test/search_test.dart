import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:murottal/api.dart';
import 'package:murottal/search.dart';

// Same cases as app/search.test.js, against the API's own data file.
void main() {
  final surahs = (jsonDecode(File('../api/data/juz30.json').readAsStringSync()) as List)
      .map((j) => SurahMeta.fromJson(j))
      .toList();
  List<int> find(String q) => rank(q, surahs).map((s) => s.number).toList();

  test('Indonesian and English transliterations put the same surah first', () {
    for (final (q, n) in [
      ('An-Naas', 114), ('annas', 114), ('Asy-Syams', 91), ('Al-Kautsar', 108), ('Quraisy', 106),
      ('Adh-Dhuha', 93), ('Al-Lail', 92), ('Al-Ghasyiyah', 88), ('At-Takatsur', 102), ('ikhlas', 112),
    ]) {
      expect(find(q).first, n, reason: q);
    }
  });

  test('closest name ranks above partial and meaning matches', () {
    expect(find('naas'), [114, 110, 94]);
    expect(find('nas').take(2), [114, 110]);
    expect(find('fa'), [89, 113]);
    expect(find('11'), [110, 111, 112, 113, 114]);
    expect(find('111'), [111]);
  });

  test('aliases, meaning and Arabic all match', () {
    expect(find('Al-Insyirah'), [94]);
    expect(find('Al-Lahab'), [111]);
    expect(find('gajah'), contains(105));
    expect(find('الفلق').first, 113);
    expect(find('فلق').first, 113);
  });

  test('empty query keeps all in order, nonsense finds none', () {
    expect(find('  '), surahs.map((s) => s.number).toList());
    expect(find('xyzzy'), isEmpty);
  });
}
