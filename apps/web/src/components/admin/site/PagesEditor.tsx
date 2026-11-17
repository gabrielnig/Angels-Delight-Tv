'use client';

import { useRef, useState } from 'react';
import { PAGE_SLUGS, PAGE_TITLES, sanitizeHtml, type PageSlug } from '@ad/theme/client';
import type { PageDto, SiteSettingsDto } from '@/lib/data/admin/site-types';
import type { ActionResult } from '@/lib/data/admin/theme-types';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { ConfirmDialog } from '../Dialog';
import { TextArea, TextField } from '../fields';
import { Banner } from '../states';
import { useToast } from '../Toast';
import { applyFormat, applyLink, type Edit, type Format } from './page-format';

export interface PageActions {
  savePage(slug: PageSlug, body: string): Promise<ActionResult<PageDto>>;
  publishPage(slug: PageSlug): Promise<ActionResult<SiteSettingsDto>>;
  restorePage(slug: PageSlug, version: number): Promise<ActionResult<PageDto>>;
}

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Africa/Lagos',
  }).format(new Date(iso));

const TOOLS: { format: Format; label: string; text: string }[] = [
  { format: 'bold', label: 'Bold', text: 'B' },
  { format: 'italic', label: 'Italic', text: 'I' },
  { format: 'h2', label: 'Heading', text: 'H2' },
  { format: 'bullets', label: 'Bulleted list', text: 'List' },
];

/**
 * Simple page editor (M26-S02): HTML in a text box with a toolbar, a preview of what viewers will see (after
 * the same sanitiser the server uses), draft and publish, and versions with restore.
 */
