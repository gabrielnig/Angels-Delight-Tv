import { createDb, createPool } from '@ad/db';
import { seedDemo } from './seed-demo';

const url = process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL_MIGRATE (or DATABASE_URL) to the development database.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo data in production.');
  process.exit(1);
}
const pool = createPool(url, { max: 2 });
try {
  const result = await seedDemo(createDb(pool));
  console.log(result.created ? `Seeded ${JSON.stringify(result)}` : 'Demo data is already there.');
} finally {
  await pool.end();
}
