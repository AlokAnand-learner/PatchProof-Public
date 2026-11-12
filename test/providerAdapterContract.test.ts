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
assert.ok(source.includes('fetchPinnedHttpsResponseText(requestUrl'), 'remote custom provider must use DNS-pinned HTTPS transport');
assert.ok(source.includes("redirect: 'error'"), 'custom provider requests must reject redirects');
console.log('Provider adapter source contract tests: 16 assertions passed');
