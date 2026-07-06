import 'dart:async';

import 'package:rab4ha/core/network/socket_service.dart';

/// Socket وهمي يسجّل الإرسال ويسمح بدفع أحداث للاختبار.
class RecordingSocketService extends SocketService {
  RecordingSocketService() : super(onConnect: () {}, onDisconnect: () {});

  final emissions = <({String event, dynamic data})>[];
  final _controllers = <String, StreamController<dynamic>>{};

  @override
  Stream<T> on<T>(String event) {
    final c = _controllers.putIfAbsent(
      event,
      () => StreamController<dynamic>.broadcast(),
    );
    return c.stream.cast<T>();
  }

  @override
  void emit(String event, dynamic data, [void Function(dynamic)? ack]) {
    emissions.add((event: event, data: data));
    ack?.call(<String, dynamic>{});
  }

  @override
  void connect() {}

  void push(String event, dynamic data) {
    _controllers
        .putIfAbsent(event, () => StreamController<dynamic>.broadcast())
        .add(data);
  }

  void clear() => emissions.clear();

  Map<String, dynamic>? lastPayload(String event) {
    for (var i = emissions.length - 1; i >= 0; i--) {
      if (emissions[i].event == event) {
        return Map<String, dynamic>.from(emissions[i].data as Map);
      }
    }
    return null;
  }

  List<Map<String, dynamic>> allPayloads(String event) {
    return emissions
        .where((e) => e.event == event)
        .map((e) => Map<String, dynamic>.from(e.data as Map))
        .toList();
  }
}
