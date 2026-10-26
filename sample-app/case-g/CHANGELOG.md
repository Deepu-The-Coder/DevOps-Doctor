# Changelog

## 1.8.0 (2026-10-26)
- Rotated the database password: `POSTGRES_PASSWORD` in the deploy host's `.env` was replaced after the security review.
- `/orders` now returns at most 50 rows.

## 1.7.1 (2026-10-19)
- Moved `dotenv` to dependencies.

## 1.7.0 (2026-10-12)
- Postgres data is now kept in the `pgdata` named volume so orders survive redeploys.
