/**
 * Stop the Baloot server by freeing the listening port.
 * Usage: npm run stop
 */
const { execSync } = require('child_process');

const PORT = process.env.PORT || 3000;

function stopWindows() {
  let found = false;
  try {
    const out = execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const pids = new Set();
    for (const line of out.split('\n')) {
      if (!line.includes('LISTENING')) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid)) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`✓ تم إيقاف العملية ${pid} على المنفذ ${PORT}`);
        found = true;
      } catch { /* already dead */ }
    }
  } catch { /* no listeners */ }
  if (!found) console.log(`لا يوجد سيرفر يعمل على المنفذ ${PORT}`);
}

function stopUnix() {
  try {
    execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null`, { stdio: 'ignore', shell: true });
    console.log(`✓ تم إيقاف السيرفر على المنفذ ${PORT}`);
  } catch {
    console.log(`لا يوجد سيرفر يعمل على المنفذ ${PORT}`);
  }
}

if (process.platform === 'win32') stopWindows();
else stopUnix();
