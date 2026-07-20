/**
 * Executed BEFORE AppModule is imported (import ordering in postback-app.ts):
 * ConfigModule.forRoot validates process.env at import time, so overrides must
 * land first. Keeps integration runs quiet and transport-free regardless of
 * the developer's .env.
 */
process.env.NODE_ENV = 'test';
if (!process.env.LOG_LEVEL || process.env.LOG_LEVEL === 'debug') {
  process.env.LOG_LEVEL = 'warn';
}
