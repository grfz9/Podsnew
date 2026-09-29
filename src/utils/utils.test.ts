import { describe, expect, it } from 'vitest';
import type { Episode } from '../types';
import { formatDuration, formatReleaseDate, formatTime, stripHtml } from './format';
import { isFinished, progressRatio, remainingSeconds, resumePosition } from './progress';
import { addToQueue, moveInQueue, playNext, removeFromQueue } from './queue';

const ep = (id: string): Episode => ({
  id,
  podcastId: 'p',
  podcastTitle: 'Podcast',
  title: `Épisode ${id}`,
  description: '',
  audioUrl: `https://example.com/${id}.mp3`,
  duration: 600,
  releaseDate: '2026-01-01T00:00:00Z',
  artwork: '',
});

describe('format', () => {
  it('formatTime', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(3725)).toBe('1:02:05');
    expect(formatTime(NaN)).toBe('0:00');
  });

  it('formatDuration', () => {
    expect(formatDuration(0)).toBe('');
    expect(formatDuration(20)).toBe('1 min');
    expect(formatDuration(540)).toBe('9 min');
    expect(formatDuration(3600)).toBe('1 h');
    expect(formatDuration(3725)).toBe('1 h 02');
  });

  it('formatReleaseDate', () => {
    const now = new Date(2026, 8, 29, 12);
    expect(formatReleaseDate(new Date(2026, 8, 29, 8).toISOString(), now)).toBe("Aujourd'hui");
    expect(formatReleaseDate(new Date(2026, 8, 28, 8).toISOString(), now)).toBe('Hier');
    expect(formatReleaseDate(new Date(2026, 8, 25, 8).toISOString(), now)).toBe('Il y a 4 jours');
    expect(formatReleaseDate(new Date(2024, 2, 12).toISOString(), now)).toContain('2024');
    expect(formatReleaseDate('pas une date', now)).toBe('');
  });

  it('stripHtml', () => {
    expect(stripHtml('<p>Bonjour&nbsp;<b>à tous</b></p><p>Suite</p>')).toBe('Bonjour à tous\n\nSuite');
    expect(stripHtml('A &amp; B<br/>C')).toBe('A & B\nC');
  });
});

describe('progress', () => {
  it('isFinished', () => {
    expect(isFinished(100, 1000)).toBe(false);
    expect(isFinished(960, 1000)).toBe(true);
    expect(isFinished(580, 600)).toBe(true);
    expect(isFinished(10, 0)).toBe(false);
  });

  it('resumePosition / ratio / remaining', () => {
    const p = { position: 300, duration: 600, completed: false, updatedAt: 0 };
    expect(resumePosition(p)).toBe(297);
    expect(resumePosition({ ...p, completed: true })).toBe(0);
    expect(resumePosition(undefined)).toBe(0);
    expect(progressRatio(p)).toBe(0.5);
    expect(progressRatio({ ...p, completed: true })).toBe(1);
    expect(remainingSeconds(p, 600)).toBe(300);
    expect(remainingSeconds(undefined, 600)).toBe(600);
  });
});

describe('queue', () => {
  it('addToQueue ignore les doublons', () => {
    const q = addToQueue([ep('a')], ep('b'));
    expect(q.map((e) => e.id)).toEqual(['a', 'b']);
    expect(addToQueue(q, ep('a'))).toBe(q);
  });

  it('playNext place en tête et déduplique', () => {
    expect(playNext([ep('a'), ep('b')], ep('b')).map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('removeFromQueue / moveInQueue', () => {
    const q = [ep('a'), ep('b'), ep('c')];
    expect(removeFromQueue(q, 'b').map((e) => e.id)).toEqual(['a', 'c']);
    expect(moveInQueue(q, 0, 2).map((e) => e.id)).toEqual(['b', 'c', 'a']);
    expect(moveInQueue(q, 0, -1)).toBe(q);
  });
});
