class AuthUser {
  AuthUser({
    required this.id,
    required this.displayName,
    required this.playerCode,
    this.role,
    this.isAdmin = false,
    this.isVip = false,
    this.isFamous = false,
    this.star,
  });

  factory AuthUser.fromJson(Map<String, dynamic> j) => AuthUser(
        id: j['id']?.toString() ?? '',
        displayName: j['display_name']?.toString() ?? j['name']?.toString() ?? '',
        playerCode: j['player_code']?.toString() ?? '',
        role: j['role']?.toString(),
        isAdmin: j['is_admin'] == true || j['role'] == 'admin',
        isVip: j['is_vip'] == true,
        isFamous: j['is_famous'] == true,
        star: j['star']?.toString(),
      );

  final String id;
  final String displayName;
  final String playerCode;
  final String? role;
  final bool isAdmin;
  final bool isVip;
  final bool isFamous;
  final String? star;

  Map<String, dynamic> toJson() => {
        'id': id,
        'display_name': displayName,
        'player_code': playerCode,
        'role': role,
        'is_admin': isAdmin,
        'is_vip': isVip,
        'is_famous': isFamous,
        'star': star,
      };
}

class PlayerProfile {
  PlayerProfile({
    required this.name,
    this.playerCode,
    this.coins = 0,
    this.gems = 1000,
    this.rank = 0,
    this.subRank = 0,
    this.rankPoints = 0,
    this.wins = 0,
    this.losses = 0,
    this.championshipStars = 0,
    this.avatarUrl,
    this.avatarRemoved = false,
    this.deckBackUrl,
    this.rankTheme = 'wood',
    this.rankLabel,
    this.nextRankLabel,
    this.pointsToNext,
    this.radarStats = const {},
    this.profileLimits,
    this.isVip = false,
    this.isAdmin = false,
    this.isFamous = false,
    this.star,
  });

  factory PlayerProfile.fromJson(Map<String, dynamic> j) => PlayerProfile(
        name: j['name']?.toString() ?? 'لاعب',
        playerCode: j['player_code']?.toString(),
        coins: (j['coins'] as num?)?.toInt() ?? 0,
        gems: (j['gems'] as num?)?.toInt() ?? 1000,
        rank: (j['rank'] as num?)?.toInt() ?? 0,
        subRank: (j['sub_rank'] as num?)?.toInt() ?? 0,
        rankPoints: (j['rank_points'] as num?)?.toInt() ?? 0,
        wins: (j['wins'] as num?)?.toInt() ?? 0,
        losses: (j['losses'] as num?)?.toInt() ?? 0,
        championshipStars: (j['championship_stars'] as num?)?.toInt() ?? 0,
        avatarUrl: j['avatar_url']?.toString(),
        avatarRemoved: j['avatar_removed'] == true,
        deckBackUrl: j['deck_back_url']?.toString(),
        rankTheme: j['rankTheme']?.toString() ?? j['rank_theme']?.toString() ?? 'wood',
        rankLabel: j['rankLabel']?.toString() ?? j['rank_label']?.toString(),
        nextRankLabel: j['nextRankLabel']?.toString() ?? j['next_rank_label']?.toString(),
        pointsToNext: (j['pointsToNext'] as num?)?.toInt() ?? (j['points_to_next'] as num?)?.toInt(),
        radarStats: Map<String, num>.from(
          (j['radarStats'] as Map?)?.map((k, v) => MapEntry(k.toString(), v as num)) ??
              (j['radar_stats'] as Map?)?.map((k, v) => MapEntry(k.toString(), v as num)) ??
              {},
        ),
        profileLimits: j['profile_limits'] as Map<String, dynamic>?,
        isVip: j['is_vip'] == true,
        isAdmin: j['is_admin'] == true,
        isFamous: j['is_famous'] == true,
        star: j['star']?.toString(),
      );

  final String name;
  final String? playerCode;
  final int coins;
  final int gems;
  final int rank;
  final int subRank;
  final int rankPoints;
  final int wins;
  final int losses;
  final int championshipStars;
  final String? avatarUrl;
  final bool avatarRemoved;
  final String? deckBackUrl;
  final String rankTheme;
  final String? rankLabel;
  final String? nextRankLabel;
  final int? pointsToNext;
  final Map<String, num> radarStats;
  final Map<String, dynamic>? profileLimits;
  final bool isVip;
  final bool isAdmin;
  final bool isFamous;
  final String? star;

  int get progressPercent => (rankPoints / 100 * 100).round().clamp(0, 100);

  Map<String, num> get effectiveRadar => radarStats.isEmpty
      ? {
          'fair': 55,
          'buy': 55,
          'qaid': 50,
          'kaboot': 50,
          'speed': 55,
          'projects': 50,
        }
      : radarStats;
}
