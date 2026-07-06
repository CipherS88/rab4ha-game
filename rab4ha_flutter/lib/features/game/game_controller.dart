import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/config/app_config.dart';
import '../../core/logging/app_logger.dart';
import '../../core/network/api_client.dart';
import '../../core/network/socket_service.dart';
import '../auth/auth_provider.dart';
import '../../shared/widgets/buttons.dart';
import 'card_utils.dart';
import 'game_labels.dart';
import 'game_seats.dart';
import 'qaid_ui.dart';

class GameState {
  const GameState({
    this.mySeat,
    this.soloMode = false,
    this.matchMode = 'friendly',
    this.sessionId,
    this.gameState,
    this.room,
    this.chatBubbles = const {},
    this.preSelectedIndex,
    this.pendingProjects = const {'سرا': 0, 'خمسين': 0, 'مية': 0, 'أربعمية': 0},
    this.qaidStep = 1,
    this.qaidReason,
    this.qaidCards = const [],
    this.qaidModalOpen = false,
    this.qaidSubmitting = false,
    this.matchEnd,
    this.error,
    this.tableGiftSlots,
    this.lastTableGift,
    this.turnStartedAtMs,
    this.dealingVisible = false,
    this.trickCollect,
    this.trickThrowAtMs = const {},
    this.tableGiftFly,
    this.tableGiftToast,
    this.animatingThrowSeat,
    this.roomCloseSignal = 0,
    this.activeRoomId,
    this.isSpectator = false,
    this.ekkahToggle = false,
    this.ekkahToast,
  });

  final int? mySeat;
  final bool soloMode;
  final bool isSpectator;
  final String matchMode;
  final String? sessionId;
  final String? activeRoomId;
  final Map<String, dynamic>? gameState;
  final Map<String, dynamic>? room;
  final Map<int, String> chatBubbles;
  final int? preSelectedIndex;
  final Map<String, int> pendingProjects;
  final int qaidStep;
  final String? qaidReason;
  final List<Map<String, dynamic>> qaidCards;
  final bool qaidModalOpen;
  final bool qaidSubmitting;
  final Map<String, dynamic>? matchEnd;
  final String? error;
  final List<dynamic>? tableGiftSlots;
  final Map<String, dynamic>? lastTableGift;
  final int? turnStartedAtMs;
  final bool dealingVisible;
  final Map<String, dynamic>? trickCollect;
  final Map<String, dynamic>? tableGiftFly;
  final String? tableGiftToast;
  final int? animatingThrowSeat;
  final Map<int, int> trickThrowAtMs;
  final int roomCloseSignal;
  final bool ekkahToggle;
  final String? ekkahToast;

  Map<String, dynamic>? get gs => gameState;

  bool get canDeclareEkkah {
    if (isSpectator || gs == null) return false;
    if (gs!['phase'] != 'PLAYING') return false;
    if (gs!['qaid_session'] != null) return false;
    if (gs!['sawa_declaration'] != null) return false;
    if (gs!['bid']?['type'] != 'HAKAM') return false;
    if (!isMyTurnToAct()) return false;
    final trick = gs!['current_trick'] as List?;
    return trick == null || trick.isEmpty;
  }

