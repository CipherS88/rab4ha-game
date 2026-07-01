import '../../core/network/api_client.dart';

/// إعدادات اليد حسب عدد الكروت (5–8).
class HandVariant {
  const HandVariant({
    this.elements = const {},
    this.handCardGap = 1.0,
    this.handCardScale = 1.0,
  });

  final Map<String, GameLayoutBox> elements;
  final double handCardGap;
  final double handCardScale;

  static const handElementIds = ['my_hand', 'bid_buttons', 'project_bar'];
  static const variantKeys = ['5', '6', '7', '8'];

  static String variantKeyForCount(int count) {
    if (count <= 5) return '5';
    if (count >= 8) return '8';
    return count.toString();
  }

  static GameLayoutBox _lerpBox(GameLayoutBox a, GameLayoutBox b, double t) {
    return GameLayoutBox(
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      w: a.w + (b.w - a.w) * t,
      h: a.h + (b.h - a.h) * t,
    );
  }

  static HandVariant _lerpVariant(HandVariant a, HandVariant b, double t) {
    final elements = <String, GameLayoutBox>{};
    for (final id in handElementIds) {
      final boxA = a.elements[id];
      final boxB = b.elements[id];
      if (boxA != null && boxB != null) {
        elements[id] = _lerpBox(boxA, boxB, t);
      }
    }
    return HandVariant(
      elements: elements,
      handCardGap: a.handCardGap + (b.handCardGap - a.handCardGap) * t,
      handCardScale: a.handCardScale + (b.handCardScale - a.handCardScale) * t,
    );
  }

  static HandVariant _defaults5() {
    return HandVariant(
      elements: {
        'my_hand': GameLayoutBox(x: 0.0102, y: 0.817, w: 1, h: 0.1908),
        'bid_buttons': GameLayoutBox(x: 0.2121, y: 0.6501, w: 0.5911, h: 0.0454),
        'project_bar': GameLayoutBox(x: 0, y: 0.5374, w: 0.9974, h: 0.0691),
      },
      handCardGap: 0.6,
      handCardScale: 1.48,
    );
  }

  static HandVariant _defaults8() {
    return HandVariant(
      elements: {
        'my_hand': GameLayoutBox(x: 0.0128, y: 0.8156, w: 1, h: 0.1908),
        'bid_buttons': GameLayoutBox(x: 0.1687, y: 0.6416, w: 0.6116, h: 0.0478),
        'project_bar': GameLayoutBox(x: 0.0051, y: 0.6436, w: 0.974, h: 0.04),
      },
      handCardGap: 0.68,
      handCardScale: 1.32,
    );
  }

  HandVariant copyWith({
    Map<String, GameLayoutBox>? elements,
    double? handCardGap,
    double? handCardScale,
  }) {
    return HandVariant(
      elements: elements ?? this.elements,
      handCardGap: handCardGap ?? this.handCardGap,
      handCardScale: handCardScale ?? this.handCardScale,
    );
  }

  factory HandVariant.fromJson(Map<String, dynamic>? j) {
    if (j == null) return const HandVariant();
    final raw = j['elements'] as Map<String, dynamic>? ?? {};
    final elements = <String, GameLayoutBox>{};
    for (final id in handElementIds) {
      final v = raw[id];
      if (v is Map<String, dynamic>) {
        elements[id] = GameLayoutBox.fromJson(v);
      }
    }
    return HandVariant(
      elements: elements,
      handCardGap: ((j['hand_card_gap'] as num?)?.toDouble() ?? 1.0).clamp(0.3, 3.0),
      handCardScale: ((j['hand_card_scale'] as num?)?.toDouble() ?? 1.0).clamp(0.4, 2.5),
    );
  }

  Map<String, dynamic> toJson() => {
        'elements': elements.map((k, v) => MapEntry(k, v.toJson())),
        'hand_card_gap': handCardGap,
        'hand_card_scale': handCardScale,
      };

