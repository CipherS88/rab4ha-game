const assert = require('assert');
const { BalootEngine, GamePhase, normalizeQaidReason } = require('../server/engine.js');

function hakamLeadEngine() {
  const e = new BalootEngine();
  e.phase = GamePhase.PLAYING;
  e.bid = { type: 'HAKAM', suit: 'CLUBS', bidder: 0 };
  e.buyer_team = 1;
  e.turn = 0;
  e.current_trick = [];
  e.trick_count = 2;
  e.trick_history = [[{ player: 0, card: { suit: 'HEARTS', rank: '7' } }]];
  return e;
}

// ── لا فقاعة إكة تلقائية ──
{
  const e = hakamLeadEngine();
  e.played_cards = [
    { suit: 'HEARTS', rank: 'A' },
    { suit: 'HEARTS', rank: 'K' },
  ];
  const card = { suit: 'HEARTS', rank: '10' };
  assert.strictEqual(e.is_akka(card), true);
  assert.deepStrictEqual(e.getPlayChatBubbles(0, card), []);
}

// ── إعلان إكة خاطئة (كرت حكم) → مخالفة مخفية ──
{
  const e = hakamLeadEngine();
  e.hands[0] = [
    { suit: 'CLUBS', rank: '8' },
    { suit: 'HEARTS', rank: '7' },
  ];
  e.play_card(0, 0, { is_ekkah_declared: true });
  assert.strictEqual(e.wrong_ekkah_violations.length, 1);
  assert.strictEqual(e.wrong_ekkah_violations[0].team, 1);
  assert.strictEqual(e.mistakes.length, 0);
  assert.strictEqual(e.phase, GamePhase.PLAYING);
}

// ── إعلان إكة خاطئة (ليس أقوى متبقٍ) ──
{
  const e = hakamLeadEngine();
  e.played_cards = [{ suit: 'HEARTS', rank: 'A' }];
  e.hands[0] = [{ suit: 'HEARTS', rank: 'K' }];
  e.play_card(0, 0, { is_ekkah_declared: true });
  assert.strictEqual(e.wrong_ekkah_violations.length, 1);
}

// ── إعلان إكة صحيح → لا مخالفة ──
{
  const e = hakamLeadEngine();
  e.played_cards = [
    { suit: 'HEARTS', rank: 'A' },
    { suit: 'HEARTS', rank: 'K' },
  ];
  e.hands[0] = [{ suit: 'HEARTS', rank: '10' }];
  e.play_card(0, 0, { is_ekkah_declared: true });
  assert.strictEqual(e.wrong_ekkah_violations.length, 0);
  const meta = e.getLastEkkahPlayMeta();
  assert.strictEqual(meta.declared, true);
  assert.strictEqual(meta.wrong, false);
}

// ── قيد يدوي: إكة خاطئة — نجاح عند وجود مخالفة ──
{
  const e = hakamLeadEngine();
  e.wrong_ekkah_violations.push({ seat: 0, team: 1, card: { suit: 'CLUBS', rank: '8' }, trick_count: 2 });
  const result = e.validate_qaid('إكة خاطئة', [], 2);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.win_team, 2);
  assert.strictEqual(result.mistake_team, 1);
}

// ── قيد يدوي: إكة خاطئة — فشل بدون مخالفة (يعاقب المشتكي) ──
{
  const e = hakamLeadEngine();
  const result = e.validate_qaid('wrong_ekkah', [], 2);
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.win_team, 1);
  assert.strictEqual(result.mistake_team, 2);
}

// ── alias ──
assert.strictEqual(normalizeQaidReason('wrong_ekkah'), 'إكة خاطئة');

console.log('ekkah_qaid_test: ok');
