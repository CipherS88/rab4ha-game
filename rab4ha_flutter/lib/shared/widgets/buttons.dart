import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/rab4ha_theme.dart';

class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.enabled = true,
    this.width,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool enabled;
  final double? width;

  @override
  Widget build(BuildContext context) {
    final c = rab4haColors(context);
    return SizedBox(
      width: width ?? double.infinity,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: enabled ? c.primaryButtonGradient : null,
          color: enabled ? null : c.inputBorder,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: enabled ? onPressed : null,
            borderRadius: BorderRadius.circular(14),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(0xFF080808),
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    super.key,
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final c = rab4haColors(context);
    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: c.textMuted,
        side: BorderSide(color: c.inputBorder),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 24),
      ),
      child: Text(label),
    );
  }
}

final homeToastProvider =
    NotifierProvider<HomeToastNotifier, String?>(HomeToastNotifier.new);

class HomeToastNotifier extends Notifier<String?> {
  @override
  String? build() => null;

  void show(String msg) {
    state = msg;
    Future.delayed(const Duration(milliseconds: 2200), () {
      if (state == msg) state = null;
    });
  }
}

class HomeToastOverlay extends ConsumerWidget {
  const HomeToastOverlay({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final msg = ref.watch(homeToastProvider);
    return Stack(
      children: [
        child,
        if (msg != null)
          Positioned(
            top: MediaQuery.paddingOf(context).top + 12,
            left: 24,
            right: 24,
            child: Material(
              color: Colors.black87,
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Text(msg, textAlign: TextAlign.center),
              ),
            ),
          ),
      ],
    );
  }
}
