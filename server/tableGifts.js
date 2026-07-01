const { getOrCreatePlayer, savePlayer } = require('./db');
const { deviceIdForUser } = require('./auth');

const TABLE_GIFT_COST = 5;

const TABLE_GIFTS = {
  wolf: '🐺',
  coffee: '☕',
  tea: '🍵',
  plane: '✈️',
  cigarette: '🚬',
  rose: '🌹',
  heart: '❤️',
};

function isValidTableGiftId(giftId) {
  return Object.prototype.hasOwnProperty.call(TABLE_GIFTS, giftId);
}

function getTableGiftEmoji(giftId) {
  return TABLE_GIFTS[giftId] || null;
}

function deductTableGiftCoins(userId, amount) {
  const cost = parseInt(amount, 10) || 0;
  if (cost <= 0) return { error: 'تكلفة غير صالحة' };
  const deviceId = deviceIdForUser(userId);
  const profile = getOrCreatePlayer(deviceId);
  if ((profile.coins || 0) < cost) {
    return {
      error: `رصيدك غير كافٍ — تحتاج ${cost} عملة`,
      needed: cost,
      balance: profile.coins || 0,
    };
  }
  profile.coins -= cost;
  savePlayer(profile);
  return { ok: true, coins: profile.coins };
}

function pushTableGiftSlot(slots, giftId, emoji, fromSeat) {
  const row = [...(slots || [])];
  row.push({ giftId, emoji, fromSeat, at: Date.now() });
  while (row.length > 3) row.shift();
  return row;
}

module.exports = {
  TABLE_GIFT_COST,
  TABLE_GIFTS,
  isValidTableGiftId,
  getTableGiftEmoji,
  deductTableGiftCoins,
  pushTableGiftSlot,
};
