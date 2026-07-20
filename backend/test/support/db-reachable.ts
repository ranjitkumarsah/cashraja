import { spawnSync } from 'node:child_process';

/**
 * Synchronous reachability probe so integration suites can decide
 * describe vs describe.skip at collection time (Jest offers no async gate
 * there). Returns true only when DATABASE_URL is set AND its host:port
 * accepts a TCP connection.
 */
export function isDatabaseReachable(): boolean {
  const url = process.env.DATABASE_URL;
  if (!url) return false;

  let host: string;
  let port: number;
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    port = parsed.port !== '' ? Number(parsed.port) : 5432;
  } catch {
    return false;
  }

  // Generous timeouts: under a fully parallel jest run the probe process can
  // take seconds just to start — a false negative silently skips the suite.
  const probe =
    `const s=require('net').connect({host:${JSON.stringify(host)},port:${port},timeout:5000});` +
    `s.on('connect',()=>{s.end();process.exit(0);});` +
    `s.on('error',()=>process.exit(1));` +
    `s.on('timeout',()=>{s.destroy();process.exit(1);});`;
  const result = spawnSync(process.execPath, ['-e', probe], { timeout: 30000 });
  return result.status === 0;
}
