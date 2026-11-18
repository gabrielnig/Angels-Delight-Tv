import type { Category, Progress, SeriesSummary, VideoSummary } from '../types';

export const CATEGORIES: Category[] = [
  { slug: 'science', name: 'Science', description: 'Short videos on how the world works' },
  { slug: 'maths', name: 'Maths', description: 'Numbers, shapes and everyday sums' },
  { slug: 'english', name: 'English', description: 'Reading, writing and speaking clearly' },
  { slug: 'life-skills', name: 'Life Skills', description: 'Money, work and daily life' },
  { slug: 'geography', name: 'Geography', description: 'Places, maps and rivers' },
  { slug: 'health', name: 'Health', description: 'Staying well, every day' },
  { slug: 'digital', name: 'Digital', description: 'Staying safe and smart online' },
  { slug: 'nature', name: 'Nature', description: 'Animals, plants and the outdoors' },
  { slug: 'stories', name: 'Stories', description: 'Tales to watch and share' },
  { slug: 'songs', name: 'Songs', description: 'Sing along and learn' },
];

const categoryName = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;

const DAY = 86_400_000;
const BASE = Date.UTC(2026, 10, 17);
const daysAgo = (n: number) => new Date(BASE - n * DAY).toISOString();

type Row = [slug: string, title: string, category: string, seconds: number, kids: boolean, ageDays: number, blurb: string];

const STANDALONE: Row[] = [
  ['how-plants-make-their-own-food', 'How Plants Make Their Own Food', 'science', 360, true, 1, 'Learn how leaves turn sunlight, water and air into food. Follow simple drawings that show each step.'],
  ['the-water-cycle', 'The Water Cycle', 'science', 252, true, 20, 'Follow a drop of water from the sea to the clouds and back again.'],
  ['counting-money', 'Counting Money in Naira', 'life-skills', 420, false, 3, 'Add up notes and coins with simple tricks you can use at the market.'],
  ['reading-a-map', 'Reading a Map', 'geography', 300, true, 5, 'Find north, read a key and plan a route from home to school.'],
  ['why-the-sky-is-blue', 'Why the Sky Is Blue', 'science', 310, true, 18, 'Sunlight is made of many colours. See why blue gets scattered the most.'],
  ['staying-safe-online', 'Staying Safe Online', 'digital', 240, false, 8, 'Spot fake messages, protect your password and share with care.'],
  ['telling-the-time', 'Telling the Time', 'maths', 180, true, 30, 'Read a clock face and say the time in hours and minutes.'],
  ['saving-a-little-each-day', 'Saving a Little Each Day', 'life-skills', 480, false, 2, 'Build a saving habit with small amounts and a simple plan.'],
  ['rivers-of-africa', 'Rivers of Africa', 'geography', 300, true, 4, 'Trace the Niger, the Nile and the Congo from source to sea.'],
  ['the-human-heart', 'The Human Heart', 'science', 420, false, 12, 'See how the heart pumps blood around the body.'],
  ['what-is-electricity', 'What Is Electricity?', 'science', 480, false, 16, 'Learn what makes a bulb light up and how to stay safe around power.'],
  ['magnets-at-work', 'Magnets at Work', 'science', 241, true, 14, 'What magnets pull, what they do not, and where we use them every day.'],
  ['seasons-and-weather', 'Seasons and Weather', 'science', 363, true, 22, 'Why Nigeria has a rainy season and a dry season, and what the harmattan is.'],
  ['animals-and-habitats', 'Animals and Habitats', 'science', 320, true, 24, 'Where animals live and what they need to survive.'],
  ['day-and-night', 'Day and Night', 'science', 60, true, 40, 'Why the sun seems to rise and set.'],
  ['rainbow-colours', 'Rainbow Colours', 'science', 120, true, 42, 'Seven colours in one arc, and how they appear.'],
  ['planting-a-vegetable-garden', 'Planting a Vegetable Garden', 'life-skills', 360, false, 9, 'Choose a spot, prepare the soil and plant your first vegetables.'],
  ['healthy-food-from-the-farm', 'Healthy Food From the Farm', 'health', 180, true, 11, 'Which farm foods help you grow strong.'],
  ['brush-your-teeth', 'Brush Your Teeth', 'health', 180, true, 6, 'Brush for two minutes, morning and night.'],
  ['counting-to-ten', 'Counting to Ten', 'maths', 180, true, 7, 'Count along with friendly animals.'],
  ['animal-sounds', 'Animal Sounds', 'nature', 120, true, 10, 'Guess which animal makes each sound.'],
  ['our-colours-song', 'Our Colours Song', 'songs', 120, true, 13, 'Sing the colours of the rainbow.'],
  ['meet-the-elephant', 'Meet the Elephant', 'nature', 180, true, 3, 'Follow Tembo to the river and learn how big friends drink.'],
  ['where-birds-sleep', 'Where Birds Sleep', 'nature', 120, true, 15, 'Nests, trees and night time safety for birds.'],
  ['fish-in-the-river', 'Fish in the River', 'nature', 240, true, 17, 'How fish breathe and where they hide.'],
  ['the-little-goat', 'The Little Goat', 'stories', 300, true, 19, 'A small goat finds a big idea.'],
  ['circles-everywhere', 'Circles Everywhere', 'maths', 120, true, 21, 'Find circles in a market, a kitchen and the sky.'],
  ['count-the-mangoes', 'Count the Mangoes', 'maths', 180, true, 23, 'Add and take away with a basket of mangoes.'],
  ['anansi-and-the-pot', 'Anansi and the Pot', 'stories', 360, true, 25, 'A clever spider and a pot of wisdom.'],
  ['rain-rain-song', 'Rain, Rain Song', 'songs', 120, true, 26, 'A song for the rainy season.'],
  ['speaking-clearly', 'Speaking Clearly', 'english', 300, false, 27, 'Slow down, breathe and speak so everyone can follow.'],
  ['writing-a-short-letter', 'Writing a Short Letter', 'english', 330, false, 28, 'Greeting, message and closing, step by step.'],
  ['washing-hands-well', 'Washing Hands Well', 'health', 150, true, 29, 'Twenty seconds that keep germs away.'],
];

