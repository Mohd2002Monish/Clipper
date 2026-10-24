import { spawn } from 'node:child_process';
import process from 'node:process';

console.log('\x1b[36m[VideoTimmer]\x1b[0m Starting Next.js Web Server and Background Rendering Worker concurrently...\n');

// 1. Spawn Next.js Dev Server
const web = spawn('npx', ['next', 'dev', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, FORCE_COLOR: '1' },
});

// 2. Spawn BullMQ Rendering Worker
const worker = spawn('npx', ['tsx', 'watch', 'src/worker/index.ts'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, FORCE_COLOR: '1' },
});

let isShuttingDown = false;

function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n\x1b[33m[VideoTimmer]\x1b[0m Shutting down both Web server and Worker (${signal})...`);

  try {
    web.kill('SIGINT');
  } catch (_) {}

  try {
    worker.kill('SIGINT');
  } catch (_) {}

  setTimeout(() => {
    try {
      web.kill('SIGKILL');
    } catch (_) {}
    try {
      worker.kill('SIGKILL');
    } catch (_) {}
    process.exit(0);
  }, 1500);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

web.on('exit', (code) => {
  if (!isShuttingDown && code !== 0) {
    console.error(`\x1b[31m[VideoTimmer]\x1b[0m Web server exited with code ${code}`);
    shutdown('WEB_EXIT');
  }
});

worker.on('exit', (code) => {
  if (!isShuttingDown && code !== 0) {
    console.error(`\x1b[31m[VideoTimmer]\x1b[0m Worker exited with code ${code}`);
  }
});
