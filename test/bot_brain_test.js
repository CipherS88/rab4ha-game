const assert = require('assert');
const { BalootEngine, GamePhase } = require('../server/engine.js');
const {
  chooseBotCard,
  chooseBotBid,
  botHasSawa,
  buildMemory,
} = require('../server/botBrain.js');

function playingHand(opts = {}) {
  const e = new BalootEngine();
  e.phase = GamePhase.PLAYING;
  e.bid = { type: opts.bidType || 'SUN', suit: opts.bidSuit || null, bidder: opts.bidder ?? 0 };
  e.buyer_team = opts.buyerTeam ?? 1;
  e.turn = opts.turn ?? 0;
  e.hands = opts.hands || [[], [], [], []];
  e.played_cards = opts.played || [];
  e.trick_history = opts.trickHistory || [];
  e.current_trick = opts.currentTrick || [];
  e.trick_count = opts.trickCount ?? 1;
  return e;
}

// ذاكرة الكروت الملعوبة
{
  const e = playingHand({
    played: [{ suit: 'HEARTS', rank: 'A' }, { suit: 'HEARTS', rank: '10' }],
  });
  const mem = buildMemory(e);
  assert.ok(mem.has('A_of_HEARTS'));
  assert.ok(mem.has('10_of_HEARTS'));
}

// أكلة أكيدة أولاً
{
  const e = playingHand({
    hands: [
      [{ suit: 'HEARTS', rank: 'K' }, { suit: 'SPADES', rank: '7' }],
      [], [], [],
    ],
    played: [{ suit: 'HEARTS', rank: 'A' }, { suit: 'HEARTS', rank: '10' }],
    turn: 0,
  });
  const move = chooseBotCard(e, 0);
  assert.strictEqual(e.hands[0][move].suit, 'HEARTS');
  assert.strictEqual(e.hands[0][move].rank, 'K');
}

// تدبيل قاتل في الحكم
{
  const e = new BalootEngine();
  e.phase = GamePhase.DOUBLING;
  e.bid = { type: 'HAKAM', suit: 'CLUBS', bidder: 1 };
  e.buyer_team = 2;
  e.double_level = 1;
  e.hands[0] = [
    { suit: 'CLUBS', rank: '9' },
    { suit: 'CLUBS', rank: 'J' },
    { suit: 'CLUBS', rank: 'A' },
    { suit: 'HEARTS', rank: 'A' },
  ];
  const bid = chooseBotBid(e, 0);
  assert.strictEqual(bid.action, 'DOUBLE');
}

// مشروع 400 → صن إجباري
{
  const e = new BalootEngine();
  e.phase = GamePhase.PHASE_1;
  e.floor_card = { suit: 'HEARTS', rank: '7' };
  e.initial_project_hands = {
    0: [
      { suit: 'HEARTS', rank: 'A' }, { suit: 'DIAMONDS', rank: 'A' },
      { suit: 'CLUBS', rank: 'A' }, { suit: 'SPADES', rank: 'A' },
      { suit: 'HEARTS', rank: '7' }, { suit: 'HEARTS', rank: '8' },
      { suit: 'HEARTS', rank: '9' }, { suit: 'HEARTS', rank: '10' },
    ],
  };
  e.hands[0] = [...e.initial_project_hands[0]];
  const bid = chooseBotBid(e, 0);
  assert.strictEqual(bid.action, 'SUN');
}

console.log('bot_brain_test: ok');
