/**
 * إعادة تعيين رادار اللعب لجميع اللاعبين إلى صفر
 * الاستخدام: node server/resetRadar.js
 */
const { db } = require('./db');
const { initPlayRadarSchema } = require('./playRadar');

initPlayRadarSchema();

const before = db.prepare(`
  SELECT device_id, name, stat_fair, stat_buy, stat_qaid, stat_kaboot, stat_speed, stat_projects, radar_ranked_matches
  FROM players
  WHERE radar_ranked_matches > 0
     OR stat_fair != 0 OR stat_buy != 0 OR stat_qaid != 0
     OR stat_kaboot != 0 OR stat_speed != 0 OR stat_projects != 0
`).all();

if (before.length) {
  console.log('قبل التصفير:', before);
} else {
  console.log('لا يوجد لاعبون بقيم غير صفرية.');
}

const result = db.prepare(`
  UPDATE players SET
    stat_fair = 0,
    stat_buy = 0,
    stat_qaid = 0,
    stat_kaboot = 0,
    stat_speed = 0,
    stat_projects = 0,
    radar_ranked_matches = 0,
    updated_at = datetime('now')
`).run();

console.log(`تم تصفير رادار ${result.changes} لاعب/لاعبين.`);
