import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import 'home_layout.dart';

class HomeLayoutState {
  const HomeLayoutState({
    required this.config,
    this.editMode = false,
    this.draft,
    this.loading = true,
  });

  final HomeLayoutConfig config;
  final HomeLayoutConfig? draft;
  final bool editMode;
  final bool loading;

  HomeLayoutConfig get active => editMode && draft != null ? draft! : config;

  HomeLayoutState copyWith({
    HomeLayoutConfig? config,
    HomeLayoutConfig? draft,
    bool? editMode,
    bool? loading,
    bool clearDraft = false,
  }) {
    return HomeLayoutState(
      config: config ?? this.config,
      draft: clearDraft ? null : (draft ?? this.draft),
      editMode: editMode ?? this.editMode,
      loading: loading ?? this.loading,
    );
  }
}

final homeLayoutServiceProvider = Provider<HomeLayoutService>((ref) {
  return HomeLayoutService(ref.watch(apiClientProvider));
});

class HomeLayoutNotifier extends Notifier<HomeLayoutState> {
  @override
  HomeLayoutState build() {
    Future.microtask(load);
    return HomeLayoutState(config: HomeLayoutConfig.defaults, loading: true);
  }

  HomeLayoutService get _svc => ref.read(homeLayoutServiceProvider);

  Future<void> load() async {
    final cfg = await _svc.fetch();
    state = state.copyWith(config: cfg, loading: false);
  }

  void startEdit() {
    state = state.copyWith(
      editMode: true,
      draft: HomeLayoutConfig(
        version: state.config.version,
        elements: Map.from(state.config.elements),
      ),
    );
  }

  void cancelEdit() {
    state = state.copyWith(editMode: false, clearDraft: true);
  }

  void updateBox(String id, HomeLayoutBox box) {
    if (!state.editMode || state.draft == null) return;
    final next = Map<String, HomeLayoutBox>.from(state.draft!.elements);
    next[id] = box;
    state = state.copyWith(draft: state.draft!.copyWith(elements: next));
  }

  Future<bool> save() async {
    if (state.draft == null) return false;
    try {
      final saved = await _svc.save(state.draft!);
      state = state.copyWith(config: saved, editMode: false, clearDraft: true);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> resetToDefault() async {
    try {
      final cfg = await _svc.reset();
      state = state.copyWith(
        draft: cfg,
        editMode: true,
      );
      return true;
    } catch (_) {
      return false;
    }
  }
}

final homeLayoutProvider =
    NotifierProvider<HomeLayoutNotifier, HomeLayoutState>(HomeLayoutNotifier.new);