  GameState copyWith({
    int? mySeat,
    bool? soloMode,
    String? matchMode,
    String? sessionId,
    Map<String, dynamic>? gameState,
    Map<String, dynamic>? room,
    Map<int, String>? chatBubbles,
    int? preSelectedIndex,
    Map<String, int>? pendingProjects,
    int? qaidStep,
    String? qaidReason,
    List<Map<String, dynamic>>? qaidCards,
    bool? qaidModalOpen,
    bool? qaidSubmitting,
    Map<String, dynamic>? matchEnd,
    String? error,
    List<dynamic>? tableGiftSlots,
    Map<String, dynamic>? lastTableGift,
    int? turnStartedAtMs,
    bool? dealingVisible,
    Map<String, dynamic>? trickCollect,
    Map<String, dynamic>? tableGiftFly,
    String? tableGiftToast,
    int? animatingThrowSeat,
    Map<int, int>? trickThrowAtMs,
    int? roomCloseSignal,
    String? activeRoomId,
    bool? isSpectator,
    bool? ekkahToggle,
    String? ekkahToast,
    bool clearTrickCollect = false,
    bool clearTableGiftFly = false,
    bool clearTableGiftToast = false,
    bool clearEkkahToast = false,
    bool clearEkkahToggle = false,
    bool clearAnimatingThrow = false,
    bool clearMatchEnd = false,
    bool clearPreSelect = false,
    bool clearQaidReason = false,
    bool clearTurnStartedAt = false,
  }) =>
      GameState(
        mySeat: mySeat ?? this.mySeat,
        soloMode: soloMode ?? this.soloMode,
        matchMode: matchMode ?? this.matchMode,
        sessionId: sessionId ?? this.sessionId,
        gameState: gameState ?? this.gameState,
        room: room ?? this.room,
        chatBubbles: chatBubbles ?? this.chatBubbles,
        preSelectedIndex:
            clearPreSelect ? null : (preSelectedIndex ?? this.preSelectedIndex),
        pendingProjects: pendingProjects ?? this.pendingProjects,
        qaidStep: qaidStep ?? this.qaidStep,
        qaidReason: clearQaidReason ? null : (qaidReason ?? this.qaidReason),
        qaidCards: qaidCards ?? this.qaidCards,
        qaidModalOpen: qaidModalOpen ?? this.qaidModalOpen,
        qaidSubmitting: qaidSubmitting ?? this.qaidSubmitting,
        matchEnd: clearMatchEnd ? null : (matchEnd ?? this.matchEnd),
        error: error,
        tableGiftSlots: tableGiftSlots ?? this.tableGiftSlots,
        lastTableGift: lastTableGift ?? this.lastTableGift,
        turnStartedAtMs:
            clearTurnStartedAt ? null : (turnStartedAtMs ?? this.turnStartedAtMs),
        dealingVisible: dealingVisible ?? this.dealingVisible,
        trickCollect: clearTrickCollect ? null : (trickCollect ?? this.trickCollect),
        tableGiftFly: clearTableGiftFly ? null : (tableGiftFly ?? this.tableGiftFly),
        tableGiftToast: clearTableGiftToast ? null : (tableGiftToast ?? this.tableGiftToast),
        animatingThrowSeat:
            clearAnimatingThrow ? null : (animatingThrowSeat ?? this.animatingThrowSeat),
        trickThrowAtMs: trickThrowAtMs ?? this.trickThrowAtMs,
        roomCloseSignal: roomCloseSignal ?? this.roomCloseSignal,
        activeRoomId: activeRoomId ?? this.activeRoomId,
        isSpectator: isSpectator ?? this.isSpectator,
        ekkahToggle: clearEkkahToggle ? false : (ekkahToggle ?? this.ekkahToggle),
        ekkahToast: clearEkkahToast ? null : (ekkahToast ?? this.ekkahToast),
      );

  int? get controlSeat {
    if (soloMode && gs?['turn'] is int && (gs!['turn'] as int) >= 0) {
      return gs!['turn'] as int;
    }
    return mySeat;
  }

  bool isMyTurnToAct() {
    if (gs == null) return false;
    if (soloMode) return (gs!['turn'] as int?) != null && (gs!['turn'] as int) >= 0;
    return gs!['turn'] == mySeat;
  }

  int myTeam() => getMyTeam(mySeat);
}

class GameController extends Notifier<GameState> {
  final _subs = <StreamSubscription>[];
  int? _myTurnStartedAt;
  int? _lastControlSeat;
  int? _lastTurnSeat;

  @override
  GameState build() {
    ref.onDispose(_disposeSubs);
    _wireSocket();
    return const GameState();
  }

  SocketService get _socket => ref.read(socketServiceProvider);

  void _disposeSubs() {
    for (final s in _subs) {
      s.cancel();
    }
    _subs.clear();
  }

