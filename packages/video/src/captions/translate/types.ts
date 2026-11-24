export interface TranslateRequest {
  source: string;
  target: string;
  texts: string[];
}

export interface TranslateResult {
  texts: string[];
  model: string;
  /** Characters sent to the provider, for the usage cap. */
  chars: number;
}

/** Engine adapter. No engine is enabled by default (ruling R23). */
export interface Translator {
  readonly name: string;
  supports(source: string, target: string): boolean;
  translate(req: TranslateRequest): Promise<TranslateResult>;
}
