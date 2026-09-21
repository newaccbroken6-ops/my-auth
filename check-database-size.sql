-- Check total database size
SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size;

-- Check licenses table size
SELECT 
  pg_size_pretty(pg_total_relation_size('licenses')) AS total_size,
  pg_size_pretty(pg_relation_size('licenses')) AS table_size,
  pg_size_pretty(pg_indexes_size('licenses')) AS indexes_size;

-- Count total licenses
SELECT COUNT(*) AS total_licenses FROM licenses;

-- Size per license (average)
SELECT 
  COUNT(*) AS total_licenses,
  pg_size_pretty(pg_total_relation_size('licenses')) AS total_size,
  pg_size_pretty(pg_total_relation_size('licenses') / GREATEST(COUNT(*), 1)) AS avg_size_per_license
FROM licenses;

-- Breakdown by table
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check remaining space (500 MB limit on free tier)
SELECT 
  pg_size_pretty(pg_database_size(current_database())) AS current_size,
  pg_size_pretty(524288000) AS max_size, -- 500 MB
  pg_size_pretty(524288000 - pg_database_size(current_database())) AS remaining,
  ROUND((pg_database_size(current_database())::numeric / 524288000) * 100, 2) AS usage_percent;
