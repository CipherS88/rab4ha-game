import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import 'game_layout.dart';

class GameLayoutState {
  const GameLayoutState({
    required this.config,
    this.editMode = false,
    this.draft,
    this.loading = true,
    this.previewCardCount = 8,
    this.showProjectBar = true,
    this.showBidPanel = true,
    this.lastSaveError,
  });

  final GameLayoutConfig config;
  final GameLayoutConfig? draft;
  final bool editMode;
  final bool loading;
  final int previewCardCount;
  final bool showProjectBar;
  final bool showBidPanel;
  final String? lastSaveError;

  /// التخطيط النشط مع دمج إعدادات 5 أو 8 كروت.
  ResolvedGameLayout get active {
    final base = editMode && draft != null ? draft! : config;
    return base.resolve(previewCardCount);
  }

  GameLayoutState copyWith({
    GameLayoutConfig? config,
    GameLayoutConfig? draft,
    bool? editMode,
    bool? loading,
    int? previewCardCount,
    bool? showProjectBar,
    bool? showBidPanel,
    String? lastSaveError,
    bool clearDraft = false,
    bool clearSaveError = false,
  }) {
    return GameLayoutState(
      config: config ?? this.config,
      draft: clearDraft ? null : (draft ?? this.draft),
      editMode: editMode ?? this.editMode,
      loading: loading ?? this.loading,
      previewCardCount: previewCardCount ?? this.previewCardCount,
      showProjectBar: showProjectBar ?? this.showProjectBar,
      showBidPanel: showBidPanel ?? this.showBidPanel,
      lastSaveError: clearSaveError ? null : (lastSaveError ?? this.lastSaveError),
    );
  }
}

final gameLayoutServiceProvider = Provider<GameLayoutService>((ref) {
  return GameLayoutService(ref.watch(apiClientProvider));
});

class GameLayoutNotifier extends Notifier<GameLayoutState> {
  @override
  GameLayoutState build() {
    Future.microtask(load);
    return GameLayoutState(config: GameLayoutConfig.defaults, loading: true);
  }

  GameLayoutService get _svc => ref.read(gameLayoutServiceProvider);

  Future<void> load() async {
    final cfg = await _svc.fetch();
    state = state.copyWith(config: cfg, loading: false);
  }

  void _ensureDraft() {
    if (state.draft != null) return;
    state = state.copyWith(
      editMode: true,
      draft: GameLayoutConfig(
        version: state.config.version,
        elements: Map.from(state.config.elements),
        tuning: state.config.tuning,
        variants: Map.from(state.config.variants),
      ),
    );
  }

  String get _variantKey => GameLayoutConfig.variantKeyForCount(state.previewCardCount);

  void toggleEdit() {
    if (state.editMode) {
      cancelEdit();
    } else {
      startEdit();
    }
  }

  void startEdit() {
    state = state.copyWith(
      editMode: true,
      draft: GameLayoutConfig(
        version: state.config.version,
        elements: Map.from(state.config.elements),
        tuning: state.config.tuning,
        variants: Map.from(state.config.variants),
      ),
      clearSaveError: true,
    );
  }

  void cancelEdit() {
    state = state.copyWith(editMode: false, clearDraft: true, clearSaveError: true);
  }

  void updateBox(String id, GameLayoutBox box) {
    _ensureDraft();
    if (HandVariant.handElementIds.contains(id)) {
      final variants = Map<String, HandVariant>.from(state.draft!.variants);
      final v = variants[_variantKey] ?? HandVariant.defaultsFor(_variantKey);
      final elems = Map<String, GameLayoutBox>.from(v.elements)..[id] = box;
      variants[_variantKey] = v.copyWith(elements: elems);
      state = state.copyWith(draft: state.draft!.copyWith(variants: variants));
    } else {
      final next = Map<String, GameLayoutBox>.from(state.draft!.elements)..[id] = box;
      state = state.copyWith(draft: state.draft!.copyWith(elements: next));
    }
  }

  Future<bool> save() async {
    _ensureDraft();
    try {
      final saved = await _svc.save(state.draft!);
      state = state.copyWith(
        config: saved,
        editMode: false,
        clearDraft: true,
        clearSaveError: true,
      );
      return true;
    } on ApiException catch (e) {
      state = state.copyWith(lastSaveError: e.message);
      return false;
    } catch (e) {
      state = state.copyWith(lastSaveError: e.toString());
      return false;
    }
  }

  Future<bool> resetToDefault() async {
    try {
      final cfg = await _svc.reset();
      state = state.copyWith(draft: cfg, editMode: true, clearSaveError: true);
      return true;
    } catch (e) {
      state = state.copyWith(lastSaveError: e.toString());
      return false;
    }
  }

  void setPreviewCardCount(int count) {
    state = state.copyWith(previewCardCount: count);
  }

  void setShowProjectBar(bool value) {
    state = state.copyWith(showProjectBar: value);
  }

  void setShowBidPanel(bool value) {
    state = state.copyWith(showBidPanel: value);
  }

  void bumpTuning(String key, double delta) {
    _ensureDraft();
    if (key == 'handCardGap' || key == 'handCardScale') {
      final variants = Map<String, HandVariant>.from(state.draft!.variants);
      final v = variants[_variantKey] ?? HandVariant.defaultsFor(_variantKey);
      final next = switch (key) {
        'handCardGap' => v.copyWith(handCardGap: (v.handCardGap + delta).clamp(0.3, 3.0)),
        'handCardScale' => v.copyWith(handCardScale: (v.handCardScale + delta).clamp(0.4, 2.5)),
        _ => v,
      };
      variants[_variantKey] = next;
      state = state.copyWith(draft: state.draft!.copyWith(variants: variants));
    } else {
      final t = state.draft!.tuning;
      final next = switch (key) {
        'floorCardScale' => t.copyWith(floorCardScale: (t.floorCardScale + delta).clamp(0.4, 3.0)),
        'opponentCardScale' => t.copyWith(opponentCardScale: (t.opponentCardScale + delta).clamp(0.4, 2.5)),
        'opponentCardOverlap' => t.copyWith(opponentCardOverlap: (t.opponentCardOverlap + delta).clamp(0.3, 3.0)),
        _ => t,
      };
      state = state.copyWith(draft: state.draft!.copyWith(tuning: next));
    }
  }
}

final gameLayoutProvider =
    NotifierProvider<GameLayoutNotifier, GameLayoutState>(GameLayoutNotifier.new);
