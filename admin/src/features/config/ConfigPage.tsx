import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listConfig, updateConfig } from '../../lib/api/config';
import type { ConfigView } from '../../lib/api/types';
import { apiErrorMessage } from '../../lib/api/client';
import { PageHeader } from '../../components/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { EmptyState, ErrorState, LoadingState } from '../../components/QueryState';
import { formatDateTime, humanize } from '../../lib/format';

const configKeys = { all: ['config'] as const };

function EditConfigModal({ entry, onClose }: { entry: ConfigView; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [text, setText] = useState(() => JSON.stringify(entry.value, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (value: Record<string, unknown>) => updateConfig(entry.key, value),
    onSuccess: (updated) => {
      toast({
        variant: 'success',
        title: 'Config updated',
        description: `${entry.key} is now at version ${updated.version}.`,
      });
      queryClient.invalidateQueries({ queryKey: configKeys.all });
      onClose();
    },
    onError: (error) => {
      toast({
        variant: 'error',
        title: 'Update failed',
        description: apiErrorMessage(error, 'Could not update this config key.'),
      });
    },
  });

  const handleSave = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setParseError('Value must be valid JSON.');
      return;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      setParseError('Value must be a JSON object.');
      return;
    }
    setParseError(null);
    mutation.mutate(parsed as Record<string, unknown>);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${entry.key}`}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={mutation.isPending} onClick={handleSave}>
            Save new version
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-ink-muted">
          Current version {entry.version}. Saving appends a new version rather than overwriting.
        </p>
        <label htmlFor="config-json" className="block text-sm font-medium text-ink">
          Value (JSON)
        </label>
        <textarea
          id="config-json"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (parseError) setParseError(null);
          }}
          rows={14}
          spellCheck={false}
          aria-invalid={parseError ? true : undefined}
          className={`coin-num w-full rounded-lg border bg-surface px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/60 ${
            parseError ? 'border-danger-500' : 'border-edge'
          }`}
        />
        {parseError && (
          <p className="text-sm text-danger-600" role="alert">
            {parseError}
          </p>
        )}
      </div>
    </Modal>
  );
}

export function ConfigPage() {
  const [editing, setEditing] = useState<ConfigView | null>(null);
  const query = useQuery({ queryKey: configKeys.all, queryFn: listConfig });

  const entries = [...(query.data ?? [])].sort((a, b) => a.key.localeCompare(b.key));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Config"
        description="Rates, caps, referral percentages and probability tables."
      />

      {query.isLoading ? (
        <LoadingState label="Loading config…" />
      ) : query.isError ? (
        <ErrorState error={query.error} fallback="Could not load config." />
      ) : entries.length === 0 ? (
        <EmptyState title="No config keys" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {entries.map((entry) => (
            <Card key={entry.key}>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-ink">{humanize(entry.key)}</h2>
                    <p className="coin-num text-xs text-ink-faint">{entry.key}</p>
                  </div>
                  <Badge variant="neutral">v{entry.version}</Badge>
                </div>
                <pre className="coin-num max-h-40 overflow-auto rounded-lg border border-edge bg-surface p-3 text-xs text-ink">
                  {JSON.stringify(entry.value, null, 2)}
                </pre>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-faint">
                    Updated {formatDateTime(entry.updated_at)}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => setEditing(entry)}>
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && <EditConfigModal entry={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
