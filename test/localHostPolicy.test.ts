import { isAllowedLocalHostHeader, isAllowedLocalOrigin } from '../src/utils/localHostPolicy';

const cases: Array<[string, boolean]> = [
  ['localhost:3000', true],
  ['127.0.0.1:3000', true],
  ['[::1]:3000', true],
  ['::1', true],
  ['0.0.0.0:3000', false],
  ['192.168.1.20:3000', false],
  ['example.run.app', false],
  ['localhost.attacker.test:3000', false],
  ['evil-localhost:3000', false],
  ['', false],
  ['http://localhost:3000', false],
  ['user@localhost:3000', false],
  ['localhost/path', false],
  ['localhost?x=1', false],
];
for (const [host, expected] of cases) {
  if (isAllowedLocalHostHeader(host) !== expected) throw new Error(`Host policy failed for ${host}`);
}

const origins: Array<[string, boolean]> = [
  ['http://localhost:3000', true],
  ['http://127.0.0.1:3000', true],
  ['http://[::1]:3000', true],
  ['https://localhost:3000', true],
  ['https://aistudio.google.com', false],
  ['https://preview.run.app', false],
  ['http://localhost.attacker.test', false],
  ['file://localhost', false],
  ['http://user:pass@localhost:3000', false],
  ['http://localhost:3000/path', false],
  ['', false],
];
for (const [origin, expected] of origins) {
  if (isAllowedLocalOrigin(origin) !== expected) throw new Error(`Origin policy failed for ${origin}`);
}
console.log(`Local host policy: ${cases.length + origins.length} assertions passed.`);
