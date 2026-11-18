/**
 * Variables read by the deploy tooling and containers other than web and worker (compose.prod.yaml, the backup and
 * restore tools, deploy.sh). The app loaders in @ad/config do not know them, so `.env.production.example` is checked
 * against this list as well.
 */
export const PRODUCTION_ONLY_VARIABLES = [
  'APP_DOMAIN',
  'MEDIA_DOMAIN',
  'WHISPER_MODEL',
  'WHISPER_COMPUTE_TYPE',
  'POSTGRES_PASSWORD',
  'DB_PASSWORD_MIGRATOR',
  'DB_PASSWORD_APP',
  'DB_PASSWORD_WORKER',
  'DB_PASSWORD_KEYS_APP',
  'DB_PASSWORD_KEYS_SHRED',
  'DB_PASSWORD_MAINTENANCE',
  'PWA_ICONS_DIR',
  'BRAND_DIR',
  'BACKUP_DIR',
  'CLIENT_DIR',
  'CONTENT_DIR',
  'ORIGIN_CERT_DIR',
  'MAINTENANCE_DIR',
  'IMAGE_PREFIX',
  'PG_SHARED_BUFFERS',
  'WORKER_CPUS',
  'WHISPER_MEM_LIMIT',
  'BACKUP_PUBLIC_KEY_DB_B64',
  'BACKUP_PUBLIC_KEY_KEYS_B64',
  'BACKUP_S3_ENDPOINT',
  'BACKUP_S3_ACCESS_KEY_ID',
  'BACKUP_S3_SECRET_ACCESS_KEY',
  'BACKUP_BUCKET',
  'BACKUP_RETAIN_DB_DAYS',
  'BACKUP_RETAIN_LOCAL_DAYS',
  'BACKUP_RETAIN_KEYS_DAYS',
  'BACKUP_PING_URL',
] as const;