export function PagesEditor({
  pages,
  actions,
  onPublished,
}: {
  pages: Record<PageSlug, PageDto>;
  actions: PageActions;
  onPublished: (data: SiteSettingsDto) => void;
}) {
  const toast = useToast();
  const [slug, setSlug] = useState<PageSlug>('terms');
  const [local, setLocal] = useState(pages);
  const page = local[slug];
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const body = bodies[slug] ?? page.draftBody;
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState<'save' | 'publish' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState<string | undefined>();
  const [restoring, setRestoring] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const textarea = () => wrap.current?.querySelector('textarea') ?? null;

  const dirty = body !== page.draftBody;
  const savedAsDraft = dirty ? false : page.hasDraft;

  function edit(next: Edit) {
    setBodies((current) => ({ ...current, [slug]: next.text }));
    requestAnimationFrame(() => {
      const el = textarea();
      el?.focus();
      el?.setSelectionRange(next.start, next.end);
    });
  }

  function format(kind: Format) {
    const el = textarea();
    edit(
      applyFormat(body, el?.selectionStart ?? body.length, el?.selectionEnd ?? body.length, kind),
    );
  }

  function insertLink() {
    const el = textarea();
    const next = applyLink(
      body,
      el?.selectionStart ?? body.length,
      el?.selectionEnd ?? body.length,
      link,
    );
    if (!next) {
      setLinkError('Use a full https:// link, a mailto: address or a path that starts with /');
      return;
    }
    edit(next);
    setLink('');
    setLinkError(undefined);
    setLinkOpen(false);
  }

  async function save(): Promise<boolean> {
    setBusy('save');
    setError(null);
    const result = await actions.savePage(slug, body);
    setBusy(null);
    if (!result.ok) {
      setError(result.fields?.body?.[0] ?? result.message);
      return false;
    }
    setLocal((current) => ({ ...current, [slug]: result.data }));
    setBodies((current) => ({ ...current, [slug]: result.data.draftBody }));
    return true;
  }

  async function publish() {
    if (dirty && !(await save())) return;
    setBusy('publish');
    const result = await actions.publishPage(slug);
    setBusy(null);
    if (!result.ok) {
      setError(result.fields?.body?.[0] ?? result.message);
      return;
    }
    setLocal(result.data.pages);
    setBodies((current) => ({ ...current, [slug]: result.data.pages[slug].draftBody }));
    onPublished(result.data);
    toast.show({
      message: `${PAGE_TITLES[slug]} published as version ${result.data.pages[slug].published?.version}.`,
      tone: 'success',
    });
  }

  async function restore() {
    if (restoring === null) return;
    setBusy('restore');
    const result = await actions.restorePage(slug, restoring);
    setBusy(null);
    const version = restoring;
    setRestoring(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setLocal((current) => ({ ...current, [slug]: result.data }));
    setBodies((current) => ({ ...current, [slug]: result.data.draftBody }));
    toast.show({
      message: `Version ${version} copied into the draft. Publish when you are ready.`,
      tone: 'info',
    });
  }

  return (
    <div className="ads-pages">
      <div className="adm-row" role="group" aria-label="Page">
        {PAGE_SLUGS.map((item) => (
          <Button
            key={item}
            variant={slug === item ? 'primary' : 'secondary'}
            aria-pressed={slug === item}
            onClick={() => {
              setSlug(item);
              setPreview(false);
              setError(null);
            }}
          >
            {PAGE_TITLES[item]}
          </Button>
        ))}
      </div>

      {page.isPlaceholder ? (
        <Banner tone="warning">
          <strong>
            {page.published ? 'The published text looks like a placeholder.' : 'Placeholder text.'}
          </strong>{' '}
          Replace it with the real {PAGE_TITLES[slug].toLowerCase()} before launch.
        </Banner>
      ) : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <div className="ads-pages__grid">
        <div className="ads-editor">
          <div className="ads-toolbar" role="toolbar" aria-label="Formatting">
            {TOOLS.map((tool) => (
              <Button
                key={tool.format}
                variant="secondary"
                aria-label={tool.label}
                onClick={() => format(tool.format)}
                disabled={preview}
              >
                {tool.text}
              </Button>
            ))}
            <Button
              variant="secondary"
              aria-expanded={linkOpen}
              onClick={() => setLinkOpen((open) => !open)}
              disabled={preview}
            >
              Link
            </Button>
            <Button
              variant="ghost"
              aria-pressed={preview}
              onClick={() => setPreview((value) => !value)}
            >
              {preview ? 'Edit' : 'Preview'}
            </Button>
          </div>
          {linkOpen && !preview ? (
            <div className="ads-link">
              <TextField
                label="Link address"
                value={link}
                onChange={(event) => setLink(event.target.value)}
                error={linkError}
                hint="For example https://example.com or /help"
              />
              <Button variant="secondary" onClick={insertLink}>
                Add link
              </Button>
            </div>
          ) : null}
          {preview ? (
            <div
              className="ads-preview"
              aria-label={`Preview of ${PAGE_TITLES[slug]}`}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(body) }}
            />
          ) : (
            <div ref={wrap}>
              <TextArea
                label={PAGE_TITLES[slug]}
                value={body}
                rows={14}
                spellCheck
                onChange={(event) =>
                  setBodies((current) => ({ ...current, [slug]: event.target.value }))
                }
                hint="Headings, paragraphs, lists and links only. Anything else is removed when you save."
              />
            </div>
          )}
          <div className="adm-form-actions">
            {dirty ? (
              <Badge tone="warning" icon="alert">
                Unsaved changes
              </Badge>
            ) : savedAsDraft ? (
              <Badge tone="neutral" icon="file">
                Draft saved
              </Badge>
            ) : null}
            <Button
              variant="secondary"
              loading={busy === 'save'}
              disabledReason={dirty ? undefined : 'No changes to save.'}
              onClick={() => void save()}
            >
              Save draft
            </Button>
            <Button
              variant="primary"
              loading={busy === 'publish'}
              disabledReason={dirty || page.hasDraft ? undefined : 'Edit the page first.'}
              onClick={() => void publish()}
            >
              Save new version
            </Button>
          </div>
        </div>

        <aside className="ads-versions" aria-label="Versions">
          <h3 className="adm-h3">Versions</h3>
          {page.versions.length === 0 ? (
            <p className="adm-muted">Nothing published yet. The first version appears here.</p>
          ) : (
            <ul className="adm-list">
              {page.versions.map((version, index) => (
                <li key={version.version}>
                  <span>
                    {`v${version.version}, ${when(version.publishedAt)}`}
                    {index === 0 ? ' (live)' : ''}
                  </span>
                  {index === 0 ? null : (
                    <Button
                      variant="ghost"
                      aria-label={`Restore version ${version.version}`}
                      onClick={() => setRestoring(version.version)}
                    >
                      Restore
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={restoring !== null}
        title={restoring === null ? '' : `Restore version v${restoring}?`}
        consequence="This copies that version into the draft and replaces the draft you have now. Viewers keep seeing the live version until you publish."
        confirmLabel="Restore as draft"
        busy={busy === 'restore'}
        onConfirm={() => void restore()}
        onClose={() => setRestoring(null)}
      />
    </div>
  );
}
