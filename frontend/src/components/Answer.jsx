
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Icon from './Icon.jsx';

function Cite({ n, sources }) {
  const source = sources.find((item) => item.position === Number(n));

  const chip =
    'mx-0.5 inline-grid h-[1.15em] min-w-[1.15em] place-items-center rounded bg-mark/25 px-1 align-baseline font-sans text-[0.7em] font-bold text-ink no-underline';

  return source?.url ? (
    <a
      className={chip}
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      title={source.title || `Source ${n}`}
    >
      {n}
    </a>
  ) : (
    <span className={chip}>{n}</span>
  );
}

function SourceCard({ source }) {
  let hostname = '';

  try {
    hostname = new URL(source.url).hostname.replace(/^www\./, '');
  } catch {
    hostname = source.url || '';
  }

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-w-0 gap-2 rounded-lg border border-line p-3 text-sm transition-colors hover:border-accent"
    >
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-mark/25 text-xs font-bold">
        {source.position}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block break-words font-medium">
          {source.title || 'Open source'}
        </span>
        {hostname && (
          <span className="mt-1 block truncate text-xs text-mute">
            {hostname}
          </span>
        )}
      </span>

      <Icon name="external-link" className="h-4 w-4 shrink-0 text-mute" />
    </a>
  );
}

export default function Answer({
  message,
  isStreaming,
  onSave,
  onFollowUp,
  followUps,
}) {
  const [copied, setCopied] = useState(false);
  const sources = message.sources || [];

  // Convert citations such as [1] into clickable source references.
  const text = (message.content || '').replace(
    /\[(\d{1,2})\](?!\()/g,
    '[$1](#cite-$1)'
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content || '');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access may be unavailable in some browser contexts.
    }
  };

  return (
    <article className="card min-w-0 p-5" aria-busy={isStreaming}>
      {isStreaming && !message.content && (
        <div className="space-y-3" aria-label="Thinking">
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-2/3" />
        </div>
      )}

      <div className={`answer min-w-0 ${isStreaming && message.content ? 'cursor' : ''}`}>
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 className="mb-4 mt-6 text-2xl font-bold first:mt-0">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="mb-3 mt-6 text-xl font-semibold first:mt-0">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="mb-2 mt-5 text-lg font-semibold">
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p className="mb-3 leading-7 last:mb-0">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="mb-4 list-disc space-y-1 pl-6">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-4 list-decimal space-y-1 pl-6">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="pl-1 leading-7">{children}</li>
            ),
            blockquote: ({ children }) => (
              <blockquote className="my-4 border-l-4 border-accent pl-4 text-mute">
                {children}
              </blockquote>
            ),
            hr: () => <hr className="my-5 border-line" />,
            a: ({ href, children, ...props }) => {
              if (href?.startsWith('#cite-')) {
                return (
                  <Cite
                    n={href.slice(6)}
                    sources={sources}
                  />
                );
              }

              if (href && /^https?:\/\//i.test(href)) {
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline underline-offset-2"
                    {...props}
                  >
                    {children}
                  </a>
                );
              }

              return <span>{children}</span>;
            },
            table: ({ children }) => (
              <div className="my-4 w-full overflow-x-auto rounded-lg border border-line">
                <table className="w-full border-collapse text-left text-sm">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="bg-mark/20">{children}</thead>
            ),
            th: ({ children }) => (
              <th className="border-b border-line px-3 py-2.5 font-semibold">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border-b border-line px-3 py-2.5 align-top">
                {children}
              </td>
            ),
            pre: ({ children }) => (
              <pre className="my-4 overflow-x-auto rounded-lg border border-line bg-paper p-4 text-sm leading-6">
                {children}
              </pre>
            ),
            code: ({ className, children, ...props }) => {
              const isBlock = Boolean(className);

              return isBlock ? (
                <code className={className} {...props}>
                  {children}
                </code>
              ) : (
                <code className="rounded bg-mark/25 px-1.5 py-0.5 text-[0.9em]" {...props}>
                  {children}
                </code>
              );
            },
            strong: ({ children }) => (
              <strong className="font-semibold">{children}</strong>
            ),
          }}
        >
          {text}
        </ReactMarkdown>
      </div>

      {sources.length > 0 && (
        <section className="mt-5 border-t border-line pt-4" aria-label="Sources">
          <h3 className="mb-3 text-sm font-semibold text-mute">
            Sources ({sources.length})
          </h3>

          <div className="grid gap-2 sm:grid-cols-2">
            {sources.map((source) => (
              <SourceCard key={source.position} source={source} />
            ))}
          </div>
        </section>
      )}

      {!isStreaming && message.id && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <button
            className="btn-primary"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() =>
              onSave(
                message,
                window.getSelection()?.toString().trim()
              )
            }
          >
            <Icon name="note" className="h-4 w-4" />
            Save to OneNote
          </button>

          <button className="btn-ghost" onClick={copy}>
            <Icon
              name={copied ? 'check' : 'copy'}
              className="h-4 w-4"
            />
            {copied ? 'Copied' : 'Copy'}
          </button>

          {message.status === 'stopped' && (
            <span className="text-xs text-mute">Stopped early</span>
          )}
        </div>
      )}

      {!isStreaming && followUps?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {followUps.map((followUp) => (
            <button
              key={followUp}
              className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
              onClick={() => onFollowUp(followUp)}
            >
              {followUp}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
