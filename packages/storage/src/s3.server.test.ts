import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import S3rver from 's3rver';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe } from 'vitest';
import { storageContract } from './contract';
import { S3Storage } from './s3';

/**
 * The S3 driver against local S3 compatible servers over real HTTP, running the same contract as the local
 * driver (M22-S02). Two servers, because no single free one is complete:
 *
 * - s3rver (npm, always available): objects, listing, deletion and presigning. It has no ListParts, so the
 *   multipart resume cases are skipped there.
 * - moto_server (Python, `pip install "moto[server]"`, found through MOTO_SERVER or PATH): the full contract
 *   including the presigned multipart upload an admin browser performs. Skipped when it is not installed.
 *
 * Set S3_TEST_ENDPOINT (with S3_TEST_KEY and S3_TEST_SECRET) to run the full contract against MinIO or an R2
 * sandbox instead. R2 and MinIO speak the same protocol, but a run against the real one stays a launch check.
 */

const MIN_PART = 5 * 1024 * 1024; // the real S3 and R2 minimum for every part but the last

function freePort(): Promise<number> {
  return new Promise((ok, fail) => {
    const s = createServer();
    s.once('error', fail);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number };
      s.close(() => ok(port));
    });
  });
}

async function waitFor(url: string): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error(`server at ${url} did not start`);
}

interface Server {
  endpoint: string;
  key: string;
  secret: string;
}

let counter = 0;

async function makeStorage(server: Server): Promise<S3Storage> {
  const bucket = `ad-test-${Date.now()}-${(counter += 1)}`;
  const admin = new S3Client({
    endpoint: server.endpoint,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: server.key, secretAccessKey: server.secret },
  });
  await admin.send(new CreateBucketCommand({ Bucket: bucket }));
  return new S3Storage({
    bucket,
    endpoint: server.endpoint,
    region: 'us-east-1',
    forcePathStyle: true,
    accessKeyId: server.key,
    secretAccessKey: server.secret,
  });
}

/** What the admin browser does with a presigned part url. */
async function uploadPart(url: string, body: Uint8Array): Promise<string> {
  const res = await fetch(url, { method: 'PUT', body: Buffer.from(body) });
  if (!res.ok) throw new Error(`part upload failed with ${res.status}: ${await res.text()}`);
  const etag = res.headers.get('etag');
  if (!etag) throw new Error('no ETag on the part response');
  return etag;
}

const harness = (server: () => Server) => async () => ({
  storage: await makeStorage(server()),
  minPartBytes: MIN_PART,
  uploadPart,
});

// ---- s3rver ----
describe('s3rver', () => {
  let s3rver: S3rver;
  let dir: string;
  let server: Server;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ad-s3rver-'));
    const port = await freePort();
    s3rver = new S3rver({ port, address: '127.0.0.1', silent: true, directory: dir });
    await s3rver.run();
    server = { endpoint: `http://127.0.0.1:${port}`, key: 'S3RVER', secret: 'S3RVER' };
  });
  afterAll(async () => {
    await s3rver?.close();
    await rm(dir, { recursive: true, force: true });
  });
  storageContract(
    's3rver',
    harness(() => server),
    { multipart: false },
  );
});

// ---- moto_server or an endpoint from the environment ----
const motoBin = process.env.MOTO_SERVER ?? 'moto_server';
const hasMoto = spawnSync(motoBin, ['--help'], { stdio: 'ignore' }).status === 0;
const external = process.env.S3_TEST_ENDPOINT;

describe.skipIf(!hasMoto && !external)('full S3 server', () => {
  let child: ChildProcess | undefined;
  let server: Server;
  beforeAll(async () => {
    if (external) {
      server = {
        endpoint: external,
        key: process.env.S3_TEST_KEY ?? 'test',
        secret: process.env.S3_TEST_SECRET ?? 'test',
      };
      return;
    }
    const port = await freePort();
    child = spawn(motoBin, ['-H', '127.0.0.1', '-p', String(port)], { stdio: 'ignore' });
    server = { endpoint: `http://127.0.0.1:${port}`, key: 'test', secret: 'test' };
    await waitFor(server.endpoint);
  }, 30_000);
  afterAll(() => {
    child?.kill();
  });
  storageContract(
    's3 full',
    harness(() => server),
  );
});
