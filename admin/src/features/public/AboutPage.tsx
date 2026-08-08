import { Link } from 'react-router-dom';
import { ContentPage } from './ContentPage';
import { PolicyRenderer } from './PolicyRenderer';
import { ABOUT_US } from './legalContent';

/** Public About Us page — mirrors the in-app copy. */
export function AboutPage() {
  return (
    <ContentPage>
      <PolicyRenderer content={ABOUT_US} />
      {/* Contextual links out of /about. "is Cash Raja legit" is the query this
          page is most likely to be read alongside, and that guide previously had
          only the /blog hub linking to it. */}
      <p className="mt-8 text-sm text-ink-muted">
        Wondering whether this is genuine? Read{' '}
        <Link
          to="/blog/is-cash-raja-legit"
          className="font-semibold text-primary-600 hover:underline"
        >
          is Cash Raja legit — an honest look
        </Link>
        , or see{' '}
        <Link to="/how-to-earn" className="font-semibold text-primary-600 hover:underline">
          how earning and redeeming works
        </Link>
        .
      </p>
    </ContentPage>
  );
}
