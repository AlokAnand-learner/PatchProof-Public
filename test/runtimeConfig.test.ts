import { loadRuntimeConfig } from '../src/utils/runtimeConfig';

const valid = loadRuntimeConfig({});
if (valid.host !== '127.0.0.1' || valid.port !== 3000) throw new Error('Default runtime config is incorrect.');
for (const host of ['localhost', '127.0.0.1', '::1']) {
  if (loadRuntimeConfig({ HOST: host, PORT: '4567' }).host !== host) throw new Error(`Loopback host rejected: ${host}`);
}
for (const host of ['0.0.0.0', '192.168.1.2', 'example.com']) {
  let rejected = false;
  try { loadRuntimeConfig({ HOST: host }); } catch { rejected = true; }
  if (!rejected) throw new Error(`Non-loopback host accepted: ${host}`);
}
for (const port of ['0', '65536', '-1', '1.5', 'abc', '3000x', '']) {
  let rejected = false;
  try { loadRuntimeConfig({ PORT: port }); } catch { rejected = true; }
  if (!rejected) throw new Error(`Invalid port accepted: ${JSON.stringify(port)}`);
}
for (const port of ['1', '3000', '65535']) {
  if (loadRuntimeConfig({ PORT: port }).port !== Number(port)) throw new Error(`Valid port rejected: ${port}`);
}
console.log('Runtime configuration: 17 assertions passed.');
