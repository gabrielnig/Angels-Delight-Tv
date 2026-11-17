import { describe, expect, it } from 'vitest';
import { previewCaptionTracks } from './preview-captions';

describe('previewCaptionTracks', () => {
  it('lists approved tracks on the media origin, the way viewers get them', async () => {
    const store = {
      captions: async () => [
        { language: 'en', label: 'English', isDefault: true, key: 'cap/v1/en.vtt' },
      ],
    };
    expect(await previewCaptionTracks(store, 'https://media.example.org/', 'v1')).toEqual([
      {
        id: 'en',
        language: 'en',
        label: 'English',
        src: 'https://media.example.org/cap/v1/en.vtt',
        status: 'approved',
      },
    ]);
  });
  it('is empty when nothing is approved', async () => {
    expect(
      await previewCaptionTracks({ captions: async () => [] }, 'https://m.example', 'v'),
    ).toEqual([]);
  });
});
