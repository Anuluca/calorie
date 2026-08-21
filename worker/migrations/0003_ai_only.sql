-- 移除旧食品主库；D1 仅保留 AI 查询缓存。
DROP TABLE IF EXISTS aliases;
DROP TABLE IF EXISTS foods;
DELETE FROM query_cache;
