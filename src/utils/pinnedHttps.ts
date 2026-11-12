import dns from 'node:dns/promises';
import https from 'node:https';
import net from 'node:net';
import { URL } from 'node:url';
import { isRestrictedOrPrivateIp } from './ssrfValidator';

export interface PinnedHttpsResult {
  response: { ok: boolean; status: number };
  bodyText: string;
}

/** Reject a hostname if any DNS answer is private, local, reserved, or non-IP. */
export function validatePublicDnsAnswers(
  hostname: string,
  answers: readonly { address: string; family: number }[],
): void {
  if (!Array.isArray(answers) || answers.length === 0) {
    throw new Error('Remote provider hostname did not resolve to a public address.');
  }
  for (const answer of answers) {
    if (!answer || net.isIP(answer.address) === 0 || net.isIP(answer.address) !== answer.family || isRestrictedOrPrivateIp(answer.address)) {
      throw new Error('Remote provider hostname resolved to a restricted or non-public address.');
    }
  }
  if (!hostname || hostname.length > 253) {
    throw new Error('Remote provider hostname is invalid.');
  }
}

/** Build a resolver callback that can return only the already-validated addresses. */
export function createPinnedLookup(
  hostname: string,
  answers: readonly { address: string; family: number }[],
): (requestedHost: string, options: any, callback: any) => void {
  validatePublicDnsAnswers(hostname, answers);
  const normalizedHost = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const pinnedAnswers = answers.map((answer) => ({ address: answer.address, family: answer.family }));
  return (requestedHost: string, options: any, callback: any) => {
    if (requestedHost.replace(/^\[|\]$/g, '').toLowerCase() !== normalizedHost) {
      const error = Object.assign(new Error('Pinned DNS lookup host mismatch.'), { code: 'ENOTFOUND' });
      callback(error);
      return;
    }
    if (options && typeof options === 'object' && options.all) {
      callback(null, pinnedAnswers);
      return;
    }
    callback(null, pinnedAnswers[0].address, pinnedAnswers[0].family);
  };
}

/**
 * Make a single HTTPS request using the exact public DNS answers checked above.
 * Redirects are never followed. The pinned lookup callback prevents a second DNS
 * resolution from changing the destination between validation and connection.
 */
export async function fetchPinnedHttpsResponseText(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  maxBytes: number,
): Promise<PinnedHttpsResult> {
  const target = new URL(input);
  if (target.protocol !== 'https:' || target.username || target.password) {
    throw new Error('Pinned remote provider requests require a credential-free HTTPS URL.');
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 ||
      !Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error('Pinned provider request limits are invalid.');
  }

  const hostname = target.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  let answers: { address: string; family: number }[];
  if (net.isIP(hostname)) {
    answers = [{ address: hostname, family: net.isIPv4(hostname) ? 4 : 6 }];
  } else {
    let dnsTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      answers = await Promise.race([
        dns.lookup(hostname, { all: true, verbatim: true }),
        new Promise<never>((_resolve, reject) => {
          dnsTimer = setTimeout(() => reject(new Error('Remote provider DNS lookup timed out.')), Math.min(timeoutMs, 5000));
        }),
      ]);
    } finally {
      if (dnsTimer) clearTimeout(dnsTimer);
    }
  }
  validatePublicDnsAnswers(hostname, answers);
  const pinnedLookup = createPinnedLookup(hostname, answers);

  const headers = init.headers as Record<string, string> | undefined;
  const agent = new https.Agent({ keepAlive: false, lookup: pinnedLookup as any });
  const requestOptions: https.RequestOptions = {
    protocol: 'https:',
    hostname,
    port: target.port ? Number(target.port) : 443,
    path: target.pathname + target.search,
    method: init.method || 'GET',
    headers,
    agent,
    lookup: pinnedLookup as any,
  };

  return await new Promise<PinnedHttpsResult>((resolve, reject) => {
    let settled = false;
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    const finishError = (error: Error) => {
      if (settled) return;
      settled = true;
      if (deadlineTimer) clearTimeout(deadlineTimer);
      agent.destroy();
      reject(error);
    };
    const request = https.request(requestOptions, (response) => {
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      response.on('data', (chunk: Buffer | string) => {
        if (settled) return;
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += bytes.byteLength;
        if (totalBytes > maxBytes) {
          response.destroy();
          request.destroy(new Error('Provider response exceeded the permitted size.'));
          return;
        }
        chunks.push(bytes);
      });
      response.on('end', () => {
        if (settled) return;
        settled = true;
        if (deadlineTimer) clearTimeout(deadlineTimer);
        agent.destroy();
        const status = response.statusCode || 0;
        resolve({
          response: { ok: status >= 200 && status < 300, status },
          bodyText: Buffer.concat(chunks).toString('utf8'),
        });
      });
      response.on('error', finishError);
    });

    // Socket inactivity timeouts alone can be defeated by a peer that trickles
    // response bytes. Enforce a hard wall-clock deadline for the entire request.
    deadlineTimer = setTimeout(() => request.destroy(new Error('Provider request exceeded its total time limit.')), timeoutMs);
    request.setTimeout(timeoutMs, () => request.destroy(new Error('Provider request timed out.')));
    request.on('error', finishError);
    if (typeof init.body === 'string') request.write(init.body);
    request.end();
  });
}
