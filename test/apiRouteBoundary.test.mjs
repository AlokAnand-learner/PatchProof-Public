import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const routeLines = source.split(/\r?\n/).map((line, index) => ({ line, number: index + 1 }));

// Every mutating API route must authenticate before its handler can parse or act
// on caller-controlled data. Keep the bootstrap and explicitly read-only GETs
// outside this assertion; preBodyAuthGuard independently protects non-allowlisted GETs.
const mutatingRoutes = routeLines.filter(({ line }) =>
  /\bapp\.(?:post|put|patch|delete)\(/.test(line) && /['"`]\/api\//.test(line)
);
assert.ok(mutatingRoutes.length > 0, 'expected to discover API mutation routes');
for (const { line, number } of mutatingRoutes) {
  assert.match(line, /requireSessionAuth/, `API mutation route at server.ts:${number} must require session authentication`);
}

// The bootstrap and read-only public routes are an intentionally small allowlist.
// Any new public GET must be explicitly reviewed here rather than silently widening it.
const publicGetPaths = new Set([
  '/api/auth/session',
  '/api/status',
  '/api/providers',
  '/api/config',
  '/api/evaluate',
  '/api/fix/benchmark',
]);
const getRoutes = routeLines.flatMap(({ line, number }) => {
  const match = line.match(/\bapp\.get\(\s*['"`]([^'"`]+)['"`]/);
  return match && match[1].startsWith('/api/') ? [{ path: match[1], line, number }] : [];
});
for (const route of getRoutes) {
  if (publicGetPaths.has(route.path)) {
    assert.doesNotMatch(route.line, /requireSessionAuth/, `public GET ${route.path} should remain in the explicit allowlist`);
  } else {
    assert.match(route.line, /requireSessionAuth/, `non-allowlisted GET ${route.path} at server.ts:${route.number} must authenticate`);
  }
}

// Expensive provider/network routes must hold the shared task gate until completion.
const gatedRoutes = [
  '/api/status',
  '/api/provider/test',
  '/api/test-connection',
  '/api/query',
  '/api/generate-analysis',
  '/api/ollama/models',
  '/api/fix/benchmark',
  '/api/fix/validate',
  '/api/validate-fix',
  '/api/analyze',
];
for (const path of gatedRoutes) {
  const route = routeLines.find(({ line }) => /\\bapp\\.(?:get|post|put|patch|delete)\\(/.test(line) && (line.includes(`'${path}'`) || line.includes(`"${path}"`)));
  assert.ok(route, `expected route declaration for ${path}`);
  assert.match(route.line, /withProviderTask/, `${path} must use the shared concurrency gate`);
}

console.log(`API route boundary regression: ${mutatingRoutes.length} mutating routes, ${getRoutes.length} API GET routes, and ${gatedRoutes.length} expensive routes checked.`);
