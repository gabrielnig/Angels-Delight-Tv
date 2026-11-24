'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Icon } from '@ad/ui';
import {
  VOICE_LANGUAGES,
  readVoiceOk,
  saveVoiceOk,
  speechConstructor,
  transcriptOf,
  voiceErrorMessage,
  type RecognitionConstructor,
  type RecognitionLike,
  type SpeechWindow,
} from './voice';
import './voice.css';

type Phase = 'idle' | 'asking' | 'listening';

function deviceStore(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The microphone toggle in the search box (M45-S10, S134). The parent decides whether to render it at all (not for
 * Kids, not under Data saver). It never starts by itself: the first press asks once, because the browser may send
 * the audio to its speech service. It passes the words on as they come and never stores them.
 */
export function VoiceSearchButton({ onText }: { onText: (text: string, final: boolean) => void }) {
  const [ctor, setCtor] = useState<RecognitionConstructor | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const recognition = useRef<RecognitionLike | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => setCtor(() => speechConstructor(window as unknown as SpeechWindow)), []);

  const start = useCallback(
    (languageIndex: number) => {
      if (!ctor) return;
      const instance = new ctor();
      instance.lang = VOICE_LANGUAGES[languageIndex] ?? 'en-US';
      instance.interimResults = true;
      instance.continuous = false;
      instance.maxAlternatives = 1;
      instance.onresult = (event) => {
        const { text, final } = transcriptOf(event);
        if (text) onTextRef.current(text, final);
      };
      instance.onerror = (event) => {
        if (event.error === 'language-not-supported' && languageIndex + 1 < VOICE_LANGUAGES.length) {
          instance.onend = null;
          start(languageIndex + 1);
          return;
        }
        setMessage(voiceErrorMessage(event.error));
        setPhase('idle');
      };
      instance.onend = () => {
        if (recognition.current === instance) recognition.current = null;
        setPhase('idle');
      };
      recognition.current = instance;
      setMessage(null);
      setPhase('listening');
      try {
        instance.start();
      } catch {
        setMessage(voiceErrorMessage('other'));
        setPhase('idle');
      }
    },
    [ctor],
  );

  useEffect(() => {
    if (phase === 'asking') dialog.current?.querySelector<HTMLButtonElement>('button:last-of-type')?.focus();
  }, [phase]);

  useEffect(() => {
    if (phase === 'idle') return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (phase === 'listening') recognition.current?.stop();
      setPhase('idle');
      trigger.current?.focus();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  useEffect(
    () => () => {
      const current = recognition.current;
      if (current) {
        current.onend = null;
        current.onerror = null;
        current.abort();
      }
    },
    [],
  );

  if (!ctor) return null;

  function toggle() {
    if (phase === 'listening') {
      recognition.current?.stop();
      return;
    }
    if (phase === 'asking') return;
    setMessage(null);
    if (readVoiceOk(deviceStore())) start(0);
    else setPhase('asking');
  }

  const listening = phase === 'listening';
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="web-voice"
        aria-pressed={listening}
        aria-label={listening ? 'Stop listening' : 'Search by voice'}
        data-listening={listening || undefined}
        onMouseDown={(event) => event.preventDefault()}
        onClick={toggle}
      >
        <Icon name="mic" size={20} aria-hidden="true" />
      </button>
      {phase === 'asking' ? (
        <div ref={dialog} className="web-voice__ask" role="dialog" aria-label="Use your voice to search?">
          <p className="web-voice__title">Use your voice to search?</p>
          <p className="web-voice__text">
            Your browser may send what you say to its speech service. We do not store what you say.
          </p>
          <p className="web-voice__text">We will not ask again on this device.</p>
          <div className="web-voice__buttons">
            <Button
              variant="secondary"
              onClick={() => {
                setPhase('idle');
                trigger.current?.focus();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                saveVoiceOk(deviceStore());
                start(0);
              }}
            >
              Continue
            </Button>
          </div>
        </div>
      ) : null}
      <div className="web-voice__live">
        {listening ? (
          <p role="status" className="web-voice__note">
            Listening. Say a subject or a title. Press Escape to stop.
          </p>
        ) : null}
        {message ? (
          <p role="alert" className="web-voice__note web-voice__note--error">
            {message}
          </p>
        ) : null}
      </div>
    </>
  );
}