  static HandVariant defaultsFor(String key) {
    final v5 = _defaults5();
    final v8 = _defaults8();
    return switch (key) {
      '5' => v5,
      '8' => v8,
      '6' => _lerpVariant(v5, v8, 1 / 3),
      '7' => _lerpVariant(v5, v8, 2 / 3),
      _ => v8,
    };
  }
}

class GameLayoutTuning {
  const GameLayoutTuning({
    this.floorCardScale = 1.0,
    this.opponentCardScale = 1.0,
    this.opponentCardOverlap = 1.0,
  });

  final double floorCardScale;
  final double opponentCardScale;
  final double opponentCardOverlap;

  GameLayoutTuning copyWith({
    double? floorCardScale,
    double? opponentCardScale,
    double? opponentCardOverlap,
  }) {
    return GameLayoutTuning(
      floorCardScale: floorCardScale ?? this.floorCardScale,
      opponentCardScale: opponentCardScale ?? this.opponentCardScale,
      opponentCardOverlap: opponentCardOverlap ?? this.opponentCardOverlap,
    );
  }

  factory GameLayoutTuning.fromJson(Map<String, dynamic>? j) {
    if (j == null) return const GameLayoutTuning();
    double d(String k, double def) => (j[k] as num?)?.toDouble() ?? def;
    return GameLayoutTuning(
      floorCardScale: d('floor_card_scale', 1.0).clamp(0.4, 3.0),
      opponentCardScale: d('opponent_card_scale', 1.0).clamp(0.4, 2.5),
      opponentCardOverlap: d('opponent_card_overlap', 1.0).clamp(0.3, 3.0),
    );
  }

  Map<String, dynamic> toJson() => {
        'floor_card_scale': floorCardScale,
        'opponent_card_scale': opponentCardScale,
        'opponent_card_overlap': opponentCardOverlap,
      };
}

/// ضبط كامل للعرض (عام + يد).
class ResolvedGameLayout {
  const ResolvedGameLayout({
    required this.elements,
    required this.tuning,
    required this.handCardGap,
    required this.handCardScale,
  });

  final Map<String, GameLayoutBox> elements;
  final GameLayoutTuning tuning;
  final double handCardGap;
  final double handCardScale;
}

class GameLayoutBox {
  const GameLayoutBox({
    required this.x,
    required this.y,
    required this.w,
    required this.h,
    this.r = 0,
  });

  final double x;
  final double y;
  final double w;
  final double h;
  final double r;

  GameLayoutBox copyWith({double? x, double? y, double? w, double? h, double? r}) {
    return GameLayoutBox(
      x: x ?? this.x,
      y: y ?? this.y,
      w: w ?? this.w,
      h: h ?? this.h,
      r: r ?? this.r,
    );
  }

