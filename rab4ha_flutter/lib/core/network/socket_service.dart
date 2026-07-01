import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../config/app_config.dart';
import '../logging/app_logger.dart';

class SocketService {
  SocketService({required this.onConnect, required this.onDisconnect});

  io.Socket? _socket;
  final void Function() onConnect;
  final void Function() onDisconnect;
  final _eventControllers = <String, StreamController<dynamic>>{};

  bool get connected => _socket?.connected ?? false;

  void connect() {
    if (_socket?.connected == true) return;
    final uri = AppConfig.baseUrl;
    AppLogger.instance.info('Socket connecting', uri);
    _socket = io.io(
      uri,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(10)
          .build(),
    );
    _socket!
      ..onConnect((_) {
        AppLogger.instance.info('Socket connected');
        onConnect();
      })
      ..onDisconnect((_) {
        AppLogger.instance.warn('Socket disconnected');
        onDisconnect();
      })
      ..onConnectError((e) => AppLogger.instance.error('Socket connect error', e))
      ..onError((e) => AppLogger.instance.error('Socket error', e));
    _wireKnownEvents();
    _socket!.connect();
  }

  void _wireKnownEvents() {
    const events = [
      'room_update', 'room_abandoned', 'game_start', 'game_state',
      'solo_game_state', 'game_public', 'card_thrown', 'trick_resolved',
      'chat', 'qaid_started', 'qaid_ended', 'sawa_declared', 'match_over',
      'match_forfeit', 'player_left', 'new_round', 'table_gift',
      'emergency_play', 'chat:message', 'gift:received',
    ];
    for (final e in events) {
      _socket!.off(e);
      _socket!.on(e, (data) => _emit(e, data));
    }
  }

  Stream<T> on<T>(String event) {
    final c = _eventControllers.putIfAbsent(
      event,
      () => StreamController<dynamic>.broadcast(),
    );
    return c.stream.cast<T>();
  }

  void _emit(String event, dynamic data) {
    AppLogger.instance.debug('Socket <= $event', data);
    _eventControllers[event]?.add(data);
  }

  void emit(String event, dynamic data, [void Function(dynamic)? ack]) {
    AppLogger.instance.debug('Socket => $event', data);
    if (ack != null) {
      _socket?.emitWithAck(event, data, ack: ack);
    } else {
      _socket?.emit(event, data);
    }
  }

  void emitChatAuth(String token, [void Function(dynamic)? ack]) =>
      emit('chat:auth', {'token': token}, ack);

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  void dispose() {
    disconnect();
    for (final c in _eventControllers.values) {
      c.close();
    }
    _eventControllers.clear();
  }
}

final socketServiceProvider = Provider<SocketService>((ref) {
  throw UnimplementedError('socketServiceProvider must be overridden');
});
