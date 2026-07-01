import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rab4ha/core/theme/rank_themes.dart';

void main() {
  test('formatCoins abbreviates thousands', () {
    expect(formatCoins(1500), '1.5K');
    expect(formatCoins(500), '500');
  });

  test('formatPlayerCode adds hash', () {
    expect(formatPlayerCode('k7m3p'), '#K7M3P');
  });

  test('rankThemes includes expert ruby theme', () {
    expect(rankThemes['ruby']!.primary, const Color(0xFFE11D48));
  });
}
