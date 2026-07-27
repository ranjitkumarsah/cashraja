import { ContentPage } from './ContentPage';
import { FaqAccordion } from '../landing/FaqAccordion';

/** Standalone FAQ page — reuses the landing FAQ accordion content. */
export function FaqPage() {
  return (
    <ContentPage>
      <h1 className="text-3xl font-bold tracking-tight text-ink">Frequently asked questions</h1>
      <p className="mt-3 mb-8 text-ink-muted">
        Everything you need to know about earning coins and redeeming gift cards on Cash Raja.
      </p>
      <FaqAccordion />
    </ContentPage>
  );
}
