/**
 * SQL for "a viewer can get this caption track" (M46): approved, published, and its language is in the
 * `content.languages` setting (default English only). `alias` is a trusted table alias, never user input.
 */
export const viewerTrackSql = (alias: string): string =>
  `${alias}.approved_caption_id IS NOT NULL AND ${alias}.published AND ${alias}.language IN (` +
  `SELECT jsonb_array_elements_text(coalesce((SELECT st.value FROM settings st WHERE st.key = 'content.languages'), '["en"]'::jsonb)))`;
