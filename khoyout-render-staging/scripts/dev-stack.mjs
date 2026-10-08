import { spawn } from 'node:child_process';

const programs = [
  ['API', 'node_modules/.bin/tsx', ['watch', 'server/index.ts']],
  ['Storefront', 'node_modules/.bin/vite', ['--host', '0.0.0.0']],
];
const children = programs.map(([name, command, args]) => {
  const child = spawn(command, args, { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
  child.on('exit', (code) => {
    if (code && code !== 0) console.error(`${name} exited with code ${code}`);
    for (const other of children) if (other !== child && !other.killed) other.kill('SIGTERM');
  });
  return child;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  for (const child of children) if (!child.killed) child.kill(signal);
});
