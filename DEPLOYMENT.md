# Production Deployment Guide

## Prerequisites
- Docker & Docker Compose
- SSL certificates (via Let's Encrypt or your CA)
- Keycloak instance
- Server with 2GB+ RAM, 10GB disk

## 1. Environment Setup

Copy `.env.example` to `.env.production` on the server:
```bash
cp .env.example .env.production
```

Edit `.env.production` with production values:
```env
# Database
DB_USER=voting_user
DB_PASSWORD=<generate-strong-password>
DB_NAME=image_voting

# Web
WEB_PORT=8088
NEXTAUTH_URL=https://voting.example.com
NEXTAUTH_SECRET=<openssl rand -base64 32>

# Keycloak
KEYCLOAK_CLIENT_ID=<your-client-id>
KEYCLOAK_CLIENT_SECRET=<your-client-secret>
KEYCLOAK_ISSUER=https://keycloak.example.com/realms/image-voting
```

**Never commit `.env.production`** — add to `.gitignore`:
```
.env.production
```

Generate secrets:
```bash
openssl rand -base64 32  # NEXTAUTH_SECRET
```

## 2. Build & Deploy

```bash
# Load environment
export $(cat .env.production | xargs)

# Build image
docker compose -f docker-compose.yml build

# Start services
docker compose -f docker-compose.yml up -d

# Verify
docker compose ps
docker compose logs web
```

Wait ~40s for database to be ready (see `healthcheck`).

## 3. Configure Reverse Proxy (Nginx)

Copy and customize the provided config:
```bash
sudo cp deploy/nginx/voting.conf /etc/nginx/sites-available/voting
sudo vim /etc/nginx/sites-available/voting  # Update domain, paths to certs
sudo ln -s /etc/nginx/sites-available/voting /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

Or use managed TLS (Traefik, AWS ALB, etc.) instead.

## 4. Database Backups

Regular backups are critical:
```bash
# Manual backup
docker compose exec postgres pg_dump -U $DB_USER $DB_NAME > backup-$(date +%Y%m%d).sql

# Restore
docker compose exec -T postgres psql -U $DB_USER -d $DB_NAME < backup-20261021.sql
```

For automated backups, mount a backup volume:
```yaml
# Add to postgres service in docker-compose.yml
volumes:
  - postgres_data:/var/lib/postgresql/data
  - ./backups:/backups
```

Then cron:
```bash
0 2 * * * docker compose -f /path/to/docker-compose.yml exec -T postgres pg_dump -U voting_user image_voting > /path/to/backups/db-$(date +\%Y\%m\%d-\%H\%M\%S).sql
```

## 5. Uploads Storage

Uploads are stored in `/app/uploads` inside the container, mounted to `uploads_data` volume.

For persistent backups, mount a network storage:
```yaml
# docker-compose.yml
volumes:
  - /mnt/nfs/uploads:/app/uploads  # NFS example
```

Or sync to S3:
```bash
docker compose exec web aws s3 sync /app/uploads s3://bucket/uploads
```

## 6. Monitoring & Logs

```bash
# Follow logs
docker compose logs -f web
docker compose logs -f postgres

# Check health
docker compose ps  # Shows healthcheck status

# Resource usage
docker stats
```

Set up log aggregation (ELK, Datadog, etc.) for production.

## 7. Secrets Management

**Development only:** commit `.env.example` with placeholder values.

**Production servers:**
- Never store `.env.production` in git
- Use Docker secrets (Swarm) or external vaults (Hashicorp Vault, AWS Secrets Manager)
- Rotate `NEXTAUTH_SECRET` periodically (requires all sessions to re-auth)
- Audit access to production `.env` files

## 8. Rollback & Updates

Update app or dependencies:
```bash
# Pull latest code
git pull origin main

# Rebuild image
docker compose build --no-cache

# Stop old services
docker compose down

# Start new version
docker compose up -d

# Verify migrations ran
docker compose logs web
```

Rollback to previous image:
```bash
docker compose up -d image-submission-app:previous-tag
```

## 9. Security Checklist

- [ ] SSL/TLS enabled and auto-renewed
- [ ] `.env.production` not in git
- [ ] Keycloak credentials rotated
- [ ] Database backups tested & restored
- [ ] Nginx security headers in place (HSTS, CSP, X-Frame-Options)
- [ ] File upload limits respected (20MB app-side, 25MB Nginx)
- [ ] Database user has minimal permissions
- [ ] Postgres not exposed on public network (no `5432:5432`)
- [ ] Container images pinned to specific versions
- [ ] Regular security updates applied

## 10. Support

For issues:
- Check logs: `docker compose logs web`
- Restart services: `docker compose restart`
- Full reset: `docker compose down -v && docker compose up -d` (clears data)
