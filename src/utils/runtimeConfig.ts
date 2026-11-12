import { isAllowedLocalHostHeader } from './localHostPolicy';

export interface RuntimeConfig {
  host: string;
  port: number;
}

/** Parse and validate the only runtime settings that affect the local listener. */
export function loadRuntimeConfig(env: Record<string, string | undefined>): RuntimeConfig {
  const host = (env.HOST || '127.0.0.1').trim();
  if (!isAllowedLocalHostHeader(host)) {
    throw new Error('Local-only mode requires HOST to be localhost, 127.0.0.1, or ::1.');
  }

  const rawPort = env.PORT === undefined ? '3000' : env.PORT.trim();
  if (!/^\d{1,5}$/.test(rawPort)) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  const port = Number(rawPort);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return { host, port };
}
