import { InMemorySlidingWindow } from './sliding-window';

/**
 * Explicit window-expiry tests (the off-by-one the testing docs flag). The
 * window is the HALF-OPEN interval (now - windowMs, now]: an event exactly at
 * the cutoff has aged out; one a millisecond newer is still in. InMemory mirrors
 * the Redis ZREMRANGEBYSCORE semantics exactly, so proving it here proves both.
 */
describe('InMemorySlidingWindow', () => {
  const WINDOW = 10_000; // 10s
  let win: InMemorySlidingWindow;

  beforeEach(() => {
    win = new InMemorySlidingWindow();
  });

  it('counts a single hit as 1', async () => {
    expect(await win.hit('k', WINDOW, 1_000)).toBe(1);
  });

  it('accumulates hits inside the window', async () => {
    await win.hit('k', WINDOW, 1_000);
    await win.hit('k', WINDOW, 2_000);
    expect(await win.hit('k', WINDOW, 3_000)).toBe(3);
  });

  it('keeps an event that is one ms INSIDE the window boundary', async () => {
    // event at t=1 ; now=10001 → cutoff = 1 ; event ts (1) is NOT > cutoff (1)…
    // so pick an event strictly inside: t=2, cutoff=1 → 2 > 1 kept.
    await win.hit('k', WINDOW, 2); // event just inside
    const count = await win.hit('k', WINDOW, WINDOW + 1); // now=10001, cutoff=1
    expect(count).toBe(2); // both the t=2 event and this one
  });

  it('drops an event EXACTLY at the cutoff (aged out — the off-by-one)', async () => {
    await win.hit('k', WINDOW, 1); // event at t=1
    // now = 1 + WINDOW → cutoff = 1 ; event ts 1 is NOT > 1 → expired.
    const count = await win.hit('k', WINDOW, 1 + WINDOW);
    expect(count).toBe(1); // only the current hit remains
  });

  it('drops an event just OUTSIDE the window', async () => {
    await win.hit('k', WINDOW, 1_000);
    // now = 1000 + WINDOW + 5 → cutoff = 1005 > 1000 → old event expired.
    const count = await win.hit('k', WINDOW, 1_000 + WINDOW + 5);
    expect(count).toBe(1);
  });

  it('count() reads the window without recording a new hit', async () => {
    await win.hit('k', WINDOW, 1_000);
    await win.hit('k', WINDOW, 2_000);
    expect(await win.count('k', WINDOW, 3_000)).toBe(2);
    // still 2 — count did not add anything
    expect(await win.count('k', WINDOW, 3_000)).toBe(2);
  });

  it('isolates counters per key', async () => {
    await win.hit('a', WINDOW, 1_000);
    await win.hit('a', WINDOW, 1_500);
    expect(await win.count('b', WINDOW, 2_000)).toBe(0);
  });

  it('reset clears a counter', async () => {
    await win.hit('k', WINDOW, 1_000);
    await win.reset('k');
    expect(await win.count('k', WINDOW, 1_500)).toBe(0);
  });

  it('a slow trickle never exceeds 1 in-window (rolling expiry)', async () => {
    // one hit every full window → each is alone in its window
    let count = 0;
    for (let i = 1; i <= 5; i++) {
      count = await win.hit('k', WINDOW, i * (WINDOW + 1));
    }
    expect(count).toBe(1);
  });
});
