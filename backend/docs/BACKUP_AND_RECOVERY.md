# ShilpSetu Backend — Backup & Disaster Recovery Runbook

## 1. Database Backup & Retention

ShilpSetu uses Supabase PostgreSQL as its primary database.

### Automated Backups:
- **Point-in-Time Recovery (PITR)**: Enabled on production instances allowing continuous WAL recovery up to 30 days.
- **Daily Full Backups**: Automated snapshots retained for 30 days.

### Manual Database Export (`pg_dump`):
```bash
# Export schema and data with compression
pg_dump -h db.<PROJECT-ID>.supabase.co \
        -U postgres \
        -d postgres \
        -F c -b -v \
        -f shilpsetu_backup_$(date +%Y%m%d_%H%M%S).dump
```

---

## 2. Media & Cloud Storage Backup

- Media files (`product-images`, audio recordings, verification documents) reside in Supabase Storage.
- **Bucket Replication**: Cloud buckets configured with cross-region replication.
- **Orphan Cleanup**: Handled programmatically on upload error rollbacks via `mediaService.js`.

---

## 3. Environment Secrets Management

- **Zero Secret Commits**: No production secrets or service role keys in Git.
- **Secret Vault**: Production credentials stored in GitHub Encrypted Secrets and Cloud Secret Managers.
- **Key Rotation**: Rotate `SUPABASE_SERVICE_ROLE_KEY` and API keys every 90 days.

---

## 4. Disaster Recovery & Restoration Procedure

1. **Provision New Database Instance**:
   - Initialize PostgreSQL database.
   - Run migrations sequentially from `src/db/migrations/001_audit_logs.sql` through `010_analytics_events.sql`.

2. **Restore Database from Dump**:
   ```bash
   pg_restore -h db.<NEW-PROJECT-ID>.supabase.co \
              -U postgres \
              -d postgres \
              -v -c \
              shilpsetu_backup_<TIMESTAMP>.dump
   ```

3. **Verify Integrity & Subsystems**:
   - Verify health check: `curl http://localhost:5000/api/health`
   - Run integration tests: `node test/fullJourney.test.js`
