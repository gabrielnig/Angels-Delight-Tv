import { DrizzleHeartbeatStore } from '@ad/queue';
import { workerHealthResponse } from '../../../../lib/observability/worker-health';
import { getServices } from '../../../../lib/runtime/services';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return workerHealthResponse(() => new DrizzleHeartbeatStore(getServices().db).last('worker'));
}
