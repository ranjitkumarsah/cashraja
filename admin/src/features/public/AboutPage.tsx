import { ContentPage } from './ContentPage';
import { PolicyRenderer } from './PolicyRenderer';
import { ABOUT_US } from './legalContent';

/** Public About Us page — mirrors the in-app copy. */
export function AboutPage() {
  return (
    <ContentPage>
      <PolicyRenderer content={ABOUT_US} />
    </ContentPage>
  );
}
