# Deployment Guide — Telemedicine Platform

Production deployment on Vercel with Supabase backend.

## Prerequisites

- [Vercel](https://vercel.com) account
- [Supabase](https://supabase.com) project (PostgreSQL + Auth + Storage)
- [Resend](https://resend.com) account for transactional emails
- [LiveKit Cloud](https://livekit.io) project for video calls
- [Stripe](https://stripe.com) account for subscription billing
- [Tranzila](https://www.tranzila.com) terminal for patient payments (Israeli processor)
- [Green Invoice](https://www.greeninvoice.co.il) account for tax receipts
- [Infobip](https://www.infobip.com) account for WhatsApp notifications (optional)

## 1. Supabase Setup

1. Create a new Supabase project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Run the database migrations in order:
   ```bash
   # From the project root
   npx supabase db push
   ```
   Or manually run the SQL files in the Supabase SQL Editor:
   - `supabase/migrations/001_schema.sql` — Tables, triggers, indexes
   - `supabase/migrations/002_rls.sql` — Row Level Security policies
   - `supabase/migrations/003_invoice_fields.sql` — Invoice columns
3. In Supabase dashboard → Authentication → URL Configuration:
   - Set **Site URL** to your production domain: `https://your-domain.co.il`
   - Add **Redirect URLs**: `https://your-domain.co.il/auth/callback`
4. In Supabase dashboard → Storage:
   - Create a bucket named `medical-documents` with **private** access
5. Copy your project credentials from Settings → API:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Service role key → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Vercel Deployment

1. Push your code to GitHub
2. Import the repository in [Vercel dashboard](https://vercel.com/new)
3. Vercel will auto-detect Next.js — accept the defaults
4. Add all environment variables from `.env.example` (see section below)
5. Deploy

The `vercel.json` file configures:
- **Region**: `fra1` (Frankfurt) — closest to Israel for low latency
- **Cron job**: Appointment reminders every 15 minutes

## 3. Environment Variables

Add these in Vercel dashboard → Settings → Environment Variables.

### Required (app won't start without these)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `NEXT_PUBLIC_APP_URL` | Production domain (e.g. `https://your-domain.co.il`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

### AI

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude AI agents |

### Video Calls

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_LIVEKIT_URL` | LiveKit WebSocket URL |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |

### Payments

| Variable | Description |
|---|---|
| `TRANZILA_TERMINAL_NAME` | Tranzila terminal name |
| `STRIPE_SECRET_KEY` | Stripe secret key for subscriptions |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_BASIC_PRICE_ID` | Stripe Price ID for Basic plan |
| `STRIPE_PRO_PRICE_ID` | Stripe Price ID for Pro plan |
| `STRIPE_ENTERPRISE_PRICE_ID` | Stripe Price ID for Enterprise plan |

### Invoicing

| Variable | Description |
|---|---|
| `GREEN_INVOICE_API_KEY` | Green Invoice API key |
| `GREEN_INVOICE_API_SECRET` | Green Invoice API secret |

### Notifications

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Resend API key for emails |
| `RESEND_FROM_EMAIL` | Verified sender email (e.g. `noreply@your-domain.co.il`) |
| `INFOBIP_API_KEY` | Infobip API key for WhatsApp |
| `INFOBIP_BASE_URL` | Infobip base URL |
| `INFOBIP_WHATSAPP_NUMBER` | WhatsApp sender number |

### Cron & Monitoring

| Variable | Description |
|---|---|
| `CRON_SECRET` | Secret for cron job auth (generate with `openssl rand -hex 32`) |

## 4. Stripe Webhook Setup

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://your-domain.co.il/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the signing secret → `STRIPE_WEBHOOK_SECRET`

## 5. Tranzila Webhook Setup

Configure your Tranzila terminal to send payment notifications to:
```
https://your-domain.co.il/api/payments/webhook
```

## 6. Domain & DNS

1. Add your custom domain in Vercel → Settings → Domains
2. Configure DNS records as Vercel instructs (CNAME or A record)
3. Vercel automatically provisions SSL certificates
4. Update `NEXT_PUBLIC_APP_URL` to match your domain

## 7. Email Domain Verification

1. In [Resend dashboard](https://resend.com/domains), add and verify your domain
2. Add the DNS records Resend provides (SPF, DKIM, DMARC)
3. Set `RESEND_FROM_EMAIL` to an address on your verified domain

## 8. Post-Deployment Verification

After deployment, verify these endpoints:

```bash
# Health check — should return {"status":"healthy"}
curl https://your-domain.co.il/api/health

# Homepage loads
curl -I https://your-domain.co.il

# Auth pages load
curl -I https://your-domain.co.il/auth/login

# 404 page works
curl -I https://your-domain.co.il/nonexistent-page
```

## 9. Monitoring

- **Health check**: `GET /api/health` — returns `200` when healthy, `503` when degraded
- **Vercel logs**: Vercel dashboard → Deployments → Logs
- **Supabase logs**: Supabase dashboard → Logs
- **Cron logs**: Vercel dashboard → Crons (reminders run every 15 minutes)

## Architecture

```
Browser ──→ Vercel (Next.js, Frankfurt fra1)
               ├── SSR pages + API routes
               ├── Supabase (PostgreSQL + Auth + Storage)
               ├── LiveKit Cloud (Video calls)
               ├── Anthropic API (AI agents)
               ├── Resend (Email)
               ├── Infobip (WhatsApp)
               ├── Tranzila (Payments)
               ├── Stripe (Subscriptions)
               └── Green Invoice (Receipts)
```

## Troubleshooting

| Issue | Solution |
|---|---|
| Build fails | Run `npm run build` locally first to catch TypeScript errors |
| Auth redirects broken | Check `NEXT_PUBLIC_APP_URL` and Supabase redirect URLs match |
| Cron not running | Verify `CRON_SECRET` matches in Vercel env vars; crons require Pro plan |
| Emails not sending | Verify domain in Resend and check `RESEND_FROM_EMAIL` |
| Video calls fail | Check `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` |
| Payments fail | Verify Tranzila terminal name and webhook URL |
| Health check 503 | Check Supabase connectivity and service role key |
