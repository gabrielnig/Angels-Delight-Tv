/**
 * Browser safe surface of @ad/theme: pure logic only (no database, no sharp, no storage).
 * The theme editor imports from here so the live preview and the save gate run in the browser
 * with exactly the code the server uses.
 */
export * from './contrast';
export * from './css';
export * from './derive';
export * from './gate';
export * from './model';
export * from './presets';
export * from './html-sanitize';
export {
  SETTING_DEFS,
  SETTING_KEYS,
  type SettingKey,
  type SettingValue,
} from './settings-registry';
export { PAGE_SLUGS, PAGE_TITLES, type PageSlug } from './page-meta';