  void _wireSocket() {
    _disposeSubs();
    void listen<T>(String ev, void Function(T) fn) {
      _subs.add(_socket.on<T>(ev).listen(fn));
    }

    listen('room_update', (d) => _onRoomUpdate(Map<String, dynamic>.from(d as Map)));
    listen('room_abandoned', (_) => _onRoomAbandoned());
    listen('game_start', (d) => _onGameStart(Map<String, dynamic>.from(d as Map)));
    listen('game_state', (d) => _onGameState(Map<String, dynamic>.from(d as Map)));
    listen('solo_game_state', (d) => _onSoloGameState(Map<String, dynamic>.from(d as Map)));
    listen('game_public', (d) => _onGamePublic(Map<String, dynamic>.from(d as Map)));
    listen('card_thrown', (d) => _onCardThrown(Map<String, dynamic>.from(d as Map)));
    listen('trick_resolved', (d) => _onTrickResolved(Map<String, dynamic>.from(d as Map)));
    listen('chat', (d) => _onChat(Map<String, dynamic>.from(d as Map)));
    listen('qaid_started', (d) {
      final data = Map<String, dynamic>.from(d as Map);
      final seat = data['seat'] as int?;
      if (seat != null && state.gs != null) {
        final gs = Map<String, dynamic>.from(state.gs!);
        gs['qaid_session'] = {
          'seat': seat,
          'reason': (gs['qaid_session'] as Map?)?['reason'],
          'cards': (gs['qaid_session'] as Map?)?['cards'] ?? [],
        };
        state = state.copyWith(gameState: gs);
      }
      _syncQaid();
    });
    listen('qaid_ended', (_) {
      state = state.copyWith(
        qaidModalOpen: false,
        qaidSubmitting: false,
        qaidStep: 1,
        clearQaidReason: true,
        qaidCards: const [],
      );
    });
    listen('sawa_declared', (_) => _rerender());
    listen('match_over', (d) {
      unawaited(_onMatchOver(Map<String, dynamic>.from(d as Map)));
    });
    listen('match_forfeit', (d) => _onMatchForfeit(Map<String, dynamic>.from(d as Map)));
    listen('player_left', (_) {});
    listen('new_round', (_) {
      _resetRoundVisuals();
      _showDealingBriefly();
    });
    listen('table_gift', (d) => _onTableGift(Map<String, dynamic>.from(d as Map)));
    listen('ekkah_declared', (d) => _onEkkahDeclared(Map<String, dynamic>.from(d as Map)));
    listen('emergency_play', (_) {});
  }

  void _showDealingBriefly() {
    state = state.copyWith(dealingVisible: true);
    Future.delayed(const Duration(milliseconds: 1500), () {
      if (state.dealingVisible) state = state.copyWith(dealingVisible: false);
    });
  }

  void _markTrickThrow(int seat) {
    final now = DateTime.now().millisecondsSinceEpoch;
    final next = Map<int, int>.from(state.trickThrowAtMs)..[seat] = now;
    state = state.copyWith(trickThrowAtMs: next, animatingThrowSeat: seat);
    Future.delayed(const Duration(milliseconds: 420), () {
      final m = Map<int, int>.from(state.trickThrowAtMs)..remove(seat);
      state = state.copyWith(
        trickThrowAtMs: m,
        clearAnimatingThrow: state.animatingThrowSeat == seat,
      );
    });
  }

  void _onCardThrown(Map<String, dynamic> d) {
    final seat = d['player'] as int?;
    if (seat == null) return;
    _markTrickThrow(seat);
  }

  void _onTrickResolved(Map<String, dynamic> d) {
    if (state.isSpectator && d['cards'] is List) {
      d = {
        ...d,
        'cards': (d['cards'] as List).map((e) {
          final item = Map<String, dynamic>.from(e as Map);
          if (item['card'] is Map) {
            item['card'] = {...Map<String, dynamic>.from(item['card'] as Map), 'hidden': true};
          }
          return item;
        }).toList(),
      };
    }
    state = state.copyWith(trickCollect: d, trickThrowAtMs: {});
    Future.delayed(const Duration(milliseconds: 440), () {
      state = state.copyWith(clearTrickCollect: true);
    });
  }

  static Alignment _seatAlign(String pos) => switch (pos) {
        'top' => Alignment.topCenter,
        'bottom' => Alignment.bottomCenter,
        'left' => Alignment.centerLeft,
        'right' => Alignment.centerRight,
        _ => Alignment.center,
      };

  void _animateTableGift(Map<String, dynamic> d) {
    final from = d['fromSeat'] as int?;
    final emoji = d['emoji']?.toString() ?? '🎁';
    final mySeat = state.mySeat ?? 0;
    final deliveries = d['deliveries'] as List? ?? [];
    if (from == null || deliveries.isEmpty) return;
    final fromPos = getVisualPos(from, mySeat);
    var i = 0;
    void next() {
      if (i >= deliveries.length) return;
      final del = Map<String, dynamic>.from(deliveries[i] as Map);
      final to = del['toSeat'] as int?;
      if (to == null) {
        i++;
        next();
        return;
      }
      state = state.copyWith(
        tableGiftFly: {
          'emoji': emoji,
          'fromAlign': _seatAlign(fromPos),
          'toAlign': _seatAlign(getVisualPos(to, mySeat)),
          'at': DateTime.now().millisecondsSinceEpoch,
        },
      );
      i++;
      Future.delayed(const Duration(milliseconds: 700), next);
    }
    next();
    final fromName = (state.gs?['seats'] as List?)?[from] is Map
        ? ((state.gs!['seats'] as List)[from] as Map)['name']?.toString()
        : null;
    state = state.copyWith(
      tableGiftToast: '${fromName ?? 'لاعب'} أرسل $emoji',
    );
    Future.delayed(const Duration(seconds: 3), () {
      state = state.copyWith(clearTableGiftToast: true);
    });
  }

