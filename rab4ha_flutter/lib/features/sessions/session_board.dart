import 'package:flutter/material.dart';

import '../../shared/widgets/deck_stack.dart';
import '../../shared/widgets/player_avatar.dart';

/// لوحة 2v2 للجلسات — مطابقة sessions.js
class SessionTeamsBoard extends StatelessWidget {
  const SessionTeamsBoard({
    super.key,
    required this.seats,
    required this.onJoinSeat,
    this.canJoin = true,
    this.sessionOpen = true,
    this.isFull = false,
  });

  final List<dynamic> seats;
  final void Function(int seat) onJoinSeat;
  final bool canJoin;
  final bool sessionOpen;
  final bool isFull;

  @override
  Widget build(BuildContext context) {
    Widget seatWidget(int index) {
      final player = index < seats.length && seats[index] != null
          ? Map<String, dynamic>.from(seats[index] as Map)
          : null;
      if (player != null) {
        return _OccupiedSeat(player: player);
      }
      final blocked = !sessionOpen || isFull || !canJoin;
      return _EmptySeat(
        seatIndex: index,
        onJoin: blocked ? null : () => onJoinSeat(index),
      );
    }

    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [seatWidget(1), seatWidget(0)],
        ),
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 8),
          child: Text('VS', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.amber)),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [seatWidget(2), seatWidget(3)],
        ),
      ],
    );
  }
}

class _OccupiedSeat extends StatelessWidget {
  const _OccupiedSeat({required this.player});
  final Map<String, dynamic> player;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 120,
      child: Column(
        children: [
          Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              PlayerAvatar(data: player, size: 52, vipFrame: true),
              Positioned(
                bottom: -4,
                right: -8,
                child: HomeDeckStack(
                  deckBackUrl: player['deck_back_url']?.toString() ?? '/cards/back_dark.png',
                  cardWidth: 16,
                  cardHeight: 22,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            player['name']?.toString() ?? '',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
          ),
          if (player['is_host'] == true)
            const Text('مضيف', style: TextStyle(fontSize: 10, color: Colors.amber)),
          buildRankPill(player, fontSize: 9),
        ],
      ),
    );
  }
}

class _EmptySeat extends StatelessWidget {
  const _EmptySeat({required this.seatIndex, this.onJoin});
  final int seatIndex;
  final VoidCallback? onJoin;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 120,
      height: 100,
      child: OutlinedButton(
        onPressed: onJoin,
        style: OutlinedButton.styleFrom(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.add, color: onJoin != null ? Colors.cyan : Colors.white24),
            Text(onJoin != null ? 'انضم' : 'فارغ', style: const TextStyle(fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

class SessionCardPreview extends StatelessWidget {
  const SessionCardPreview({super.key, required this.session, required this.onTap});
  final Map<String, dynamic> session;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final seats = session['seats'] as List? ?? [];
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      session['title']?.toString() ?? '',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                  ),
                  if (session['stake'] != null && (session['stake'] as num) > 0)
                    Text('🪙 ${session['stake']}'),
                ],
              ),
              Text('${session['host_name']} · ${session['min_rank_label'] ?? ''}'),
              Text('${session['player_count']}/${session['max_players']} لاعبين'),
              const SizedBox(height: 8),
              SessionTeamsBoard(
                seats: seats,
                onJoinSeat: (_) => onTap(),
                canJoin: false,
                sessionOpen: session['is_open'] == true,
                isFull: session['is_full'] == true,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
