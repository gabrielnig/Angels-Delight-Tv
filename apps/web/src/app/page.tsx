import { DEFAULT_PLATFORM_NAME } from '../lib/platform';

export default function HomePage() {
  return (
    <main className="home">
      <h1 className="home__title">{DEFAULT_PLATFORM_NAME}</h1>
      <p className="home__lead">
        Free learning videos for everyone. The viewing experience is on its way.
      </p>
    </main>
  );
}