function video(row: Row, id: number): VideoSummary {
  const [slug, title, category, durationSeconds, kidsSafe, age, description] = row;
  return {
    kind: 'video',
    id: `vid-${String(id).padStart(3, '0')}`,
    slug,
    title,
    description,
    durationSeconds,
    categorySlug: category,
    categoryName: categoryName(category),
    hasCaptions: true,
    ageLabel: kidsSafe ? undefined : 'Ages 8 and up',
    kidsSafe,
    publishedAt: daysAgo(age),
  };
}

const SERIES_META = {
  slug: 'everyday-science',
  title: 'Everyday Science',
  description:
    'Short lessons that explain the science around us, from rain and rainbows to magnets and mangoes. Each episode is under seven minutes and ends with a question to think about.',
};

type Episode = [slug: string, title: string, seconds: number, blurb: string, season: number];
const EPISODES: Episode[] = [
  ['the-water-cycle-ep', 'The Water Cycle', 252, 'Follow a drop of water from the sea to the clouds and back again.', 1],
  ['why-the-sky-is-blue-ep', 'Why the Sky Is Blue', 310, 'Sunlight is made of many colours. See why blue gets scattered the most.', 1],
  ['how-rain-is-made', 'How Rain Is Made', 352, 'How clouds form and why rain falls. Includes a simple home experiment.', 1],
  ['seasons-and-weather-ep', 'Seasons and Weather', 363, 'Why Nigeria has a rainy season and a dry season, and what the harmattan is.', 1],
  ['animals-and-habitats-ep', 'Animals and Habitats', 320, 'Where animals live and what they need to survive.', 1],
  ['magnets-at-work-ep', 'Magnets at Work', 281, 'What magnets pull, what they do not, and where we use them every day.', 1],
  ['what-is-a-rainbow', 'What Is a Rainbow?', 205, 'Light, water and the arc in the sky.', 2],
  ['how-mangoes-grow', 'How Mangoes Grow', 340, 'From flower to fruit on a mango tree.', 2],
  ['sound-and-music', 'Sound and Music', 298, 'How a drum makes a sound travel.', 2],
];

export const VIDEOS: VideoSummary[] = [
  ...STANDALONE.map((row, index) => video(row, index + 1)),
  ...EPISODES.map(([slug, title, seconds, blurb, season], index) => {
    const number = EPISODES.slice(0, index + 1).filter((e) => e[4] === season).length;
    return {
      ...video([slug, title, 'science', seconds, false, 30 + index, blurb], 100 + index),
      series: { slug: SERIES_META.slug, title: SERIES_META.title, season, episode: number },
    } satisfies VideoSummary;
  }),
];

export const SERIES: SeriesSummary[] = [
  {
    kind: 'series',
    ...SERIES_META,
    categorySlug: 'science',
    categoryName: 'Science',
    episodeCount: EPISODES.length,
    seasonCount: 2,
    kidsSafe: false,
    ageLabel: 'Ages 8 and up',
    hasCaptions: true,
    publishedAt: daysAgo(2),
  },
];

/** Seeded watch progress for the demo profile. */
export const PROGRESS: Progress[] = [
  { videoId: 'vid-102', positionSeconds: 310, durationSeconds: 310, updatedAt: daysAgo(3) },
  { videoId: 'vid-101', positionSeconds: 252, durationSeconds: 252, updatedAt: daysAgo(4) },
  { videoId: 'vid-103', positionSeconds: 134, durationSeconds: 352, updatedAt: daysAgo(0) },
  { videoId: 'vid-002', positionSeconds: 100, durationSeconds: 252, updatedAt: daysAgo(1) },
  { videoId: 'vid-004', positionSeconds: 150, durationSeconds: 300, updatedAt: daysAgo(2) },
  { videoId: 'vid-003', positionSeconds: 90, durationSeconds: 420, updatedAt: daysAgo(2) },
];

export const SEEDED_MY_LIST = ['video:vid-103', 'video:vid-005', 'video:vid-002', 'video:vid-012', 'video:vid-017'];
