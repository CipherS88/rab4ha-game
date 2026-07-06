import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// إعدادات الأداء والصوت — محفوظة محلياً عبر SharedPreferences.
class GameSettings {
  const GameSettings({
    this.fpsTarget = 120,
    this.lowEndMode = false,
    this.sfxVolume = 0.8,
    this.voiceVolume = 0.8,
  });

  /// معدل الإطارات المستهدف: 30 / 60 / 120.
  final int fpsTarget;

  /// وضع الأجهزة الضعيفة — يوقف الأنميشن الثقيل.
  final bool lowEndMode;

  /// مستوى صوت المؤثرات (رمي الكروت، التوزيع) 0..1.
  final double sfxVolume;

  /// مستوى صوت الشات الصوتي/التفاعلي 0..1.
  final double voiceVolume;

  /// هل تُعرض الأنميشن الكامل؟ (يُعطّل في وضع الأجهزة الضعيفة).
  bool get animationsEnabled => !lowEndMode;

  /// الحد الأدنى للفاصل الزمني بين إطارات الأنميشن المخصص (بالميلي ثانية).
  int get frameIntervalMs => fpsTarget > 0 ? (1000 / fpsTarget).floor() : 8;

  GameSettings copyWith({
    int? fpsTarget,
    bool? lowEndMode,
    double? sfxVolume,
    double? voiceVolume,
  }) =>
      GameSettings(
        fpsTarget: fpsTarget ?? this.fpsTarget,
        lowEndMode: lowEndMode ?? this.lowEndMode,
        sfxVolume: sfxVolume ?? this.sfxVolume,
        voiceVolume: voiceVolume ?? this.voiceVolume,
      );
}

class _Keys {
  static const fps = 'rab4ha_fps_target';
  static const lowEnd = 'rab4ha_low_end_mode';
  static const sfx = 'rab4ha_sfx_volume';
  static const voice = 'rab4ha_voice_volume';
}

const kFpsOptions = [30, 60, 120];

final settingsProvider =
    NotifierProvider<SettingsNotifier, GameSettings>(SettingsNotifier.new);

class SettingsNotifier extends Notifier<GameSettings> {
  @override
  GameSettings build() {
    // نبدأ بالافتراضيات ثم نحمّل القيم المحفوظة بشكل غير متزامن.
    _load();
    return const GameSettings();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final fps = prefs.getInt(_Keys.fps);
    state = GameSettings(
      fpsTarget: kFpsOptions.contains(fps) ? fps! : 120,
      lowEndMode: prefs.getBool(_Keys.lowEnd) ?? false,
      sfxVolume: prefs.getDouble(_Keys.sfx) ?? 0.8,
      voiceVolume: prefs.getDouble(_Keys.voice) ?? 0.8,
    );
  }

  Future<void> setFpsTarget(int value) async {
    if (!kFpsOptions.contains(value)) return;
    state = state.copyWith(fpsTarget: value);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_Keys.fps, value);
  }

  Future<void> setLowEndMode(bool value) async {
    state = state.copyWith(lowEndMode: value);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_Keys.lowEnd, value);
  }

  Future<void> setSfxVolume(double value) async {
    final v = value.clamp(0.0, 1.0);
    state = state.copyWith(sfxVolume: v);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_Keys.sfx, v);
  }

  Future<void> setVoiceVolume(double value) async {
    final v = value.clamp(0.0, 1.0);
    state = state.copyWith(voiceVolume: v);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_Keys.voice, v);
  }
}
