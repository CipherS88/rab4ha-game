import 'dart:async';
import 'dart:collection';

import 'package:flutter/foundation.dart';

enum LogLevel { debug, info, warn, error }

class AppLogger {
  AppLogger._();
  static final instance = AppLogger._();

  final _queue = Queue<LogEntry>();
  bool _draining = false;
  final _buffer = List<LogEntry>.empty(growable: true);
  static const _maxBuffer = 100;

  void debug(String msg, [Object? detail]) => _log(LogLevel.debug, msg, detail);
  void info(String msg, [Object? detail]) => _log(LogLevel.info, msg, detail);
  void warn(String msg, [Object? detail]) => _log(LogLevel.warn, msg, detail);
  void error(String msg, [Object? detail, StackTrace? st]) =>
      _log(LogLevel.error, msg, detail, st);

  List<LogEntry> get recentEntries =>
      List.unmodifiable(_buffer.take(_maxBuffer));

  void _log(LogLevel level, String msg, [Object? detail, StackTrace? st]) {
    if (level == LogLevel.debug && !kDebugMode) return;
    _queue.add(LogEntry(DateTime.now(), level, msg, detail, st));
    unawaited(_drain());
  }

  Future<void> _drain() async {
    if (_draining) return;
    _draining = true;
    while (_queue.isNotEmpty) {
      final e = _queue.removeFirst();
      _buffer.add(e);
      if (_buffer.length > _maxBuffer) _buffer.removeAt(0);
      final line = '[${e.level.name.toUpperCase()}] ${e.message}'
          '${e.detail != null ? ' | ${e.detail}' : ''}';
      if (kDebugMode) {
        // ignore: avoid_print
        print(line);
        if (e.stack != null) print(e.stack);
      }
      await Future<void>.delayed(Duration.zero);
    }
    _draining = false;
  }
}

class LogEntry {
  LogEntry(this.time, this.level, this.message, this.detail, this.stack);
  final DateTime time;
  final LogLevel level;
  final String message;
  final Object? detail;
  final StackTrace? stack;
}
