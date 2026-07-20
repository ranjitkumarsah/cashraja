/**
 * Import FIRST (before postback-app) in specs that want the in-process
 * worker. Explicit because jest reuses worker processes across test files —
 * a sibling spec may have set POSTBACK_WORKER_ENABLED=false in this process.
 */
process.env.POSTBACK_WORKER_ENABLED = 'true';
