export interface SbomMeta {
  name: string;
  version: string;
  timestamp: string;
}
export function toCycloneDx(
  trees: Array<{ dependencies?: Record<string, unknown> }>,
  meta: SbomMeta,
): {
  bomFormat: string;
  specVersion: string;
  metadata: { component: { name: string } };
  components: Array<{ purl: string }>;
};
