import 'dart:async';



import 'package:flutter/material.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:go_router/go_router.dart';



import '../../core/network/api_client.dart';

import '../../core/theme/rab4ha_theme.dart';

import '../../shared/widgets/player_avatar.dart';



const _lbHints = {

  'rank_kings':

      'أفضل 100 لاعب في نقاط الأسبوع للعب المصنّف — أوائل 10 يحصلون على ميدالية الأبطال',

  'tournament_stars': 'ترتيب نجوم الفوز في البطولات الترفيهية ⭐',

  'charisma': 'الكاريزما من إهداء الذهب وVIP — كلما أهديت أكثر ارتفع ترتيبك',

};



class LeaderboardsScreen extends ConsumerStatefulWidget {

  const LeaderboardsScreen({super.key});



  @override

  ConsumerState<LeaderboardsScreen> createState() => _LeaderboardsScreenState();

}



class _LeaderboardsScreenState extends ConsumerState<LeaderboardsScreen>

    with SingleTickerProviderStateMixin {

  late TabController _tabs;

  var _tab = 'rank_kings';

  Map<String, dynamic>? _data;

  Timer? _poll;



  @override

  void initState() {

    super.initState();

    _tabs = TabController(length: 3, vsync: this);

    _tabs.addListener(() {

      if (!_tabs.indexIsChanging) {

        _tab = ['rank_kings', 'tournament_stars', 'charisma'][_tabs.index];

        _load();

      }

    });

    _load();

    _poll = Timer.periodic(const Duration(seconds: 4), (_) => _load(silent: true));

  }



  Future<void> _load({bool silent = false}) async {

    try {

      final api = ref.read(apiClientProvider);

      final res = await api.get('/api/leaderboards/$_tab');

      final data = await api.parseJson(res);

      if (mounted) setState(() => _data = data);

    } catch (_) {

      if (!silent && mounted) {

        ScaffoldMessenger.of(context).showSnackBar(

          const SnackBar(content: Text('تعذّر تحميل لوحة الشرف')),

        );

      }

    }

  }



  @override

  void dispose() {

    _poll?.cancel();

    _tabs.dispose();

    super.dispose();

  }



  @override

  Widget build(BuildContext context) {

    final c = rab4haColors(context);

    return Scaffold(

      backgroundColor: c.bgDark,

      appBar: AppBar(

        title: const Text('لوحة الشرف'),

        leading: BackButton(onPressed: () => context.go('/home')),

        bottom: TabBar(

          controller: _tabs,

          labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),

          tabs: const [

            Tab(text: 'ملوك التصنيف'),

            Tab(text: 'نجوم البطولات'),

            Tab(text: 'الكاريزما'),

          ],

        ),

      ),

      body: _data == null

          ? const Center(child: CircularProgressIndicator())

          : RefreshIndicator(

              onRefresh: _load,

              child: ListView(

                padding: const EdgeInsets.all(14),

                children: [

                  Text(

                    _data!['subtitle']?.toString() ?? '',

                    textAlign: TextAlign.center,

                    style: TextStyle(color: c.textMuted, fontSize: 13),

                  ),

                  const SizedBox(height: 8),

                  Text(

                    _lbHints[_tab] ?? '',

                    textAlign: TextAlign.center,

                    style: TextStyle(color: c.textMuted, fontSize: 12, height: 1.45),

                  ),

                  const SizedBox(height: 16),

                  if (_data!['my_entry'] != null)

                    _MyRankCard(entry: Map<String, dynamic>.from(_data!['my_entry'] as Map)),

                  const SizedBox(height: 12),

                  ...((_data!['entries'] as List?) ?? []).map((e) {

                    return _LbRow(entry: Map<String, dynamic>.from(e as Map));

                  }),

                ],

              ),

            ),

    );

  }

}



class _MyRankCard extends StatelessWidget {

  const _MyRankCard({required this.entry});

  final Map<String, dynamic> entry;



  @override

