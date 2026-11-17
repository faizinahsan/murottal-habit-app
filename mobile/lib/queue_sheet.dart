import 'package:flutter/material.dart';

import 'api.dart';
import 'main.dart';
import 'player.dart';
import 'surah_screen.dart';

/// Queue button with a count badge; used on the list app bar and in the player bar.
class QueueButton extends StatelessWidget {
  const QueueButton({super.key});

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: player,
        builder: (context, _) {
          final n = player.queue.length;
          return IconButton(
            tooltip: n == 0 ? 'Antrean, kosong' : 'Antrean, $n surah',
            onPressed: () => showQueueSheet(context),
            icon: Badge(isLabelVisible: n > 0, label: Text('$n'), child: const Icon(Icons.playlist_add)),
          );
        },
      );
}

void showQueueSheet(BuildContext context) => showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) => const _QueueSheet(),
    );

class _QueueSheet extends StatelessWidget {
  const _QueueSheet();

  @override
  Widget build(BuildContext context) {
    final t = Tokens.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: FutureBuilder<List<SurahMeta>>(
          future: api.surahs(),
          builder: (context, snap) => ListenableBuilder(
            listenable: player,
            builder: (context, _) {
              final byN = {for (final s in snap.data ?? <SurahMeta>[]) s.number: s};
              final q = player.queue;
              return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Antrean', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text('Setelah surah yang sedang diputar selesai, surah di antrean diputar berurutan.',
                    style: TextStyle(color: t.inkMuted, fontSize: 14)),
                const SizedBox(height: 8),
                if (q.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    child: Text('Antrean masih kosong. Tambahkan surah dengan tombol + di daftar surah.',
                        style: TextStyle(color: t.inkMuted)),
                  )
                else
                  Flexible(
                    child: ListView(shrinkWrap: true, children: [
                      for (final (k, n) in q.indexed)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Text('${k + 1}', style: TextStyle(color: t.inkMuted, fontSize: 12)),
                          minLeadingWidth: 20,
                          title: Text(byN[n]?.nameLatin ?? 'Surah $n'),
                          subtitle: byN[n] == null ? null : Text('${byN[n]!.ayahCount} ayat'),
                          trailing: IconButton(
                            tooltip: 'Hapus ${byN[n]?.nameLatin ?? 'surah $n'} dari antrean',
                            icon: const Icon(Icons.close),
                            onPressed: () => player.toggleQueue(n),
                          ),
                        ),
                    ]),
                  ),
                if (q.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Wrap(spacing: 8, runSpacing: 8, children: [
                    FilledButton(
                      onPressed: () {
                        final nav = Navigator.of(context);
                        nav.pop();
                        final n = player.takeQueueHead();
                        if (n != null) openSurah(nav, n, autoplay: true, replace: SurahScreen.isOpen);
                      },
                      child: const Text('Putar antrean'),
                    ),
                    OutlinedButton(onPressed: player.clearQueue, child: const Text('Kosongkan antrean')),
                  ]),
                ],
              ]);
            },
          ),
        ),
      ),
    );
  }
}
