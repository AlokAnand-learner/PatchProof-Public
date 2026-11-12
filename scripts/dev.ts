/** Start PatchProof in explicit development mode on any supported OS. */
process.env.NODE_ENV = 'development';
await import('../server.ts');
