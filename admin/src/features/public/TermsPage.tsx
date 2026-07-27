import { ContentPage } from './ContentPage';
import { PolicyRenderer } from './PolicyRenderer';
import { LAST_UPDATED, TERMS } from './legalContent';

/** Public Terms & Conditions — mirrors the in-app copy. */
export function TermsPage() {
  return (
    <ContentPage lastUpdated={LAST_UPDATED}>
      <PolicyRenderer content={TERMS} />
    </ContentPage>
  );
}
