import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { listUsers } from '../../lib/api/users';
import type { AdminUserListItem } from '../../lib/api/types';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { notificationKeys } from './keys';

export interface SelectedUser {
  id: string;
  email: string;
}

/**
 * Searchable multi-select of users by email (H8 audience picker). Debounces the
 * query into the existing GET /admin/users?search= endpoint and renders picked
 * users as removable chips. No new dependency — built on Input + Badge.
 */
export function UserPicker({
  selected,
  onChange,
  error,
}: {
  selected: SelectedUser[];
  onChange: (next: SelectedUser[]) => void;
  error?: string;
}) {
  const [input, setInput] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input.trim()), 250);
    return () => clearTimeout(t);
  }, [input]);

  const query = useQuery({
    queryKey: notificationKeys.userSearch(debounced),
    queryFn: () => listUsers({ search: debounced || undefined, limit: 10 }),
    enabled: debounced.length > 0,
  });

  const selectedIds = new Set(selected.map((u) => u.id));
  const results = (query.data?.users ?? []).filter(
    (u: AdminUserListItem) => !selectedIds.has(u.id),
  );

  function add(user: AdminUserListItem) {
    onChange([...selected, { id: user.id, email: user.email }]);
    setInput('');
    setDebounced('');
  }

  function remove(id: string) {
    onChange(selected.filter((u) => u.id !== id));
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          label="Recipients"
          placeholder="Search users by email or name…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          error={error}
        />
        <Search className="pointer-events-none absolute right-3 top-9 size-4 text-ink-faint" />
      </div>

      {debounced.length > 0 && (
        <div className="rounded-lg border border-edge bg-surface-raised">
          {query.isLoading ? (
            <div className="flex items-center gap-2 p-3 text-sm text-ink-muted">
              <Spinner className="size-4" /> Searching…
            </div>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-ink-muted">No matching users.</p>
          ) : (
            <ul className="max-h-56 divide-y divide-edge overflow-auto">
              {results.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-surface-muted"
                    onClick={() => add(user)}
                  >
                    <span className="text-sm font-medium text-ink">{user.email}</span>
                    <span className="text-xs text-ink-muted">{user.display_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {selected.map((user) => (
            <Badge key={user.id} variant="indigo" className="gap-1.5">
              {user.email}
              <button
                type="button"
                aria-label={`Remove ${user.email}`}
                className="rounded-full hover:text-danger-600"
                onClick={() => remove(user.id)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
