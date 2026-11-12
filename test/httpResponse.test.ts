import { readResponseTextLimited, parseProviderJson } from '../src/utils/httpResponse.ts';

let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL: ${name}`);
  passed++;
}
async function rejects(name: string, action: () => Promise<unknown>) {
  try { await action(); } catch { passed++; return; }
  throw new Error(`FAIL: ${name} should reject`);
}

async function run() {
  check('reads a response within the byte ceiling', await readResponseTextLimited(new Response('safe'), 4) === 'safe');
  check('accepts a response exactly at the byte ceiling', await readResponseTextLimited(new Response('1234'), 4) === '1234');
  await rejects('rejects declared oversized content length', () => readResponseTextLimited(new Response('12345', { headers: { 'content-length': '5' } }), 4));

  const chunked = new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('123'));
      controller.enqueue(new TextEncoder().encode('45'));
      controller.close();
    }
  }));
  await rejects('rejects chunked body that exceeds byte ceiling', () => readResponseTextLimited(chunked, 4));

  check('parses valid provider JSON', parseProviderJson<{ ok: boolean }>('{"ok":true}').ok === true);
  await rejects('does not expose malformed provider response contents', async () => parseProviderJson('{synthetic-secret-content}'));
  await rejects('rejects invalid response size limits', () => readResponseTextLimited(new Response('x'), 0));
  check('returns empty text for a bodyless response', await readResponseTextLimited(new Response(null), 1) === '');

  console.log(`Bounded provider response handling: ${passed}/8 passed.`);
}

run().catch(error => { console.error(error); process.exitCode = 1; });
