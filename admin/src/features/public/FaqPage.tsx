import { Link } from 'react-router-dom';
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
      {/* h2 here: the questions sit directly under this page's h1, so h3 would
          skip a level. On the landing page they are nested under an h2 section
          heading and stay h3. */}
      <FaqAccordion headingLevel="h2" />
      <p className="mt-8 text-sm text-ink-muted">
        Still deciding?{' '}
        <Link
          to="/blog/is-cash-raja-legit"
          className="font-semibold text-primary-600 hover:underline"
        >
          Read our honest answer to “is Cash Raja legit?”
        </Link>{' '}
        or see{' '}
        <Link to="/how-to-earn" className="font-semibold text-primary-600 hover:underline">
          how to earn coins step by step
        </Link>
        .
      </p>
    </ContentPage>
  );
}
