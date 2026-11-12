import * as fs from 'node:fs';

const serverSource = fs.readFileSync('server.ts', 'utf8');
const rateLimiterPosition = serverSource.indexOf("app.use(rateLimiter);");
const preBodyAuthPosition = serverSource.indexOf('app.use(preBodyAuthGuard);');
const jsonParserPosition = serverSource.indexOf("app.use(express.json({ limit: '25mb' }));");
const securityHeadersPosition = serverSource.indexOf('app.use(securityHeaders);');
const originValidationPosition = serverSource.indexOf('app.use(validateOriginAndCrossSite);');

if ([rateLimiterPosition, preBodyAuthPosition, jsonParserPosition, securityHeadersPosition, originValidationPosition].some(position => position < 0)) {
  throw new Error('Expected server middleware registrations were not found.');
}
if (!(originValidationPosition < securityHeadersPosition && securityHeadersPosition < rateLimiterPosition && rateLimiterPosition < preBodyAuthPosition && preBodyAuthPosition < jsonParserPosition)) {
  throw new Error('Request rate limiting must run before JSON body parsing, while security headers and origin validation remain earlier.');
}

console.log('Middleware ordering: rate limiting and pre-body authentication precede JSON parsing; security/origin middleware remains first.');
