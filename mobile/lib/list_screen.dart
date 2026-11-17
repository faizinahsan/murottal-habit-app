import 'package:flutter/material.dart';

import 'api.dart';
import 'main.dart';
import 'player.dart';
import 'queue_sheet.dart';
import 'search.dart';
import 'surah_screen.dart';

class ListScreen extends StatefulWidget {
  const ListScreen({super.key});

  @override
  State<ListScreen> createState() => _ListScreenState();
}

class _ListScreenState extends State<ListScreen> {
  late Future<List<SurahMeta>> _surahs = api.surahs();
  final _q = TextEditingController();

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = Tokens.of(context);
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 72,
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Juz 30', style: TextStyle(fontWeight: FontWeight.w600)),
          Text("37 surah, An-Naba' sampai An-Nas", style: TextStyle(fontSize: 14, color: t.inkMuted)),
        ]),
        actions: const [QueueButton(), SizedBox(width: 8)],
      ),
      body: FutureBuilder<List<SurahMeta>>(
        future: _surahs,
        builder: (context, snap) {
          if (snap.hasError) {
            return _Message(
              title: 'Daftar surah gagal dimuat.',
              hint: 'Periksa koneksi internet, lalu muat ulang.',
              action: 'Muat ulang daftar',
              onAction: () => setState(() => _surahs = api.surahs()),
            );
          }
          if (!snap.hasData) return const Center(child: CircularProgressIndicator(semanticsLabel: 'Memuat daftar surah'));
          return ValueListenableBuilder(
            valueListenable: _q,
            builder: (context, value, _) {
              final results = rank(value.text, snap.data!);
              return ListView(padding: const EdgeInsets.symmetric(horizontal: 20), children: [
                const SizedBox(height: 8),
                TextField(
                  controller: _q,
                  textInputAction: TextInputAction.search,
                  // Enter opens the best match.
                  onSubmitted: (_) {
                    if (results.isNotEmpty && value.text.trim().isNotEmpty) openSurah(Navigator.of(context), results.first.number);
                  },
                  decoration: InputDecoration(
                    labelText: 'Cari surah',
                    hintText: 'Nama, arti, atau nomor',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    suffixIcon: value.text.isEmpty
                        ? null
                        : IconButton(tooltip: 'Hapus pencarian', icon: const Icon(Icons.close), onPressed: _q.clear),
                  ),
                ),
                const SizedBox(height: 8),
                if (results.isEmpty)
                  _Message(
                    title: 'Tidak ada surah untuk "${value.text.trim()}".',
                    hint: 'Coba ejaan lain, arti surah, atau nomornya, misalnya 112.',
                    action: 'Hapus pencarian',
                    onAction: _q.clear,
                  ),
                for (final s in results) _SurahRow(s),
                const SizedBox(height: 24),
              ]);
            },
          );
        },
      ),
    );
  }
}

class _SurahRow extends StatelessWidget {
  const _SurahRow(this.s);
  final SurahMeta s;

  @override
  Widget build(BuildContext context) {
    final t = Tokens.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: t.line))),
      child: Row(children: [
        Expanded(
          child: InkWell(
            onTap: () => openSurah(Navigator.of(context), s.number),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 72),
              child: Row(children: [
                SizedBox(width: 32, child: Text('${s.number}', style: TextStyle(fontSize: 12, color: t.inkMuted))),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                    Text(s.nameLatin, style: const TextStyle(fontSize: 16)),
                    Text('${s.meaning}, ${s.ayahCount} ayat', style: TextStyle(fontSize: 14, color: t.inkMuted)),
                  ]),
                ),
                Text(s.nameArabic, textDirection: TextDirection.rtl, style: arabic(24, t.ink, height: 1.6)),
              ]),
            ),
          ),
        ),
        ListenableBuilder(
          listenable: player,
          builder: (context, _) {
            final inQ = player.inQueue(s.number);
            return IconButton(
              tooltip: inQ ? 'Hapus ${s.nameLatin} dari antrean' : 'Tambah ${s.nameLatin} ke antrean',
              color: inQ ? t.accent : t.ink,
              icon: Icon(inQ ? Icons.check : Icons.add),
              onPressed: () => player.toggleQueue(s.number),
            );
          },
        ),
      ]),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.title, required this.hint, required this.action, required this.onAction});
  final String title, hint, action;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 40, 20, 0),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(fontSize: 16)),
          const SizedBox(height: 4),
          Text(hint, style: TextStyle(fontSize: 14, color: Tokens.of(context).inkMuted)),
          const SizedBox(height: 12),
          FilledButton(onPressed: onAction, child: Text(action)),
        ]),
      );
}