  void onSocketConnect() {
    // إعادة الانضمام عبر dialog في HomeScreen — لا join تلقائي
  }

  Future<void> _saveActiveGame(Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    final prev = prefs.getString(AppConfig.activeGameKey);
    Map<String, dynamic> merged = {};
    if (prev != null) {
      try {
        merged = Map<String, dynamic>.from(jsonDecode(prev) as Map);
      } catch (_) {}
    }
    merged.addAll(data);
    await prefs.setString(AppConfig.activeGameKey, jsonEncode(merged));
  }

  Future<void> clearActiveGame() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(AppConfig.activeGameKey);
  }

  void _resetRoundVisuals() {
    state = state.copyWith(
      pendingProjects: const {'سرا': 0, 'خمسين': 0, 'مية': 0, 'أربعمية': 0},
      clearPreSelect: true,
    );
  }

  void _emit(String event, Map<String, dynamic> data,
      [void Function(dynamic)? ack]) {
    final payload = state.soloMode
        ? {...data, 'actAs': state.controlSeat}
        : data;
    _socket.emit(event, payload, ack);
  }

  Future<Map<String, dynamic>?> joinRoom({
    required String roomId,
    required String name,
    int? seat,
    bool solo = false,
    String mode = 'friendly',
    String? sessionId,
  }) async {
    final userId = ref.read(authProvider).user?.id;
    final completer = Completer<Map<String, dynamic>?>();
    _emit('join', {
      'roomId': roomId,
      'name': name,
      'seat': seat,
      'solo': solo,
      'userId': userId,
    }, (res) {
      final map = res is Map ? Map<String, dynamic>.from(res) : null;
      if (map?['error'] != null) {
        state = state.copyWith(error: map!['error'].toString());
        completer.complete(map);
        return;
      }
      state = state.copyWith(
        soloMode: solo,
        matchMode: mode,
        sessionId: sessionId,
        activeRoomId: map?['roomId']?.toString() ?? roomId,
        mySeat: map?['seat'] as int? ?? seat,
        room: map?['room'] is Map
            ? Map<String, dynamic>.from(map!['room'] as Map)
            : null,
        error: null,
      );
      if (map?['room']?['status'] == 'playing') {
        unawaited(_saveActiveGame({
          'inGame': true,
          'roomId': map?['roomId']?.toString() ?? roomId,
          'name': name,
          'solo': solo,
          'mode': mode,
          'sessionId': sessionId,
        }));
      } else {
        unawaited(_saveActiveGame({
          'inGame': false,
          'roomId': map?['roomId']?.toString() ?? roomId,
          'name': name,
          'solo': solo,
          'mode': mode,
          'sessionId': sessionId,
        }));
      }
      completer.complete(map);
    });
    return completer.future;
  }

  /// الدخول كمشاهد لجلسة جارية — لا يشغل مقعداً ولا يرى وجوه الكروت.
  Future<Map<String, dynamic>?> spectateRoom({
    required String roomId,
    required String name,
    String? sessionId,
  }) async {
    final userId = ref.read(authProvider).user?.id;
    final completer = Completer<Map<String, dynamic>?>();
    _emit('join', {
      'roomId': roomId,
      'name': name,
      'userId': userId,
      'spectate': true,
    }, (res) {
      final map = res is Map ? Map<String, dynamic>.from(res) : null;
      if (map?['error'] != null) {
        state = state.copyWith(error: map!['error'].toString());
        completer.complete(map);
        return;
      }
      state = state.copyWith(
        isSpectator: true,
        soloMode: false,
        matchMode: 'session',
        sessionId: sessionId,
        activeRoomId: map?['roomId']?.toString() ?? roomId,
        mySeat: 0,
        room: map?['room'] is Map
            ? Map<String, dynamic>.from(map!['room'] as Map)
            : null,
        error: null,
      );
      completer.complete(map);
    });
    return completer.future;
  }

  /// إخفاء وجوه كل الكروت للمشاهد — يرى الخلفيات فقط.
  Map<String, dynamic> _maskCardsForSpectator(Map<String, dynamic> pub) {
    Map<String, dynamic> hide(Map src) =>
        {...Map<String, dynamic>.from(src), 'hidden': true};

    final masked = Map<String, dynamic>.from(pub);
    masked['my_hand'] = const [];
    masked['my_hand_count'] = 0;
    masked['legal_cards'] = const [];

    if (masked['floor_card'] is Map) {
      masked['floor_card'] = hide(masked['floor_card'] as Map);
    }
    if (masked['current_trick'] is List) {
      masked['current_trick'] = (masked['current_trick'] as List).map((e) {
        final item = Map<String, dynamic>.from(e as Map);
        if (item['card'] is Map) item['card'] = hide(item['card'] as Map);
        return item;
      }).toList();
    }
    // إخفاء أي كشف كامل للأيدي (سوا / قيد) عن المشاهد
    masked['sawa_hands'] = null;
    masked['all_hands'] = const [];
    return masked;
  }

  void fillBots() {
    _emit('fill_bots', {}, (res) {
      if (res is Map && res['error'] != null) {
        state = state.copyWith(error: res['error'].toString());
        ref.read(homeToastProvider.notifier).show(res['error'].toString());
      }
    });
  }

  Future<void> leaveGame() async {
    final completer = Completer<void>();
    _emit('leave_game', {}, (_) {
      completer.complete();
    });
    await completer.future.timeout(const Duration(seconds: 2), onTimeout: () {});
    await clearActiveGame();
    state = const GameState();
  }

  void _onRoomUpdate(Map<String, dynamic> room) {
    state = state.copyWith(
      room: room,
      gameState: state.gs == null
          ? null
          : {
              ...?state.gs,
              'session_bg_url': room['sessionBgUrl']?.toString() ?? defaultSessionBgUrl,
            },
    );
  }

  void _onRoomAbandoned() {
    unawaited(clearActiveGame());
    state = GameState(roomCloseSignal: state.roomCloseSignal + 1);
    ref.read(homeToastProvider.notifier).show('انتهت الغرفة');
  }

  void _onGameStart(Map<String, dynamic> data) {
    if (data['gameMode'] != null) {
      final gm = data['gameMode'].toString();
      state = state.copyWith(
        matchMode: gm == 'session' ? 'session' : gm,
      );
    }
    unawaited(_saveActiveGame({'inGame': true}));
    state = state.copyWith(
      gameState: state.gs ?? {'phase': 'INIT', 'my_hand': [], 'total_scores': {}},
    );
    _resetRoundVisuals();
    _showDealingBriefly();
  }

  void mergeSoloGameState(List<dynamic> states, int viewSeat) {
    final list = states.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    if (list.isEmpty) return;
    final turn = list[0]['turn'] as int? ?? -1;
    final activeSeat = turn >= 0 ? turn : viewSeat;
    final safeView = viewSeat.clamp(0, list.length - 1);
    final safeActive = activeSeat.clamp(0, list.length - 1);
    final base = list[safeView];
    final active = list[safeActive];
    if (state.soloMode &&
        _lastControlSeat != null &&
        _lastControlSeat != activeSeat) {
      _resetRoundVisuals();
    }
    _lastControlSeat = activeSeat;
    final merged = {
      ...base,
      'my_hand': active['my_hand'],
      'my_hand_count': active['my_hand_count'],
      'available_bids': active['available_bids'],
      'legal_cards': active['legal_cards'],
      'project_details': active['project_details'],
      'can_sawa': active['can_sawa'],
      'soloStates': list,
      'soloMode': true,
      'controlSeat': activeSeat,
    };
    state = state.copyWith(gameState: merged, mySeat: viewSeat);
  }

  List<dynamic> _normalizeSoloStates(dynamic raw) {
    if (raw is List) return raw;
    if (raw is Map) {
      return List.generate(4, (i) => raw['$i'] ?? raw[i] ?? const {});
    }
    return const [];
  }

  void _onSoloGameState(Map<String, dynamic> data) {
    final viewSeat = data['viewSeat'] as int? ?? 3;
    mergeSoloGameState(_normalizeSoloStates(data['states']), viewSeat);
    _handlePreSelectAutoPlay();
  }

  void _onGameState(Map<String, dynamic> data) {
    final seat = data['seat'] as int?;
    final gs = Map<String, dynamic>.from(data['state'] as Map);
    if (seat != state.mySeat) return;
    final wasMyTurn = state.gs?['phase'] == 'PLAYING' && state.gs?['turn'] == state.mySeat;
    if (gs['phase'] == 'PLAYING' && gs['turn'] == state.mySeat && !wasMyTurn) {
      _myTurnStartedAt = DateTime.now().millisecondsSinceEpoch;
      state = state.copyWith(turnStartedAtMs: _myTurnStartedAt);
    }
    state = state.copyWith(gameState: gs);
    _syncQaid();
    _handlePreSelectAutoPlay();
  }

  void _onGamePublic(Map<String, dynamic> rawPub) {
    final pub = state.isSpectator ? _maskCardsForSpectator(rawPub) : rawPub;
    final prevTrick = (state.gs?['current_trick'] as List?) ?? [];
    if (state.soloMode && state.gs?['soloStates'] != null) {
      final list = (state.gs!['soloStates'] as List)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
      for (var i = 0; i < 4; i++) {
        final priv = {
          'my_hand': list[i]['my_hand'],
          'my_hand_count': list[i]['my_hand_count'],
          'available_bids': list[i]['available_bids'],
          'legal_cards': list[i]['legal_cards'],
          'project_details': list[i]['project_details'],
          'can_ashkal': list[i]['can_ashkal'],
          'can_sawa': list[i]['can_sawa'],
        };
        list[i] = {...list[i], ...pub, ...priv};
      }
      mergeSoloGameState(list, state.mySeat ?? 3);
    } else if (state.gs == null) {
      state = state.copyWith(gameState: {...pub, 'my_seat': state.mySeat});
    } else {
      state = state.copyWith(gameState: {...state.gs!, ...pub});
    }
    if (pub['table_gift_slots'] != null) {
      state = state.copyWith(tableGiftSlots: pub['table_gift_slots'] as List?);
    }
    final trick = (state.gs?['current_trick'] as List?) ?? [];
    if (trick.length > prevTrick.length) {
      final last = Map<String, dynamic>.from(trick.last as Map);
      final player = last['player'] as int?;
      if (player != null && !state.trickThrowAtMs.containsKey(player)) {
        _markTrickThrow(player);
      }
    }
    _syncQaid();
    if (pub['phase'] == 'SCORE_SUMMARY') {
      state = state.copyWith(qaidModalOpen: false);
    }
    _syncTurnTimer(pub);
  }

  void _syncTurnTimer(Map<String, dynamic> pub) {
    if (pub['qaid_session'] != null) return;
    final turn = pub['turn'] as int?;
    final phase = pub['phase']?.toString();
    if (phase == 'PLAYING' && turn != null && turn != _lastTurnSeat) {
      _lastTurnSeat = turn;
      final now = DateTime.now().millisecondsSinceEpoch;
      _myTurnStartedAt = now;
      state = state.copyWith(turnStartedAtMs: now);
    }
  }

  void _onChat(Map<String, dynamic> d) {
    final seat = d['seat'] as int?;
    final text = d['text']?.toString();
    if (seat == null || text == null) return;
    final bubbles = Map<int, String>.from(state.chatBubbles);
    bubbles[seat] = text;
    state = state.copyWith(chatBubbles: bubbles);
    Future.delayed(const Duration(seconds: 3), () {
      if (state.chatBubbles[seat] == text) {
        final b = Map<int, String>.from(state.chatBubbles)..remove(seat);
        state = state.copyWith(chatBubbles: b);
      }
    });
  }

  void _onTableGift(Map<String, dynamic> d) {
    state = state.copyWith(
      lastTableGift: d,
      tableGiftSlots: d['table_gift_slots'] as List? ?? state.tableGiftSlots,
    );
    _animateTableGift(d);
    if (d['senderCoins'] != null) {
      ref.read(profileProvider.notifier).fetch();
    }
  }

  Future<void> _onMatchOver(Map<String, dynamic> payload) async {
    if (state.matchMode == 'ranked') {
      final userId = ref.read(authProvider).user?.id;
      final seat = state.mySeat;
      if (userId != null && seat != null) {
        final us = getMyTeam(seat);
        final won = payload['winner'] == us;
        try {
          final api = ref.read(apiClientProvider);
          final res = await api.post(
            '/api/profile/user_$userId/match-result',
            body: {'won': won, 'mode': 'ranked'},
          );
          final data = await api.parseJson(res);
          payload = {...payload, 'rankResult': data};
          if (data['rankedUp'] == true) {
            payload['rankedUp'] = true;
          }
          await ref.read(profileProvider.notifier).fetch();
        } catch (e) {
          AppLogger.instance.warn('match-result failed', e);
        }
      }
    }
    state = state.copyWith(matchEnd: payload, qaidModalOpen: false);
    clearActiveGame();
  }

  void _onMatchForfeit(Map<String, dynamic> d) {
    state = state.copyWith(error: 'غادر لاعب — ${d['penalty'] ?? ''}');
  }

  void _rerender() => state = state.copyWith(gameState: state.gs);

  void bid(Map<String, dynamic> bid, {String? suit, bool? locked}) {
    _emit('bid', {
      'action': bid['action'],
      if (suit != null) 'suit': suit,
      if (locked != null) 'locked': locked,
    }, (res) {
      if (res is Map && res['error'] != null) {
        state = state.copyWith(error: res['error'].toString());
      }
    });
  }

  void _onEkkahDeclared(Map<String, dynamic> data) {
    final name = data['name']?.toString() ?? 'لاعب';
    state = state.copyWith(ekkahToast: 'إكة من اللاعب $name');
    Future.delayed(const Duration(seconds: 3), () {
      if (state.ekkahToast == 'إكة من اللاعب $name') {
        state = state.copyWith(clearEkkahToast: true);
      }
    });
  }

  void toggleEkkah() {
    if (!state.canDeclareEkkah) return;
    state = state.copyWith(ekkahToggle: !state.ekkahToggle);
  }

  void playCard(int idx) {
    if (state.gs?['qaid_session'] != null) return;
    final playMs = _myTurnStartedAt != null
        ? DateTime.now().millisecondsSinceEpoch - _myTurnStartedAt!
        : null;
    _myTurnStartedAt = null;
    final seat = state.controlSeat ?? state.mySeat;
    if (seat != null) _markTrickThrow(seat);
    final declareEkkah = state.ekkahToggle;
    _emit('play_card', {
      'cardIndex': idx,
      'projects': state.pendingProjects,
      'playMs': playMs,
      if (declareEkkah) 'is_ekkah_declared': true,
    }, (res) {
      if (res is Map && res['error'] != null) {
        state = state.copyWith(error: res['error'].toString());
      }
    });
    state = state.copyWith(clearPreSelect: true, clearEkkahToggle: true);
  }

  void onCardTap(int serverIdx, Map<String, dynamic> card) {
    if (state.gs?['qaid_session'] != null) return;
    if (state.gs?['phase'] != 'PLAYING') return;
    if (!state.isMyTurnToAct()) {
      if (state.preSelectedIndex == serverIdx) {
        state = state.copyWith(clearPreSelect: true);
      } else {
        state = state.copyWith(preSelectedIndex: serverIdx);
      }
      return;
    }
    playCard(serverIdx);
  }

  void _handlePreSelectAutoPlay() {
    if (state.gs?['qaid_session'] != null) return;
    if (!state.isMyTurnToAct() || state.gs?['phase'] != 'PLAYING') return;
    final idx = state.preSelectedIndex;
    if (idx == null) return;
    final hand = (state.gs?['my_hand'] as List?) ?? [];
    if (idx >= 0 && idx < hand.length) playCard(idx);
  }

  void cycleProject(String name) {
    final max = projectMax[name] ?? 2;
    final cur = Map<String, int>.from(state.pendingProjects);
    cur[name] = ((cur[name] ?? 0) + 1) % (max + 1);
    state = state.copyWith(pendingProjects: cur);
  }

  void sendQuickChat(String text) => _emit('chat', {'text': text});

  void sendTableGift(String giftId, dynamic target) {
    _emit('table_gift', {'giftId': giftId, 'target': target}, (res) {
      if (res is Map && res['error'] != null) {
        state = state.copyWith(error: res['error'].toString());
      } else if (res is Map && res['senderCoins'] != null) {
        ref.read(profileProvider.notifier).fetch();
      }
    });
  }

  void qaidStart() {
    _emit('qaid_start', {}, (res) {
      if (res is Map && res['error'] != null) {
        state = state.copyWith(error: res['error'].toString());
      } else {
        state = state.copyWith(qaidModalOpen: true, qaidStep: 1);
      }
    });
  }

  void qaidUpdate({String? reason, List<Map<String, dynamic>>? cards}) {
    final reasonChanged = reason != null && reason != state.qaidReason;
    final nextReason = reason ?? state.qaidReason;
    final List<Map<String, dynamic>> nextCards = reasonChanged
        ? const <Map<String, dynamic>>[]
        : (cards ?? state.qaidCards);
    _emit('qaid_update', {
      if (reason != null) 'reason': qaidReasonForWire(reason),
      if (cards != null || reasonChanged) 'cards': nextCards,
    });
    state = state.copyWith(
      qaidReason: nextReason,
      qaidCards: nextCards,
      qaidStep: reasonChanged ? 1 : state.qaidStep,
    );
  }

  void qaidSubmit() {
    if (state.qaidSubmitting) return;
    if (!canSubmitQaid(
      reason: state.qaidReason,
      cards: state.qaidCards,
      submitting: false,
    )) {
      return;
    }
    state = state.copyWith(qaidSubmitting: true, qaidModalOpen: false);
    _emit('qaid_submit', {
      'reason': qaidReasonForWire(state.qaidReason),
      'cards': state.qaidCards,
    }, (res) {
      if (res is Map && res['error'] != null) {
        state = state.copyWith(
          qaidSubmitting: false,
          qaidModalOpen: true,
          error: res['error'].toString(),
        );
      } else {
        state = state.copyWith(qaidSubmitting: false);
      }
    });
  }

  void qaidCancel() {
    _emit('qaid_cancel', {});
    state = state.copyWith(qaidModalOpen: false, qaidSubmitting: false);
  }

  void sawa() => _emit('sawa', {});

  void _syncQaid() {
    final session = state.gs?['qaid_session'] as Map<String, dynamic>?;
    if (session == null) {
      if (state.qaidModalOpen) {
        state = state.copyWith(qaidModalOpen: false);
      }
      return;
    }

    final objector = isQaidObjector();
    final localReason = state.qaidReason;
    final localStep = state.qaidStep;
    final sessionReason = session['reason']?.toString();
    final reason = (sessionReason != null && sessionReason.isNotEmpty)
        ? (objector ? (localReason ?? qaidReasonFromWire(sessionReason)) : qaidReasonFromWire(sessionReason))
        : (objector ? localReason : null);

    List<Map<String, dynamic>> cards;
    final sessionCards = session['cards'] as List?;
    if (sessionCards != null && sessionCards.isNotEmpty) {
      cards = sessionCards.map((c) => Map<String, dynamic>.from(c as Map)).toList();
    } else if (objector) {
      cards = state.qaidCards;
    } else {
      cards = const [];
    }

    var step = inferQaidStepFromSession(session, objector, localStep, reason);
    if (objector && (sessionReason == null || sessionReason.isEmpty)) {
      step = localStep;
    }

    state = state.copyWith(
      qaidModalOpen: true,
      qaidReason: reason,
      qaidCards: cards,
      qaidStep: step,
      clearTurnStartedAt: true,
    );
  }

  void setQaidStep(int step) => state = state.copyWith(qaidStep: step);

  bool isQaidObjector() {
    final seat = state.gs?['qaid_session']?['seat'];
    if (seat == null) return false;
    if (state.soloMode) return seat == state.controlSeat;
    return seat == state.mySeat;
  }

  void applyGameState(Map<String, dynamic> gs) =>
      state = state.copyWith(gameState: gs);
}

final gameControllerProvider =
    NotifierProvider<GameController, GameState>(GameController.new);

final matchmakingProvider = NotifierProvider<MatchmakingNotifier, MatchmakingState>(
    MatchmakingNotifier.new);

class MatchmakingState {
  const MatchmakingState({
    this.mode = 'friendly',
    this.solo = false,
    this.loading = false,
    this.error,
  });
  final String mode;
  final bool solo;
  final bool loading;
  final String? error;
}

class MatchmakingNotifier extends Notifier<MatchmakingState> {
  @override
  MatchmakingState build() => const MatchmakingState();

  Future<bool> start({required bool solo, required String mode, required String name}) async {
    state = MatchmakingState(mode: mode, solo: solo, loading: true);
    final roomId = switch (mode) {
      'ranked' => 'ranked',
      'match52' => 'match52',
      _ => 'friendly',
    };
    final res = await ref.read(gameControllerProvider.notifier).joinRoom(
          roomId: roomId,
          name: name,
          solo: solo,
          mode: mode,
        );
    state = MatchmakingState(mode: mode, solo: solo, loading: false, error: res?['error']?.toString());
    return res?['error'] == null;
  }
}
