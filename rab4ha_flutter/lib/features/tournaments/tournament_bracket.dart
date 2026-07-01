import 'package:flutter/material.dart';

import '../../shared/widgets/player_avatar.dart';

class TournamentBracketView extends StatelessWidget {
  const TournamentBracketView({super.key, required this.bracket});
  final Map<String, dynamic> bracket;

  @override
  Widget build(BuildContext context) {
    final rounds = (bracket['rounds'] as List?) ?? [];
    if (rounds.isEmpty) {
      return const Center(child: Text('الشجرة ستظهر عند بدء البطولة'));
    }
    final championId = bracket['champion_team_id'];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: rounds.map((round) {
          final r = Map<String, dynamic>.from(round as Map);
          final matches = (r['matches'] as List?) ?? [];
          return Padding(
            padding: const EdgeInsets.only(left: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  r['label']?.toString() ?? '',
                  style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFFBBF24)),
                ),
                const SizedBox(height: 8),
                ...matches.map((m) {
                  final match = Map<String, dynamic>.from(m as Map);
                  return _MatchCard(match: match, championId: championId);
                }),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _MatchCard extends StatelessWidget {
  const _MatchCard({required this.match, this.championId});
  final Map<String, dynamic> match;
  final dynamic championId;

  @override
  Widget build(BuildContext context) {
    final t1 = match['team1'] as Map?;
    final t2 = match['team2'] as Map?;
    final winner = match['winner_team_id'];
    final w1 = winner != null && t1 != null && winner == t1['id'];
    final w2 = winner != null && t2 != null && winner == t2['id'];
    return Container(
      width: 160,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: (t1?['id'] == championId || t2?['id'] == championId)
              ? const Color(0xFFFBBF24)
              : Colors.white12,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _teamLine(t1, winner: w1),
          const Divider(height: 12),
          _teamLine(t2, winner: w2),
          if (match['score1'] != null)
            Text('${match['score1']} — ${match['score2']}',
                style: const TextStyle(fontSize: 11, color: Colors.white54)),
        ],
      ),
    );
  }

  Widget _teamLine(Map? team, {required bool winner}) {
    if (team == null) return const Text('—', style: TextStyle(color: Colors.white38));
    return Text(
      team['name']?.toString() ?? 'فريق',
      style: TextStyle(
        fontWeight: winner ? FontWeight.bold : FontWeight.normal,
        color: winner ? Colors.greenAccent : null,
      ),
    );
  }
}

class TournamentPlayerGrid extends StatelessWidget {
  const TournamentPlayerGrid({super.key, required this.players});
  final List<dynamic> players;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        childAspectRatio: 0.85,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
      ),
      itemCount: players.length,
      itemBuilder: (_, i) {
        final p = Map<String, dynamic>.from(players[i] as Map);
        return Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: const Color(0xFF1A1A1A),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: p['checked_in'] == true ? Colors.green : Colors.white12,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              PlayerAvatar(data: p, size: 40, vipFrame: true),
              const SizedBox(height: 4),
              Text(
                p['name']?.toString() ?? '',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11),
              ),
              if (p['checked_in'] == true)
                const Text('✓ حاضر', style: TextStyle(fontSize: 9, color: Colors.greenAccent)),
            ],
          ),
        );
      },
    );
  }
}
