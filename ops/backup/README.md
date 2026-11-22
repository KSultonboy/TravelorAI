# TravelorAI — PostgreSQL backups

Daily `pg_dump` of the production database, run on the server by a systemd
timer. Touches only TravelorAI (reads `DATABASE_URL` from the `voyageai_backend`
container, writes under `/root/backups/travelorai/`).

| File | Installed to |
|---|---|
| `travelorai-pg-backup.sh` | `/usr/local/sbin/travelorai-pg-backup.sh` (0700 root) |
| `travelorai-pg-backup.service` | `/etc/systemd/system/` |
| `travelorai-pg-backup.timer` | `/etc/systemd/system/` (daily 03:30 Asia/Tashkent) |

How it works:

- `DATABASE_URL` is resolved inside `voyageai_backend` the same way `server.js`
  does (dotenv `override:true` over `/app/.env`); it is never printed or stored.
- `pg_dump` runs in a throw-away `postgres:16-alpine` podman container with
  `--network host` (Postgres is on 127.0.0.1:5433 under snap-docker).
- Output: `/root/backups/travelorai/{daily,weekly,manual}/travelorai-<kind>-<UTC>.sql.gz`,
  files `chmod 600`, directories `700`.
- Retention: 14 daily, 8 weekly (Sunday's daily is copied to `weekly/`),
  10 manual. `scripts/deploy-backend.sh` calls it with `--kind manual` before
  running migrations (and refuses to migrate if it is not installed, unless
  `--skip-backup`).
- The dump is checked (gzip integrity, size > 1 KB, pg_dump header) before it
  replaces anything; a failed run leaves no partial file and exits non-zero.

## Install (lead engineer, once)

From a developer machine at the repo root:

```bash
scp ops/backup/travelorai-pg-backup.sh ops/backup/travelorai-pg-backup.service \
    ops/backup/travelorai-pg-backup.timer rux-backend:/tmp/
```

On the server (`ssh rux-backend`):

```bash
install -m 700 -o root -g root /tmp/travelorai-pg-backup.sh /usr/local/sbin/travelorai-pg-backup.sh
install -m 644 /tmp/travelorai-pg-backup.service /tmp/travelorai-pg-backup.timer /etc/systemd/system/
podman pull docker.io/library/postgres:16-alpine
systemctl daemon-reload

# first run by hand, check the result
systemctl start travelorai-pg-backup.service
journalctl -u travelorai-pg-backup.service -n 30 --no-pager
ls -l /root/backups/travelorai/daily/

# enable the schedule
systemctl enable --now travelorai-pg-backup.timer
systemctl list-timers travelorai-pg-backup.timer
```

## Restore drill (do this once, then quarterly)

Restore into a scratch database, never over production:

```bash
F=$(ls -1 /root/backups/travelorai/daily/*.sql.gz | tail -n1)
podman run -d --name travelorai_restore_test -e POSTGRES_PASSWORD=restore-test \
  -p 127.0.0.1:55432:5432 docker.io/library/postgres:16-alpine
sleep 5
gunzip -c "$F" | podman exec -i travelorai_restore_test psql -U postgres -v ON_ERROR_STOP=1 -q
podman exec travelorai_restore_test psql -U postgres -c '\dt' | head -40
podman rm -f travelorai_restore_test
```

## Off-site copy (recommended next step)

Backups on the same disk do not survive losing the server. Copy
`/root/backups/travelorai/` off the host (e.g. `rclone` to object storage, or
`rsync` pull from another machine) and encrypt it — the dumps contain personal
data (users, agencies, leads).
