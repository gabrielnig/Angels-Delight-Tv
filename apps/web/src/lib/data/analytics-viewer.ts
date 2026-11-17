import type { ViewerContext } from '../analytics/handler';

/**
 * Who is watching, for the analytics route. Interface first: the default treats everyone as an anonymous
 * general viewer, so events count views but carry no profile. The integration pass replaces it with a lookup
 * of the session cookie and the active profile (kids profiles return `audience: 'kids'`).
 */
export type ViewerResolver = (request: Request) => Promise<ViewerContext>;

export const anonymousViewer: ViewerResolver = async () => ({
  profileId: null,
  audience: 'general',
});

let resolver: ViewerResolver = anonymousViewer;
export const setViewerResolver = (next: ViewerResolver): void => {
  resolver = next;
};
export const resolveViewer: ViewerResolver = (request) => resolver(request);
