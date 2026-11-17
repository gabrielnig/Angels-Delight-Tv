import { TransportError } from './types';
import type { PartRequest, StartResult, UploadTransport } from './types';

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export interface PutPartInput {
  url: string;
  blob: Blob;
  signal: AbortSignal;
  onProgress: (sentBytes: number) => void;
}

export interface HttpTransportOptions {
  fetch?: Fetcher;
  /** PUT one part to its presigned URL. Default uses XMLHttpRequest so progress is real. */
  putPart?: (input: PutPartInput) => Promise<void>;
  baseUrl?: string;
}

/** Browser PUT with upload progress. fetch cannot report upload progress, so this uses XHR. */
export function xhrPutPart({ url, blob, signal, onProgress }: PutPartInput): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(
            new TransportError(
              `Storage answered ${xhr.status}`,
              xhr.status >= 500 ? 'server' : 'rejected',
            ),
          );
    xhr.onerror = () => reject(new TransportError('Network error', 'network'));
    xhr.ontimeout = () => reject(new TransportError('Network timeout', 'network'));
    signal.addEventListener('abort', () => {
      xhr.abort();
      reject(new DOMException('Aborted', 'AbortError'));
    });
    xhr.send(blob);
  });
}

/** Client for the admin upload API in docs/ARCHITECTURE.md section 7. */
export function createHttpTransport(options: HttpTransportOptions = {}): UploadTransport {
  const doFetch: Fetcher = options.fetch ?? ((url, init) => fetch(url, init));
  const put = options.putPart ?? xhrPutPart;
  const base = options.baseUrl ?? '/api/admin/uploads';

  async function call(url: string, init?: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await doFetch(url, init);
    } catch (error) {
      if (init?.signal?.aborted) throw error;
      throw new TransportError('Could not reach the server', 'network');
    }
    if (!response.ok) {
      const kind = response.status >= 500 || response.status === 429 ? 'server' : 'rejected';
      throw new TransportError(`Server answered ${response.status}`, kind);
    }
    return response;
  }

  const post = (url: string, body: unknown, signal?: AbortSignal) =>
    call(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

  return {
    async start(input): Promise<StartResult> {
      if (input.resumeUploadId) {
        try {
          const response = await call(`${base}/${input.resumeUploadId}`);
          const data = (await response.json()) as {
            uploadId: string;
            partSize: number;
            totalParts: number;
            uploadedParts: number[];
          };
          return {
            uploadId: data.uploadId,
            partSizeBytes: data.partSize,
            totalParts: data.totalParts,
            uploadedParts: data.uploadedParts,
          };
        } catch (error) {
          // An expired or unknown session starts fresh. Network errors still surface.
          if (!(error instanceof TransportError) || error.kind !== 'rejected') throw error;
        }
      }
      const response = await post(base, {
        name: input.name,
        size: input.size,
        type: input.type,
        fingerprint: input.fingerprint,
      });
      const data = (await response.json()) as {
        uploadId: string;
        partSize: number;
        totalParts: number;
      };
      return {
        uploadId: data.uploadId,
        partSizeBytes: data.partSize,
        totalParts: data.totalParts,
        uploadedParts: [],
      };
    },

    async uploadPart(request: PartRequest) {
      const response = await post(
        `${base}/${request.uploadId}/parts`,
        { partNumbers: [request.partNumber] },
        request.signal,
      );
      const { urls } = (await response.json()) as { urls: Record<string, string> };
      const url = urls[String(request.partNumber)];
      if (!url) throw new TransportError('No upload address for this part', 'server');
      await put({
        url,
        blob: request.blob,
        signal: request.signal,
        onProgress: request.onProgress,
      });
    },

    async complete(uploadId) {
      await post(`${base}/${uploadId}/complete`, {});
    },

    async abort(uploadId) {
      await call(`${base}/${uploadId}`, { method: 'DELETE' });
    },
  };
}
