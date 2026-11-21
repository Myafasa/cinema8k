-- Jalankan sekali sebagai administrator database, sebelum prisma migrate deploy.
-- Peran pemilik migrasi dan aplikasi dipisahkan; cinema_app tidak boleh menjadi owner.
CREATE ROLE cinema_migrator LOGIN;
CREATE ROLE cinema_app NOLOGIN;
GRANT CONNECT ON DATABASE cinema TO cinema_migrator, cinema_app;
GRANT USAGE, CREATE ON SCHEMA public TO cinema_migrator;
GRANT cinema_app TO cinema_migrator;

-- Buat login aplikasi dengan password dari pengelola deployment, lalu:
-- ALTER ROLE cinema_migrator PASSWORD 'set-a-strong-migration-password';
-- CREATE ROLE cinema_runtime LOGIN PASSWORD 'set-a-strong-runtime-password';
-- GRANT cinema_app TO cinema_runtime;
-- Pastikan cinema_runtime bukan superuser, bukan pemilik tabel, dan tidak BYPASSRLS.
