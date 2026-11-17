import { createLogger } from '@ad/shared';

export const silentLogger = createLogger({ write: () => undefined });
