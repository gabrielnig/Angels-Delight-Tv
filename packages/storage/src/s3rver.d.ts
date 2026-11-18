// s3rver ships no types. Only the surface used by s3.server.test.ts is declared.
declare module 's3rver' {
  interface S3rverOptions {
    port: number;
    address: string;
    silent: boolean;
    directory: string;
  }
  export default class S3rver {
    constructor(options: S3rverOptions);
    run(): Promise<unknown>;
    close(): Promise<void>;
  }
}
