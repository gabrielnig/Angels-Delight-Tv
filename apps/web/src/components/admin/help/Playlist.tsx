import { articleHref } from '@/lib/admin/help-map';
import type { ProgressRows } from '@/lib/data/admin/help-progress';
import type { Article } from '@ad/help';
import Link from 'next/link';
import { Icon } from '../Icon';
import { clock } from './format';

/** The videos of a path, in order, with what this person has watched. Up next never starts by itself (M50-S06). */
export function Playlist({
  title,
  articles,
  currentId,
  progress,
}: {
  title: string;
  articles: Article[];
  currentId: string;
  progress: ProgressRows;
}) {
  const videos = articles.filter((a) => a.meta.video);
  const at = videos.findIndex((a) => a.meta.id === currentId);
  const next = at >= 0 ? videos[at + 1] : undefined;
  return (
    <nav className="hlp-playlist adm-card" aria-label={`Videos in ${title}`}>
      <h2 className="adm-h3">{title}</h2>
      <ol>
        {videos.map((a) => (
          <li key={a.meta.id}>
            <Link
              href={`/admin/help/videos/${a.meta.id}`}
              aria-current={a.meta.id === currentId ? 'true' : undefined}
            >
              <span className="hlp-playlist__state">
                {progress[a.meta.id]?.watched ? (
                  <Icon name="check" size={16} label="Watched" />
                ) : (
                  <Icon name="play" size={16} />
                )}
              </span>
              <span className="hlp-playlist__title">{a.meta.title}</span>
              <span className="hlp-playlist__time">{clock(a.meta.watchSeconds ?? 0)}</span>
            </Link>
          </li>
        ))}
      </ol>
      {next ? (
        <p className="hlp-upnext">
          Up next: <Link href={`/admin/help/videos/${next.meta.id}`}>{next.meta.title}</Link>
        </p>
      ) : (
        <p className="hlp-upnext">
          That is the last video here. <Link href={articleHref(currentId)}>Read the guide</Link>
        </p>
      )}
    </nav>
  );
}
