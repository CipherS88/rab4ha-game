const { sendAdminGift } = require('./gifts');

function adminGrantGift(targetUserId, opts = {}, adminUser = null) {
  if (!adminUser) {
    return { error: 'مطلوب حساب أدمن' };
  }
  return sendAdminGift(adminUser, targetUserId, opts);
}

module.exports = { adminGrantGift };
