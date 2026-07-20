import { useNavigate } from 'react-router-dom';
import { LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../lib/auth/auth-context';
import { useTheme } from '../../lib/theme/theme-context';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

function roleBadge(role: 'reviewer' | 'super_admin') {
  return role === 'super_admin' ? (
    <Badge variant="gold">Super Admin</Badge>
  ) : (
    <Badge variant="indigo">Reviewer</Badge>
  );
}

export function Topbar() {
  const { admin, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut();
    navigate('/login', { replace: true });
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-edge bg-surface-raised px-6">
      <div />
      <div className="flex items-center gap-4">
        {admin && (
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-medium text-ink">{admin.email}</span>
            {roleBadge(admin.role)}
          </div>
        )}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60"
        >
          {theme === 'dark' ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
        </button>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="size-4" aria-hidden="true" />
          Log out
        </Button>
      </div>
    </header>
  );
}
