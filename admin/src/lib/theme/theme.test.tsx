import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY, ThemeProvider, useTheme } from './theme-context';
import { renderApp, seedSession, superAdmin } from '../../test/utils';

// The app shell's index route renders the data-fetching dashboard; mock the
// shared axios instance so it resolves instead of reaching a real backend.
const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
vi.mock('axios', () => {
  const instance = {
    get: mockGet,
    post: vi.fn(),
    patch: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  };
  return { default: { create: () => instance, isAxiosError: () => false } };
});

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockResolvedValue({
    data: {
      current: {
        dau: 0,
        coins_issued: 0,
        coins_redeemed: 0,
        offer_completion_rate: 0,
        outstanding_liability: 0,
      },
      series: [],
    },
  });
});

function Probe() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme}>
      theme:{theme}
    </button>
  );
}

describe('theme toggle', () => {
  it('defaults to light and persists the choice', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByRole('button')).toHaveTextContent('theme:light');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('toggles to dark: applies the class and persists to localStorage', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button'));

    expect(screen.getByRole('button')).toHaveTextContent('theme:dark');
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('restores a persisted dark preference on startup', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByRole('button')).toHaveTextContent('theme:dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('is wired into the topbar of the app shell', async () => {
    seedSession(superAdmin);
    const user = userEvent.setup();
    renderApp('/');

    const toggle = await screen.findByRole('button', { name: 'Switch to dark theme' });
    await user.click(toggle);

    expect(document.documentElement).toHaveClass('dark');
    expect(await screen.findByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });
});
