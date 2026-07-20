/**
 * Import FIRST (before postback-app) in specs that measure webhook intake
 * latency: the app boots without the in-process BullMQ worker, mirroring the
 * production split-process deployment (intake node + worker node — see
 * PostbackWorker docs). The spec drains the queue with its own Worker after
 * the measurement window.
 */
process.env.POSTBACK_WORKER_ENABLED = 'false';