  factory GameLayoutBox.fromJson(Map<String, dynamic> j) {
    return GameLayoutBox(
      x: (j['x'] as num?)?.toDouble() ?? 0,
      y: (j['y'] as num?)?.toDouble() ?? 0,
      w: (j['w'] as num?)?.toDouble() ?? 0.2,
      h: (j['h'] as num?)?.toDouble() ?? 0.1,
      r: (j['r'] as num?)?.toDouble() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {'x': x, 'y': y, 'w': w, 'h': h, 'r': r};
}

class GameLayoutConfig {
  const GameLayoutConfig({
    required this.elements,
    this.version = 3,
    this.tuning = const GameLayoutTuning(),
    this.variants = const {},
  });

  final int version;
  final Map<String, GameLayoutBox> elements;
  final GameLayoutTuning tuning;
  final Map<String, HandVariant> variants;

  static String variantKeyForCount(int count) => HandVariant.variantKeyForCount(count);

  static const sharedIds = [
    'score_bar',
    'table_center',
    'floor_card',
    'btn_sawa',
    'btn_qaid',
    'side_utils',
    'back_btn',
    'seat_top_avatar',
    'seat_top_cards',
    'seat_top_gifts',
    'seat_top_name',
    'seat_left_avatar',
    'seat_left_cards',
    'seat_left_gifts',
    'seat_left_name',
    'seat_right_avatar',
    'seat_right_cards',
    'seat_right_gifts',
    'seat_right_name',
    'seat_bottom_avatar',
    'seat_bottom_gifts',
    'seat_bottom_name',
  ];

  static const ids = [
    ...sharedIds,
    ...HandVariant.handElementIds,
  ];

  static Map<String, HandVariant> defaultVariants() => {
        for (final key in HandVariant.variantKeys) key: HandVariant.defaultsFor(key),
      };

  static final defaults = GameLayoutConfig(
    tuning: GameLayoutTuning(
      floorCardScale: 1.48,
      opponentCardScale: 1.4,
      opponentCardOverlap: 2.52,
    ),
    elements: {
      'score_bar': GameLayoutBox(x: 0.202, y: 0, w: 0.6214, h: 0.0603),
      'table_center': GameLayoutBox(x: 0.294, y: 0.3078, w: 0.4095, h: 0.2308),
      'floor_card': GameLayoutBox(x: 0.321, y: 0.3171, w: 0.3595, h: 0.2139),
      'btn_sawa': GameLayoutBox(x: 0.8692, y: 0.5841, w: 0.1391, h: 0.056),
      'btn_qaid': GameLayoutBox(x: 0, y: 0.5871, w: 0.1394, h: 0.056),
      'side_utils': GameLayoutBox(x: 0.8782, y: 0, w: 0.1306, h: 0.1137),
      'back_btn': GameLayoutBox(x: 0, y: 0, w: 0.175, h: 0.0629),
      'seat_top_avatar': GameLayoutBox(x: 0.405, y: 0.0554, w: 0.2, h: 0.1),
      'seat_top_cards': GameLayoutBox(x: 0.2192, y: 0.0102, w: 0.5613, h: 0.115),
      'seat_top_gifts': GameLayoutBox(x: 0.3767, y: 0.1772, w: 0.28, h: 0.04),
      'seat_top_name': GameLayoutBox(x: 0.4002, y: 0.1274, w: 0.2149, h: 0.0577),
      'seat_left_avatar': GameLayoutBox(x: 0.0252, y: 0.3571, w: 0.16, h: 0.1),
      'seat_left_cards': GameLayoutBox(x: 0, y: 0.2838, w: 0.2076, h: 0.147),
      'seat_left_gifts': GameLayoutBox(x: 0.0225, y: 0.4396, w: 0.16, h: 0.04),
      'seat_left_name': GameLayoutBox(x: 0, y: 0.4727, w: 0.1976, h: 0.0553),
      'seat_right_avatar': GameLayoutBox(x: 0.8025, y: 0.338, w: 0.18, h: 0.1127),
      'seat_right_cards': GameLayoutBox(x: 0.7783, y: 0.2798, w: 0.2256, h: 0.1493),
      'seat_right_gifts': GameLayoutBox(x: 0.8125, y: 0.4442, w: 0.16, h: 0.04),
      'seat_right_name': GameLayoutBox(x: 0.795, y: 0.4808, w: 0.1999, h: 0.0541),
      'seat_bottom_avatar': GameLayoutBox(x: 0.4168, y: 0.7086, w: 0.1833, h: 0.0747),
      'seat_bottom_gifts': GameLayoutBox(x: 0.2378, y: 0.7248, w: 0.1825, h: 0.04),
      'seat_bottom_name': GameLayoutBox(x: 0.6024, y: 0.714, w: 0.2004, h: 0.0478),
    },
    variants: defaultVariants(),
  );

  HandVariant variantFor(String key) =>
      variants[key] ?? HandVariant.defaultsFor(key);

  ResolvedGameLayout resolve(int handCount) {
    final key = variantKeyForCount(handCount);
    final v = variantFor(key);
    final merged = Map<String, GameLayoutBox>.from(elements);
    for (final id in HandVariant.handElementIds) {
      final box = v.elements[id] ?? HandVariant.defaultsFor(key).elements[id];
      if (box != null) merged[id] = box;
    }
    return ResolvedGameLayout(
      elements: merged,
      tuning: tuning,
      handCardGap: v.handCardGap,
      handCardScale: v.handCardScale,
    );
  }

  factory GameLayoutConfig.fromJson(Map<String, dynamic> j) {
    final raw = j['elements'] as Map<String, dynamic>? ?? {};
    final elements = <String, GameLayoutBox>{};
    for (final id in sharedIds) {
      final v = raw[id];
      if (v is Map<String, dynamic>) {
        elements[id] = GameLayoutBox.fromJson(v);
      } else if (defaults.elements.containsKey(id)) {
        elements[id] = defaults.elements[id]!;
      }
    }

    final rawVariants = j['variants'] as Map<String, dynamic>? ?? {};
    final variants = <String, HandVariant>{};
    for (final key in HandVariant.variantKeys) {
      variants[key] = rawVariants[key] is Map<String, dynamic>
          ? HandVariant.fromJson(rawVariants[key] as Map<String, dynamic>)
          : HandVariant.defaultsFor(key);
      // ترحيل من النسخة القديمة: عناصر اليد في elements العامة
      if (rawVariants.isEmpty) {
        final legacy = <String, GameLayoutBox>{};
        for (final id in HandVariant.handElementIds) {
          final v = raw[id];
          if (v is Map<String, dynamic>) legacy[id] = GameLayoutBox.fromJson(v);
        }
        if (legacy.isNotEmpty) {
          variants[key] = variants[key]!.copyWith(elements: {
            ...variants[key]!.elements,
            ...legacy,
          });
        }
        final legacyTuning = j['tuning'] as Map<String, dynamic>?;
        if (legacyTuning != null) {
          variants[key] = variants[key]!.copyWith(
            handCardGap: (legacyTuning['hand_card_gap'] as num?)?.toDouble() ?? variants[key]!.handCardGap,
            handCardScale: (legacyTuning['hand_card_scale'] as num?)?.toDouble() ?? variants[key]!.handCardScale,
          );
        }
      }
    }

    return GameLayoutConfig(
      version: (j['version'] as num?)?.toInt() ?? 3,
      elements: elements,
      tuning: GameLayoutTuning.fromJson(j['tuning'] as Map<String, dynamic>?),
      variants: variants,
    );
  }

  Map<String, dynamic> toJson() => {
        'version': version,
        'elements': elements.map((k, v) => MapEntry(k, v.toJson())),
        'tuning': tuning.toJson(),
        'variants': variants.map((k, v) => MapEntry(k, v.toJson())),
      };

  GameLayoutConfig copyWith({
    Map<String, GameLayoutBox>? elements,
    GameLayoutTuning? tuning,
    Map<String, HandVariant>? variants,
  }) {
    return GameLayoutConfig(
      version: version,
      elements: elements ?? this.elements,
      tuning: tuning ?? this.tuning,
      variants: variants ?? this.variants,
    );
  }
}

class GameLayoutService {
  GameLayoutService(this._api);
  final ApiClient _api;

  Future<GameLayoutConfig> fetch() async {
    try {
      final res = await _api.get<Map<String, dynamic>>('/api/game-layout');
      final data = await _api.parseJson(res);
      final layout = data['layout'];
      if (layout is Map<String, dynamic>) {
        return GameLayoutConfig.fromJson(layout);
      }
    } catch (_) {}
    return GameLayoutConfig.defaults;
  }

  Future<GameLayoutConfig> save(GameLayoutConfig config) async {
    final res = await _api.put<Map<String, dynamic>>(
      '/api/admin/game-layout',
      body: {'layout': config.toJson()},
    );
    final data = await _api.parseJson(res);
    final layout = data['layout'];
    if (layout is Map<String, dynamic>) {
      return GameLayoutConfig.fromJson(layout);
    }
    return config;
  }

  Future<GameLayoutConfig> reset() async {
    final res = await _api.delete<Map<String, dynamic>>('/api/admin/game-layout');
    final data = await _api.parseJson(res);
    final layout = data['layout'];
    if (layout is Map<String, dynamic>) {
      return GameLayoutConfig.fromJson(layout);
    }
    return GameLayoutConfig.defaults;
  }
}
