import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { navItemsForRole } from '../../lib/nav';
import { useAuth } from '../../lib/auth/auth-context';
import { CoinMark } from '../CoinMark';

export function Sidebar() {
  const { admin } = useAuth();
  if (!admin) return null;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-edge bg-surface-raised">
      <div className="flex items-center gap-3 px-5 py-5">
        <CoinMark className="size-9" />
        <div className="leading-tight">
          <p className="text-base font-bold tracking-tight text-ink">
            Cash <span className="text-gold-500">Raja</span>
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">
            Admin
          </p>
        </div>
      </div>

      <nav aria-label="Main navigation" className="flex-1 space-y-1 px-3 py-2">
        {navItemsForRole(admin.role).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60',
                isActive
                  ? 'bg-primary-900 text-white shadow-sm dark:bg-primary-700'
                  : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
              )
            }
          >
            <item.icon className="size-4.5" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <p className="px-5 py-4 text-[11px] text-ink-faint">Raja console · v0.1</p>
    </aside>
  );
}
