import { classifyRequestBodyError } from '../src/utils/requestError.ts';

let passed = 0;
function check(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
  passed++;
}

check('oversized body maps to 413 without parser detail',
  classifyRequestBodyError({ type: 'entity.too.large', message: 'private parser detail', status: 413 }),
  { statusCode: 413, message: 'Request body exceeds the permitted size.' });
check('invalid JSON maps to 400',
  classifyRequestBodyError({ type: 'entity.parse.failed', body: '{secret:1}' }),
  { statusCode: 400, message: 'Request body contains invalid JSON.' });
check('unsupported encoding maps to 415',
  classifyRequestBodyError({ type: 'encoding.unsupported' }),
  { statusCode: 415, message: 'Request body encoding is not supported.' });
check('unsupported charset maps to 415',
  classifyRequestBodyError({ type: 'charset.unsupported' }),
  { statusCode: 415, message: 'Request body encoding is not supported.' });
check('aborted request maps to 400',
  classifyRequestBodyError({ type: 'request.aborted' }),
  { statusCode: 400, message: 'Request body was not received completely.' });
check('unrecognized parser errors are not misclassified',
  classifyRequestBodyError({ type: 'entity.verify.failed', status: 403 }), null);
check('arbitrary error strings are not exposed', classifyRequestBodyError('sensitive error'), null);
check('null errors are ignored', classifyRequestBodyError(null), null);

console.log(`Request error sanitization: ${passed}/8 passed.`);
