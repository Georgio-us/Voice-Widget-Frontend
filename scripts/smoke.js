import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOFT = String(process.env.VW_SMOKE_SOFT || '').trim() === '1';
const root = resolve(process.cwd());

const failures = [];
const warnings = [];

const check = (name, fn) => {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    const msg = `${name}: ${error?.message || error}`;
    failures.push(msg);
    console.error(`❌ ${msg}`);
  }
};

const warn = (name, condition, message) => {
  if (condition) return;
  const msg = `${name}: ${message}`;
  warnings.push(msg);
  console.warn(`⚠️ ${msg}`);
};

const nodeCheck = (file) => {
  execFileSync('node', ['--check', resolve(root, file)], { stdio: 'pipe' });
};

console.log('--- Frontend smoke start ---');
console.log(`Mode: ${SOFT ? 'soft (non-blocking)' : 'strict (blocking)'}`);

check('Syntax: server.js', () => nodeCheck('server.js'));
check('Syntax: voice-widget-v1.js', () => nodeCheck('voice-widget-v1.js'));
check('File exists: index.html', () => {
  if (!existsSync(resolve(root, 'index.html'))) throw new Error('missing');
});
check('File exists: voice-widget-standalone.css', () => {
  if (!existsSync(resolve(root, 'voice-widget-standalone.css'))) throw new Error('missing');
});

check('index.html references main bundle', () => {
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  if (!html.includes('voice-widget-v1.js')) {
    throw new Error('voice-widget-v1.js is not referenced in index.html');
  }
});

warn('Optional', existsSync(resolve(root, 'telegram-miniapp.css')), 'telegram-miniapp.css missing');
warn('Optional', existsSync(resolve(root, 'telegram-miniapp.js')), 'telegram-miniapp.js missing');

console.log('--- Frontend smoke summary ---');
if (warnings.length) {
  console.log(`Warnings: ${warnings.length}`);
}
if (!failures.length) {
  console.log('Result: PASS');
  process.exit(0);
}

console.error(`Failures: ${failures.length}`);
if (SOFT) {
  console.warn('Soft mode enabled: returning success despite failures.');
  process.exit(0);
}
process.exit(1);
