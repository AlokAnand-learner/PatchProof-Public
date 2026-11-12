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
const analysisStart = source.indexOf('/**\\n * Dispatches code analysis', anthropicStart);
const analysisAnthropicStart = source.indexOf('// D. ANTHROPIC', analysisStart);
const analysisAnthropicEnd = source.indexOf('\\n  throw new Error(`Unsupported provider: ${activeProvider}`);', analysisAnthropicStart);
assert.ok(anthropicStart >= 0 && analysisStart > anthropicStart, 'Anthropic connection adapter must be discoverable');
assert.ok(analysisAnthropicStart >= 0 && analysisAnthropicEnd > analysisAnthropicStart, 'Anthropic analysis adapter must be discoverable');
const anthropicConnectionSection = source.slice(anthropicStart, analysisStart);
const anthropicAnalysisSection = source.slice(analysisAnthropicStart, analysisAnthropicEnd);
for (const [name, section] of [['Anthropic connection test', anthropicConnectionSection], ['Anthropic analysis', anthropicAnalysisSection]] as const) {
  assert.equal((section.match(/fetchPinnedHttpsResponseText\\(/g) || []).length, 1, name + ' must use DNS-pinned HTTPS transport');
  assert.equal(/fetchResponseText\\(/.test(section), false, name + ' must not use ordinary fetch transport');
}

console.log('Provider adapter source contract tests: 20 assertions passed');
