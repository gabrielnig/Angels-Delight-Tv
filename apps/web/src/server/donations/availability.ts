import 'server-only';
import { donateProvider, readDonateConfig } from './runtime';

/** Donations exist only when the switch is on and the server holds both Paystack secrets. Any error means off. */
export async function donateAvailable(): Promise<boolean> {
  try {
    return donateProvider() !== null && (await readDonateConfig()).enabled;
  } catch {
    return false;
  }
}
