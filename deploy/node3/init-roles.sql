\getenv app_password APP_DB_PASSWORD
\getenv migrator_password MIGRATOR_PASSWORD
\getenv backup_password BACKUP_DB_PASSWORD
CREATE ROLE cinema_app NOLOGIN;
CREATE ROLE cinema_runtime LOGIN PASSWORD :'app_password';
GRANT cinema_app TO cinema_runtime;
CREATE ROLE cinema_migrator LOGIN PASSWORD :'migrator_password';
CREATE ROLE cinema_backup LOGIN PASSWORD :'backup_password';
GRANT CONNECT ON DATABASE cinema TO cinema_runtime, cinema_migrator, cinema_backup;
GRANT pg_read_all_data TO cinema_backup;
-- Backup is a trusted operator role so pg_dump can include forced-RLS rows.
ALTER ROLE cinema_backup BYPASSRLS;
\connect cinema
GRANT USAGE, CREATE ON SCHEMA public TO cinema_migrator;
