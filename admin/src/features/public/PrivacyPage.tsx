import { ContentPage } from './ContentPage';
import { PolicyRenderer } from './PolicyRenderer';
import { LAST_UPDATED, PRIVACY_POLICY } from './legalContent';

/** Public Privacy Policy — this URL is referenced by the Google Play listing.
 *  Copy mirrors the in-app policy (`app/lib/features/legal/legal_content.dart`). */
export function PrivacyPage() {
  return (
    <ContentPage lastUpdated={LAST_UPDATED}>
      <PolicyRenderer content={PRIVACY_POLICY} />
    </ContentPage>
  );
}
