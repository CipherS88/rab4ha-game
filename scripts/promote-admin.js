#!/usr/bin/env node
/**
 * استعادة صلاحية أدمن — تشغيل من مجلد المشروع:
 *   node scripts/promote-admin.js asd
 *   node scripts/promote-admin.js ABCD12
 *   node scripts/promote-admin.js --id 3
 *   node scripts/promote-admin.js --list
 */
const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { db } = require('../server/db');
const { initAuthSchema } = require('../server/auth');

initAuthSchema();

function listUsers() {
  const rows = db.prepare(`
    SELECT id, username, display_name, player_code, role
    FROM users ORDER BY id
  `).all();
  console.log('\nالمستخدمون:');
  for (const u of rows) {
    const code = u.player_code ? `#${u.player_code}` : '—';
    console.log(`  [${u.id}] ${u.display_name} (@${u.username}) ${code} — ${u.role}`);
  }
  const admins = rows.filter((u) => u.role === 'admin');
  console.log(`\nعدد الأدمن: ${admins.length}`);
  if (!admins.length) {
    console.log('⚠️  لا يوجد أدمن! شغّل: node scripts/promote-admin.js <معرّف>');
  }
}

const arg = process.argv[2];
if (!arg || arg === '--help' || arg === '-h') {
  console.log('Usage: node scripts/promote-admin.js <login_id|username|#code|--id N|--list>');
  listUsers();
  process.exit(0);
}

if (arg === '--list') {
  listUsers();
  process.exit(0);
}

let user = null;
if (arg === '--id') {
  const id = parseInt(process.argv[3], 10);
  if (!id) {
    console.error('Usage: node scripts/promote-admin.js --id <number>');
    process.exit(1);
  }
  user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
} else {
  const raw = String(arg).trim();
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compact.length >= 4) {
    user = db.prepare('SELECT * FROM users WHERE player_code = ?').get(compact);
  }
  if (!user) {
    user = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(raw);
  }
  if (!user) {
    user = db.prepare('SELECT * FROM users WHERE display_name LIKE ?').get(`%${raw}%`);
  }
}

if (!user) {
  console.error('لم يُعثر على المستخدم:', arg);
  listUsers();
  process.exit(1);
}

db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(user.id);
console.log(`✅ تم ترقية "${user.display_name}" (@${user.username}) إلى أدمن`);
console.log(`   ID: ${user.id}  |  player_code: ${user.player_code ? '#' + user.player_code : '—'}`);
console.log('\nسجّل دخول من: http://localhost:3000/x-rb4ha-panel');
