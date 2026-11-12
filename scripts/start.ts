/** Start PatchProof in explicit production mode on any supported OS. */
process.env.NODE_ENV = 'production';
await import('../server.ts');
