export interface DbErrorInfo {
  code: string | undefined;
  constraint: string | undefined;
  message: string;
}

/** Drizzle wraps the driver error as `cause`. This reads whichever level carries the Postgres error code. */
export function dbErrorInfo(error: unknown): DbErrorInfo {
  const candidates = [error, (error as { cause?: unknown } | null)?.cause];
  for (const candidate of candidates) {
    const pg = candidate as { code?: unknown; constraint?: unknown; message?: unknown } | null;
    if (pg && typeof pg.code === 'string') {
      return {
        code: pg.code,
        constraint: typeof pg.constraint === 'string' ? pg.constraint : undefined,
        message: typeof pg.message === 'string' ? pg.message : '',
      };
    }
  }
  return {
    code: undefined,
    constraint: undefined,
    message: error instanceof Error ? error.message : '',
  };
}
