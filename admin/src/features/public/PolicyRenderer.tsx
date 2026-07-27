import { Fragment, type ReactNode } from 'react';

/**
 * Minimal markdown-ish renderer for the legal copy in `legalContent.ts`.
 * Mirrors the syntax the in-app `PolicyScreen` supports so the public and
 * in-app policies read identically:
 *   - `# ` → page title (h1)
 *   - `## ` → section heading (h2)
 *   - `- ` → bullet list item (continuation lines may be indented)
 *   - blank line → paragraph break; hard-wrapped lines are joined with a space
 *
 * Email addresses in the text are linkified as `mailto:` links.
 */

type Block =
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] };

function parse(content: string): Block[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];

  let paragraph: string[] = [];
  let list: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: 'p', text: paragraph.join(' ').trim() });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ kind: 'ul', items: list });
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.trim() === '') {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      blocks.push({ kind: 'h2', text: line.slice(3).trim() });
      continue;
    }
    if (line.startsWith('# ')) {
      flushParagraph();
      flushList();
      blocks.push({ kind: 'h1', text: line.slice(2).trim() });
      continue;
    }
    if (line.startsWith('- ')) {
      flushParagraph();
      if (!list) list = [];
      list.push(line.slice(2).trim());
      continue;
    }
    // Indented continuation of the current bullet, else part of a paragraph.
    if (list && /^\s+/.test(raw)) {
      list[list.length - 1] += ' ' + line.trim();
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  return blocks;
}

const EMAIL_SPLIT = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const EMAIL_MATCH = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/** Split text on email addresses and render them as mailto links. */
function linkify(text: string): ReactNode {
  const parts = text.split(EMAIL_SPLIT);
  return parts.map((part, i) =>
    EMAIL_MATCH.test(part) ? (
      <a
        key={i}
        href={`mailto:${part}`}
        className="font-medium text-primary-600 underline decoration-primary-300 underline-offset-2 hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-200"
      >
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export function PolicyRenderer({ content }: { content: string }) {
  const blocks = parse(content);
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'h1':
            return (
              <h1 key={i} className="text-3xl font-bold tracking-tight text-ink">
                {block.text}
              </h1>
            );
          case 'h2':
            return (
              <h2 key={i} className="pt-4 text-lg font-semibold text-ink">
                {block.text}
              </h2>
            );
          case 'ul':
            return (
              <ul key={i} className="list-disc space-y-2 pl-5 text-ink-muted marker:text-gold-500">
                {block.items.map((item, j) => (
                  <li key={j} className="leading-relaxed">
                    {linkify(item)}
                  </li>
                ))}
              </ul>
            );
          case 'p':
            return (
              <p key={i} className="leading-relaxed text-ink-muted">
                {linkify(block.text)}
              </p>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
