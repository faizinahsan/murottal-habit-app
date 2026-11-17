import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:just_audio_background/just_audio_background.dart';

import 'list_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await JustAudioBackground.init(
    androidNotificationChannelId: 'com.murottal.audio',
    androidNotificationChannelName: 'Murottal',
    androidNotificationOngoing: true, // the notification stays while a surah plays, like a music app
  );
  runApp(const MurottalApp());
}

/// Colors from DESIGN.md (same tokens as the PWA): warm paper, ink, one green accent.
class Tokens extends ThemeExtension<Tokens> {
  const Tokens({required this.paper, required this.ink, required this.inkMuted, required this.accent,
      required this.accentSoft, required this.onAccent, required this.line});
  final Color paper, ink, inkMuted, accent, accentSoft, onAccent, line;

  static const light = Tokens(paper: Color(0xFFF6F1E7), ink: Color(0xFF1F1B16), inkMuted: Color(0xFF5C5346),
      accent: Color(0xFF1F5F4A), accentSoft: Color(0xFFE3EDE6), onAccent: Color(0xFFF6F1E7), line: Color(0xFFDDD3C2));
  static const dark = Tokens(paper: Color(0xFF14120F), ink: Color(0xFFEDE6D8), inkMuted: Color(0xFFA99F8E),
      accent: Color(0xFF7FC2A5), accentSoft: Color(0xFF1F2E27), onAccent: Color(0xFF14120F), line: Color(0xFF2E2A24));

  static Tokens of(BuildContext c) => Theme.of(c).extension<Tokens>()!;

  @override
  Tokens copyWith() => this;
  @override
  Tokens lerp(Tokens? other, double t) => t < .5 ? this : (other ?? this);
}

ThemeData _theme(Tokens t, Brightness b) {
  // Literata via fontFamily: google_fonts' TextTheme helpers target the newer material_ui types.
  final base = ThemeData(brightness: b, useMaterial3: true, fontFamily: GoogleFonts.literata().fontFamily);
  return base.copyWith(
    scaffoldBackgroundColor: t.paper,
    colorScheme: ColorScheme.fromSeed(seedColor: t.accent, brightness: b).copyWith(
        primary: t.accent, onPrimary: t.onAccent, surface: t.paper, onSurface: t.ink, outline: t.inkMuted),
    textTheme: base.textTheme.apply(bodyColor: t.ink, displayColor: t.ink),
    appBarTheme: AppBarTheme(backgroundColor: t.paper, foregroundColor: t.ink, elevation: 0, scrolledUnderElevation: 0),
    dividerColor: t.line,
    extensions: [t],
  );
}

class MurottalApp extends StatelessWidget {
  const MurottalApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Murottal Juz 30',
        debugShowCheckedModeBanner: false,
        theme: _theme(Tokens.light, Brightness.light),
        darkTheme: _theme(Tokens.dark, Brightness.dark),
        home: const ListScreen(),
      );
}

TextStyle arabic(double size, Color color, {double height = 2}) =>
    GoogleFonts.amiriQuran(fontSize: size, color: color, height: height);

String toIndic(int n) => '$n'.split('').map((d) => '٠١٢٣٤٥٦٧٨٩'[int.parse(d)]).join();
