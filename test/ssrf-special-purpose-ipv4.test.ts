/**
 * Regression tests for special-purpose IPv4 ranges in outbound endpoint validation.
 * Run with: npx tsx test/ssrf-special-purpose-ipv4.test.ts
 */
import { validateEndpointUrl } from '../src/utils/ssrfValidator';

let passed = 0;

function expectBlocked(address: string, description: string): void {
  const result = validateEndpointUrl(`http://${address}/api`);
  if (result.isValid || !result.isLocal) {
    throw new Error(`FAIL: ${description} (${address})`);
  }
  passed += 1;
  console.log(`PASS: ${description}`);
}

function expectAllowed(address: string, description: string): void {
  const result = validateEndpointUrl(`https://${address}/api`, { requiresHttps: true });
  if (!result.isValid || result.isLocal) {
    throw new Error(`FAIL: ${description} (${address})`);
  }
  passed += 1;
  console.log(`PASS: ${description}`);
}

expectBlocked('100.64.0.1', 'blocks the first address in shared address space');
expectBlocked('100.127.255.254', 'blocks the upper boundary of shared address space');
expectBlocked('192.0.0.8', 'blocks IETF protocol assignment space');
expectBlocked('192.88.99.1', 'blocks deprecated 6to4 relay anycast');
expectBlocked('198.18.0.1', 'blocks the first benchmarking address');
expectBlocked('198.19.255.254', 'blocks the upper benchmarking range');
expectAllowed('100.128.0.1', 'does not over-block the address immediately after shared space');
expectAllowed('198.17.255.254', 'does not over-block the address immediately before benchmarking space');

console.log(`SSRf special-purpose IPv4 regressions: ${passed}/8 passed.`);
