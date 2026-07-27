import { useRef, type ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Textarea } from '../../components/ui/Textarea';

/**
 * H7 — Markdown authoring for a manual offer's `instructions`: a small
 * formatting toolbar that inserts Markdown around the current selection, plus a
 * live preview rendered by a minimal, XSS-safe renderer (no dangerouslySet-
 * InnerHTML). The value is a plain Markdown string stored in the existing
 * `instructions` field — no schema change.
 */
export function InstructionsField({
  registration,
  value,
  error,
  onValueChange,
}: {
  registration: UseFormRegisterReturn;
  value: string;
  error?: string;
  onValueChange: (next: string) => void;
}) {
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const { ref: registerRef, ...registerRest } = registration;

  // RHF's register().ref is always a RefCallback — invoke it and keep our own
  // node reference for cursor-aware toolbar insertions.
  const setRefs = (el: HTMLTextAreaElement | null) => {
    areaRef.current = el;
    registerRef(el);
  };

  /** Replace the current selection (or insert a placeholder) and re-select it. */
  const surround = (before: string, after: string, placeholder: string) => {
    const el = areaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const selected = el.value.slice(start, end) || placeholder;
    const next = el.value.slice(0, start) + before + selected + after + el.value.slice(end);
    onValueChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + before.length;
      el.setSelectionRange(pos, pos + selected.length);
    });
  };

  /** Prefix each selected line with `1.`, `2.`, … (numbered list). */
  const numberedList = () => {
    const el = areaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const selected = el.value.slice(start, end) || 'List item';
    const numbered = selected
      .split('\n')
      .map((line, i) => `${i + 1}. ${line}`)
      .join('\n');
    const next = el.value.slice(0, start) + numbered + el.value.slice(end);
    onValueChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start + numbered.length);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Instructions formatting">
        <ToolbarButton label="Bold" title="Bold" onClick={() => surround('**', '**', 'bold text')}>
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton
          label="Link"
          title="Insert link"
          onClick={() => surround('[', '](https://)', 'link text')}
        >
          <span className="underline">Link</span>
        </ToolbarButton>
        <ToolbarButton label="Code" title="Inline code" onClick={() => surround('`', '`', 'code')}>
          <span className="font-mono">{'</>'}</span>
        </ToolbarButton>
        <ToolbarButton label="Numbered list" title="Numbered list" onClick={numberedList}>
          1.
        </ToolbarButton>
      </div>

      <Textarea
        label="Instructions"
        rows={5}
        placeholder="Markdown supported — **bold**, [links](https://…), `code`, and lists."
        error={error}
        ref={setRefs}
        {...registerRest}
      />

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">Preview</p>
        <div className="rounded-lg border border-edge bg-surface-muted/40 p-3">
          <MarkdownPreview source={value} />
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  title,
  onClick,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      onClick={onClick}
      className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-edge bg-surface-raised px-2 text-sm text-ink hover:bg-surface-muted"
    >
      {children}
    </button>
  );
}

/**
 * Minimal, safe Markdown → React renderer. Supports **bold**, `code`,
 * [text](url) links (http/https/mailto only — other schemes render as plain
 * text), and bullet / numbered lists. Everything is emitted as React elements,
 * so text is escaped by React and there is no HTML injection surface.
 */
export function MarkdownPreview({ source }: { source: string }) {
  const value = (source ?? '').trim();
  if (value === '') {
    return <p className="text-sm text-ink-faint">Nothing to preview yet.</p>;
  }

  const lines = value.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*[-*]\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(
          <li key={key++}>{renderInline(lines[i].replace(/^\s*[-*]\s+/, ''), key)}</li>,
        );
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc space-y-1 pl-5">
          {items}
        </ul>,
      );
    } else if (/^\s*\d+\.\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(
          <li key={key++}>{renderInline(lines[i].replace(/^\s*\d+\.\s+/, ''), key)}</li>,
        );
        i++;
      }
      blocks.push(
        <ol key={key++} className="list-decimal space-y-1 pl-5">
          {items}
        </ol>,
      );
    } else if (line.trim() === '') {
      i++;
    } else {
      blocks.push(<p key={key++}>{renderInline(line, key)}</p>);
      i++;
    }
  }

  return <div className="space-y-2 text-sm text-ink [&_a]:text-gold-600 [&_a]:underline [&_code]:rounded [&_code]:bg-surface-raised [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs">{blocks}</div>;
}

const INLINE = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)/g;
const SAFE_URL = /^(https?:|mailto:)/i;

function renderInline(text: string, keyBase: number): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let n = 0;
  let match: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyBase}-${n++}`;
    if (token.startsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('[')) {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (link && SAFE_URL.test(link[2])) {
        nodes.push(
          <a key={key} href={link[2]} target="_blank" rel="noopener noreferrer">
            {link[1]}
          </a>,
        );
      } else if (link) {
        // Unsafe scheme — render the label as plain text, drop the link.
        nodes.push(link[1]);
      } else {
        nodes.push(token);
      }
    } else {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
