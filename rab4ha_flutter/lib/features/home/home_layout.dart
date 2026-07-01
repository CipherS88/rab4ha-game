import 'dart:math' as math;

import '../../core/network/api_client.dart';

class HomeLayoutBox {
  const HomeLayoutBox({
    required this.x,
    required this.y,
    required this.w,
    required this.h,
  });

  final double x;
  final double y;
  final double w;
  final double h;

  HomeLayoutBox copyWith({double? x, double? y, double? w, double? h}) {
    return HomeLayoutBox(
      x: x ?? this.x,
      y: y ?? this.y,
      w: w ?? this.w,
      h: h ?? this.h,
    );
  }

  factory HomeLayoutBox.fromJson(Map<String, dynamic> j) {
    return HomeLayoutBox(
      x: (j['x'] as num?)?.toDouble() ?? 0,
      y: (j['y'] as num?)?.toDouble() ?? 0,
      w: (j['w'] as num?)?.toDouble() ?? 0.2,
      h: (j['h'] as num?)?.toDouble() ?? 0.1,
    );
  }

  Map<String, dynamic> toJson() => {'x': x, 'y': y, 'w': w, 'h': h};
}

class HomeLayoutConfig {
  const HomeLayoutConfig({required this.elements, this.version = 1});

  final int version;
  final Map<String, HomeLayoutBox> elements;

  static const ids = [
    'settings',
    'stats',
    'avatar',
    'deck',
    'identity',
    'ranked',
    'friendly',
    'tournaments',
    'leaderboards',
    'sessions',
  ];

  static final defaults = HomeLayoutConfig(
    elements: {
      'settings': HomeLayoutBox(x: 0.02, y: 0.0, w: 0.12, h: 0.055),
      'identity': HomeLayoutBox(x: 0.04, y: 0.2, w: 0.28, h: 0.12),
      'avatar': HomeLayoutBox(x: 0.34, y: 0.22, w: 0.2, h: 0.13),
      'deck': HomeLayoutBox(x: 0.52, y: 0.28, w: 0.12, h: 0.11),
      'stats': HomeLayoutBox(x: 0.68, y: 0.2, w: 0.28, h: 0.12),
      'ranked': HomeLayoutBox(x: 0.04, y: 0.4, w: 0.92, h: 0.105),
      'tournaments': HomeLayoutBox(x: 0.04, y: 0.54, w: 0.211, h: 0.165),
      'leaderboards': HomeLayoutBox(x: 0.276, y: 0.54, w: 0.211, h: 0.165),
      'friendly': HomeLayoutBox(x: 0.512, y: 0.54, w: 0.211, h: 0.165),
      'sessions': HomeLayoutBox(x: 0.748, y: 0.54, w: 0.211, h: 0.165),
    },
  );

  factory HomeLayoutConfig.fromJson(Map<String, dynamic> j) {
    final raw = j['elements'] as Map<String, dynamic>? ?? {};
    final elements = <String, HomeLayoutBox>{};
    for (final id in ids) {
      final v = raw[id];
      if (v is Map<String, dynamic>) {
        elements[id] = HomeLayoutBox.fromJson(v);
      } else if (defaults.elements.containsKey(id)) {
        elements[id] = defaults.elements[id]!;
      }
    }
    if (raw.containsKey('avatar') && !raw.containsKey('deck') && elements.containsKey('avatar')) {
      final a = HomeLayoutBox.fromJson(raw['avatar'] as Map<String, dynamic>);
      elements['avatar'] = HomeLayoutBox(
        x: a.x + a.w * 0.12,
        y: a.y + a.h * 0.08,
        w: math.min(a.w * 0.52, 0.22),
        h: math.min(a.h * 0.72, 0.14),
      );
      elements['deck'] = HomeLayoutBox(
        x: a.x + a.w * 0.58,
        y: a.y + a.h * 0.22,
        w: math.min(a.w * 0.38, 0.14),
        h: math.min(a.h * 0.55, 0.11),
      );
    }
    return HomeLayoutConfig(
      version: (j['version'] as num?)?.toInt() ?? 1,
      elements: elements,
    );
  }

  Map<String, dynamic> toJson() => {
        'version': version,
        'elements': elements.map((k, v) => MapEntry(k, v.toJson())),
      };

  HomeLayoutConfig copyWith({Map<String, HomeLayoutBox>? elements}) {
    return HomeLayoutConfig(
      version: version,
      elements: elements ?? this.elements,
    );
  }
}

class HomeLayoutService {
  HomeLayoutService(this._api);
  final ApiClient _api;

  Future<HomeLayoutConfig> fetch() async {
    try {
      final res = await _api.get<Map<String, dynamic>>('/api/home-layout');
      final data = await _api.parseJson(res);
      final layout = data['layout'];
      if (layout is Map<String, dynamic>) {
        return HomeLayoutConfig.fromJson(layout);
      }
    } catch (_) {}
    return HomeLayoutConfig.defaults;
  }

  Future<HomeLayoutConfig> save(HomeLayoutConfig config) async {
    final res = await _api.put<Map<String, dynamic>>(
      '/api/admin/home-layout',
      body: {'layout': config.toJson()},
    );
    final data = await _api.parseJson(res);
    final layout = data['layout'];
    if (layout is Map<String, dynamic>) {
      return HomeLayoutConfig.fromJson(layout);
    }
    return config;
  }

  Future<HomeLayoutConfig> reset() async {
    final res = await _api.delete<Map<String, dynamic>>('/api/admin/home-layout');
    final data = await _api.parseJson(res);
    final layout = data['layout'];
    if (layout is Map<String, dynamic>) {
      return HomeLayoutConfig.fromJson(layout);
    }
    return HomeLayoutConfig.defaults;
  }
}
