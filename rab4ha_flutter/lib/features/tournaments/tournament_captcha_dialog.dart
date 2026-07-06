import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/rab4ha_theme.dart';

class TournamentCaptchaResult {
  const TournamentCaptchaResult({required this.token, required this.answer});
  final String token;
  final String answer;
}

/// نافذة لغز بسيط قبل التسجيل في البطولة — تُرجع التوكن والإجابة للـ join API.
Future<TournamentCaptchaResult?> showTournamentCaptchaDialog(
  BuildContext context,
  WidgetRef ref,
) async {
  final api = ref.read(apiClientProvider);
  Map<String, dynamic>? captcha;
  try {
    final res = await api.get('/api/tournaments/captcha');
    captcha = Map<String, dynamic>.from(await api.parseJson(res) as Map);
  } catch (_) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تعذّر تحميل اللغز — حاول مجدداً')),
      );
    }
    return null;
  }

  if (!context.mounted) return null;
  final answerCtrl = TextEditingController();
  final c = rab4haColors(context);
  final token = captcha['token']?.toString() ?? '';

  final result = await showDialog<TournamentCaptchaResult>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) {
      return AlertDialog(
        backgroundColor: c.bgElevated,
        title: Text('تحقق سريع', style: TextStyle(color: c.goldLight)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'أثبت أنك إنسان — حل اللغز للانضمام للبطولة',
              style: TextStyle(color: c.textMuted, fontSize: 13),
            ),
            const SizedBox(height: 16),
            Text(
              captcha?['question']?.toString() ?? '?',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: c.gold,
                fontSize: 28,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: answerCtrl,
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              decoration: const InputDecoration(labelText: 'الإجابة'),
              onSubmitted: (_) {
                final ans = answerCtrl.text.trim();
                if (ans.isNotEmpty) {
                  Navigator.pop(ctx, TournamentCaptchaResult(token: token, answer: ans));
                }
              },
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('إلغاء'),
          ),
          FilledButton(
            onPressed: () {
              final ans = answerCtrl.text.trim();
              if (ans.isEmpty) return;
              Navigator.pop(ctx, TournamentCaptchaResult(token: token, answer: ans));
            },
            child: const Text('تأكيد'),
          ),
        ],
      );
    },
  );

  answerCtrl.dispose();
  return result;
}
