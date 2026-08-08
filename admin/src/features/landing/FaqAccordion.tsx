import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';
import { FAQ_ITEMS } from './faq';

interface FaqAccordionProps {
  /**
   * Heading level for each question. The landing page nests the accordion
   * under an <h2> section heading, so questions are <h3> there; the standalone
   * /faq page puts them directly under its <h1>, where <h3> would skip a level.
   */
  headingLevel?: 'h2' | 'h3';
}

/** Accessible accordion of FAQ Q&As, shared by the landing FAQ section and the
 *  standalone `/faq` page. */
export function FaqAccordion({ headingLevel = 'h3' }: FaqAccordionProps = {}) {
  const [open, setOpen] = useState<number | null>(0);
  const Heading = headingLevel;

  return (
    <div className="space-y-3">
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={item.q}
            className="overflow-hidden rounded-xl border border-edge bg-surface-raised"
          >
            <Heading>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60"
              >
                <span className="text-sm font-semibold text-ink sm:text-base">{item.q}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    'size-5 shrink-0 text-gold-500 transition-transform duration-200',
                    isOpen && 'rotate-180',
                  )}
                />
              </button>
            </Heading>
            {isOpen && (
              <p className="px-5 pb-5 text-sm leading-relaxed text-ink-muted">{item.a}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