  Widget build(BuildContext context) {

    final c = rab4haColors(context);
    return Container(

      padding: const EdgeInsets.all(14),

      decoration: BoxDecoration(

        gradient: LinearGradient(

          colors: [

            const Color(0xFFC5A059).withValues(alpha: 0.18),

            const Color(0xFF1A1A1A).withValues(alpha: 0.95),

          ],

        ),

        borderRadius: BorderRadius.circular(16),

        border: Border.all(color: const Color(0xFFC5A059).withValues(alpha: 0.45)),

      ),

      child: Row(

        children: [

          Text(

            _posLabel(entry['position'] as int? ?? 0),

            style: const TextStyle(fontSize: 28),

          ),

          const SizedBox(width: 10),

          PlayerAvatar(data: entry, size: 48, vipFrame: true),

          const SizedBox(width: 12),

          Expanded(

            child: Column(

              crossAxisAlignment: CrossAxisAlignment.start,

              children: [

                Text(

                  'ترتيبك',

                  style: TextStyle(color: c.textMuted, fontSize: 12),

                ),

                Text(

                  entry['name']?.toString() ?? '',

                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),

                ),

                buildRankPill(entry),

              ],

            ),

          ),

          Text(

            entry['score_label']?.toString() ?? '',

            style: const TextStyle(

              color: Color(0xFFFDE68A),

              fontWeight: FontWeight.bold,

              fontSize: 15,

            ),

          ),

        ],

      ),

    );

  }

}



class _LbRow extends StatelessWidget {

  const _LbRow({required this.entry});

  final Map<String, dynamic> entry;



  @override

  Widget build(BuildContext context) {

    final c = rab4haColors(context);
    final pos = entry['position'] as int? ?? 0;

    final topBorder = switch (pos) {

      1 => const Color(0xFFFBBF24).withValues(alpha: 0.55),

      2 => const Color(0xFFCBD5E1).withValues(alpha: 0.4),

      3 => const Color(0xFFB4783C).withValues(alpha: 0.45),

      _ => Colors.white.withValues(alpha: 0.06),

    };



    final medal = (entry['has_champion_medal'] == true ||

            (entry['champion_medals'] as int? ?? 0) > 0)

        ? '🏅'

        : '';

    final weekly = entry['is_weekly_top10'] == true ? '⭐' : '';



    return Container(

      margin: const EdgeInsets.only(bottom: 8),

      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),

      decoration: BoxDecoration(

        color: const Color(0xFF1A1A1A).withValues(alpha: 0.88),

        borderRadius: BorderRadius.circular(14),

        border: Border.all(color: topBorder, width: pos <= 3 ? 1.5 : 1),

      ),

      child: Row(

        children: [

          SizedBox(

            width: 36,

            child: Text(

              _posLabel(pos),

              textAlign: TextAlign.center,

              style: TextStyle(

                fontSize: pos <= 3 ? 22 : 16,

                fontWeight: FontWeight.bold,

                color: pos <= 3 ? const Color(0xFFFDE68A) : c.textMuted,

              ),

            ),

          ),

          PlayerAvatar(data: entry, size: 42, vipFrame: true),

          const SizedBox(width: 10),

          Expanded(

            child: Column(

              crossAxisAlignment: CrossAxisAlignment.start,

              children: [

                Row(

                  children: [

                    Flexible(

                      child: Text(

                        entry['name']?.toString() ?? '',

                        style: const TextStyle(

                          fontWeight: FontWeight.bold,

                          fontSize: 14,

                        ),

                        overflow: TextOverflow.ellipsis,

                      ),

                    ),

                    buildStatusBadgeFromMap(entry, size: 16),

                    if (medal.isNotEmpty) Text(' $medal'),

                    if (weekly.isNotEmpty) Text(' $weekly'),

                  ],

                ),

                const SizedBox(height: 4),

                buildRankPill(entry),

              ],

            ),

          ),

          const SizedBox(width: 8),

          Text(

            entry['score_label']?.toString() ?? '',

            style: const TextStyle(

              color: Color(0xFFF0C96A),

              fontWeight: FontWeight.bold,

              fontSize: 13,

            ),

          ),

        ],

      ),

    );

  }

}



String _posLabel(int pos) {

  return switch (pos) {

    1 => '🥇',

    2 => '🥈',

    3 => '🥉',

    _ => '#$pos',

  };

}


