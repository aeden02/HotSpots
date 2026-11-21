
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const SERVICES = ['mongo', 'ai', 'backend', 'frontend'];
function run(cmd, args, cwd) {
    console.log(`\n> ${cmd} ${args.join(' ')}`);
    const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!process.argv.includes('--no-up')) {
    run('docker', ['compose', 'up', '-d', '--build', '--wait', '--wait-timeout', '1500', ...SERVICES], root);
}

run('npx', ['jest', '--config', 'integration/jest.config.js', '--runInBand'], path.resolve(__dirname, '..'));
