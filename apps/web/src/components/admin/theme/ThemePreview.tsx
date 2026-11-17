'use client';

/* eslint-disable @next/next/no-img-element -- logo previews are data urls, there is nothing to optimise */

import type { CSSProperties } from 'react';
import { Button, Hero, VideoCard } from '@ad/ui';
import { buildThemeVariables, type ThemeValues } from '@ad/theme/client';
import type { LogoDto } from '@/lib/data/admin/theme-types';
import '@ad/ui/components.css';
import './preview.css';

export type PreviewScreen = 'home' | 'watch' | 'signin';
export type PreviewDevice = 'desktop' | 'mobile';

const SAMPLE_TITLES = [
  { title: 'Saving a Little Each Day', seconds: 312 },
  { title: 'Rivers of Africa', seconds: 254 },
  { title: 'How Plants Make Food', seconds: 190 },
  { title: 'Telling the Time', seconds: 128 },
];

/**
 * The draft theme applied to sample screens, without saving. The variables are set on a wrapper, so nothing
 * outside it changes (the admin keeps its own look). The content is inert: it is a picture of the site, not
 * a working copy.
 */
export function ThemePreview({
  theme,
  platformName,
  logo,
  screen,
  device,
}: {
  theme: ThemeValues;
  platformName: string;
  logo: LogoDto | null;
  screen: PreviewScreen;
  device: PreviewDevice;
}) {
  const style = buildThemeVariables(theme) as CSSProperties;
  return (
    <div
      className="adt-preview"
      data-device={device}
      data-screen={screen}
      style={style}
      role="img"
      aria-label={`Preview of the ${screen === 'signin' ? 'sign in' : screen} screen with your draft theme`}
    >
      <div className="adt-preview__page" inert>
        <PreviewNav platformName={platformName} logo={logo} />
        {screen === 'home' ? <HomeScreen platformName={platformName} /> : null}
        {screen === 'watch' ? <WatchScreen /> : null}
        {screen === 'signin' ? <SignInScreen platformName={platformName} /> : null}
      </div>
    </div>
  );
}

function PreviewNav({ platformName, logo }: { platformName: string; logo: LogoDto | null }) {
  return (
    <div className="adt-pnav">
      {logo ? (
        <img className="adt-pnav__logo" src={logo.dataUrl} alt="" />
      ) : (
        <span className="adt-pnav__name">{platformName}</span>
      )}
      <span className="adt-pnav__links">
        <span aria-current="page">Home</span>
        <span>Browse</span>
        <span>My List</span>
      </span>
    </div>
  );
}

function HomeScreen({ platformName }: { platformName: string }) {
  return (
    <>
      <Hero
        label={`${platformName} featured`}
        items={[
          {
            id: 'sample',
            title: SAMPLE_TITLES[0]!.title,
            description: 'Small habits that add up. A short lesson for the whole family.',
            playHref: '#',
            infoHref: '#',
          },
        ]}
      />
      <section className="adt-prow" aria-label="New this week">
        <h3 className="adt-prow__title">New this week</h3>
        <div className="adt-prow__cards">
          {SAMPLE_TITLES.map((item) => (
            <VideoCard
              key={item.title}
              title={item.title}
              href="#"
              durationSeconds={item.seconds}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function WatchScreen() {
  return (
    <div className="adt-watch">
      <div className="adt-watch__player" aria-hidden="true">
        <span className="adt-watch__play" />
        <span className="adt-watch__rail">
          <span className="adt-watch__fill" />
        </span>
      </div>
      <h3 className="adt-watch__title">{SAMPLE_TITLES[0]!.title}</h3>
      <p className="adt-watch__meta">5 min, captions on</p>
      <div className="adt-watch__actions">
        <Button variant="primary">My List</Button>
        <Button variant="secondary">Share</Button>
      </div>
      <h4 className="adt-prow__title">Up next</h4>
      <ul className="adt-watch__next">
        {SAMPLE_TITLES.slice(1).map((item, index) => (
          <li key={item.title} className="adt-tile" data-tone={index}>
            <span className="adt-tile__label">Up next</span>
            <span className="adt-tile__title">{item.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SignInScreen({ platformName }: { platformName: string }) {
  return (
    <div className="adt-signin">
      <h3 className="adt-signin__title">Sign in to {platformName}</h3>
      <div className="adt-signin__field">Email</div>
      <div className="adt-signin__field">Password</div>
      <Button variant="primary" fullWidth>
        Sign in
      </Button>
      <span className="adt-signin__link">Forgot your password?</span>
    </div>
  );
}
