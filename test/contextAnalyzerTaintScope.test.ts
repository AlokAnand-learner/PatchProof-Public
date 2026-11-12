import assert from 'node:assert/strict';
import { analyzeSourceCodeContextAware } from '../src/engine/contextAnalyzer';

function classifications(code: string, fileName: string): string[] {
  return analyzeSourceCodeContextAware(code, fileName).findings.map(f => f.verificationStatus);
}

const crossFunctionSource = `def first_handler(request):
    target = request.args.get("host")

def second_handler():
    return os.popen("ping " + target).read()
`;
const crossFunctionStatuses = classifications(crossFunctionSource, 'service.py');
assert.ok(crossFunctionStatuses.includes('NEEDS_REVIEW'));
assert.equal(crossFunctionStatuses.includes('LIKELY'), false,
  'request taint in one Python function must not leak into the next function');

const multilineCommentSource = `def ping():
    """
    target = request.args.get("host")
    """
    return os.popen("ping " + target).read()
`;
const commentStatuses = classifications(multilineCommentSource, 'service.py');
assert.ok(commentStatuses.includes('NEEDS_REVIEW'));
assert.equal(commentStatuses.includes('LIKELY'), false,
  'request-like text inside a multiline docstring must not create taint');

const sameFunctionSource = `def ping(request):
    target = request.args.get("host")
    return os.popen("ping " + target).read()
`;
const positiveStatuses = classifications(sameFunctionSource, 'service.py');
assert.ok(positiveStatuses.includes('LIKELY'),
  'direct request-to-command flow in one function should remain detectable');

console.log('Taint scope boundary regression: 3 scenarios passed.');
