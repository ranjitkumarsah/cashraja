import type { LucideIcon } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent } from '../../components/ui/Card';

export interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

/** Elegant stub for feature screens that arrive with the Phase C admin API. */
export function PlaceholderPage({ title, description, icon: Icon }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      </div>

      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-100 dark:bg-primary-900/50">
            <Icon className="size-7 text-primary-700 dark:text-primary-300" aria-hidden="true" />
          </span>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-ink">{title} is on its way</h2>
            <p className="max-w-sm text-sm text-ink-muted">
              This screen lights up once the corresponding admin API lands. The navigation,
              permissions and design system are already in place.
            </p>
          </div>
          <Badge variant="gold">Coming in Phase C</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
