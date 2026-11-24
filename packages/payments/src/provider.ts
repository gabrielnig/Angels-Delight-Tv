import type { Currency } from './money';

export interface InitializeInput {
  amountMinor: number;
  currency: Currency;
  email: string;
  reference: string;
  callbackUrl: string;
  /** Plain values only. Never put a name, phone number or card detail in here. */
  metadata?: Record<string, string | number | boolean>;
  /** A provider plan code, for monthly giving. */
  planCode?: string;
}

export interface InitializeResult {
  authorizationUrl: string;
  reference: string;
  accessCode: string;
}

export interface ExpectedPayment {
  amountMinor: number;
  currency: Currency;
}

export type VerifyResult =
  | { status: 'paid'; reference: string; amountMinor: number; currency: Currency; paidAt: Date | null }
  | {
      status: 'needs_review';
      reference: string;
      reason: 'amount_lower' | 'currency_mismatch';
      amountMinor: number;
      currency: string;
    }
  | { status: 'failed' | 'abandoned' | 'pending'; reference: string };

export type PaymentErrorCode = 'network' | 'timeout' | 'rate_limited' | 'server' | 'rejected' | 'unauthorized' | 'bad_response';

/** A failed call to the provider. `retryable` says whether trying again later can help. */
export class PaymentError extends Error {
  constructor(
    readonly code: PaymentErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

export interface PaymentProvider {
  readonly name: 'paystack';
  initialize(input: InitializeInput): Promise<InitializeResult>;
  verify(reference: string, expected: ExpectedPayment): Promise<VerifyResult>;
}
