import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'src/engine/providerEngine.ts'), 'utf8');
const sections = [
  ['Ollama', '// A. OLLAMA (Local)', '// B. GEMINI or HOSTED GEMMA', ['system: systemInstruction', 'prompt: userPayload']],
  ['Gemini/Gemma', '// B. GEMINI or HOSTED GEMMA', '// C. OPENAI or CUSTOM OPENAI-COMPATIBLE', ['contents: userPayload', 'systemInstruction']],
  ['OpenAI-compatible', '// C. OPENAI or CUSTOM OPENAI-COMPATIBLE', '// D. ANTHROPIC', ["role: 'system'", "role: 'user'", 'content: userPayload']],
  ['Anthropic', '// D. ANTHROPIC', '\n}\n\nexport function extractJsonFromModelResponse', ['system: systemInstruction', "role: 'user'", 'content: userPayload']],
];

for (const [name, startMarker, endMarker, required] of sections as [string, string, string, string[]][]) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, name + ' adapter section must exist');
  const section = source.slice(start, end);
  for (const contract of required) {
    assert.ok(section.includes(contract), name + ' adapter must include ' + contract);
  }
  assert.equal(/\btools\s*:/.test(section), false, name + ' review request must not declare provider tools');
}
assert.ok(source.includes('fetchPinnedHttpsResponseText(requestUrl'), 'remote provider requests must use DNS-pinned HTTPS transport');
assert.ok(source.includes("provider === 'custom' && isCustomLocal"), 'ordinary fetch must be limited to trusted custom loopback during connection tests');
assert.ok(source.includes("activeProvider === 'custom' && isCustomLocal"), 'ordinary fetch must be limited to trusted custom loopback during analysis');
assert.ok(source.includes('Every remote HTTPS endpoint is DNS-pinned'), 'OpenAI and remote custom connection tests must share pinned transport');
assert.ok(source.includes('Remote OpenAI and custom HTTPS endpoints must use DNS-pinned transport'), 'OpenAI and remote custom analysis must share pinned transport');
assert.ok(source.includes("redirect: 'error'"), 'provider requests must reject redirects');
const anthropicStart = source.indexOf('// 4. ANTHROPIC');
const anthropicEnd = source.indexOf('\n}\n\nexport function extractJsonFromModelResponse', anthropicStart);
assert.ok(anthropicStart >= 0 && anthropicEnd > anthropicStart, 'Anthropic adapter must be discoverable');
const anthropicSection = source.slice(anthropicStart, anthropicEnd);
assert.equal(
  (anthropicSection.match(/fetchPinnedHttpsResponseText\\(/g) || []).length,
  2,
  'Anthropic connection tests and analysis must both use DNS-pinned HTTPS transport',
);
assert.equal(
  /fetchResponseText\\(/.test(anthropicSection),
  false,
  'Anthropic cloud requests must never use the ordinary fetch transport',
);

console.log('Provider adapter source contract tests: 20 assertions passed');
