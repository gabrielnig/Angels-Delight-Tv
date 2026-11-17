import '@/features/player/watch.css';
import { HOME_PATH, SEARCH_PATH } from '@/features/player/routes';

export default function WatchNotFound() {
  return (
    <main className="watch__message">
      <h1>This video is not available</h1>
      <p>It may have been taken down, or the link may be wrong. Try a search or head home.</p>
      <div className="watch__message-actions">
        <a className="watch__button" href={SEARCH_PATH}>
          Search
        </a>
        <a className="watch__button" href={HOME_PATH}>
          Back to Home
        </a>
      </div>
    </main>
  );
}
