# Deployment & operations runbook

Step-by-step from a fresh clone to production traffic. Read top to bottom the
first time; later you can jump to any section.

## 0. Index

1. [Local development](#1-local-development)
2. [Supabase setup](#2-supabase-setup)
3. [Train the disease-detection model](#3-train-the-disease-detection-model)
4. [Deploy the backend to DigitalOcean](#4-deploy-the-backend-to-digitalocean)
5. [Deploy the frontend to Vercel](#5-deploy-the-frontend-to-vercel)
6. [Post-deploy: keep-alive, CORS, smoke test](#6-post-deploy-keep-alive-cors-smoke-test)
7. [Troubleshooting](#7-troubleshooting)

The architecture, scope, and cost model all live in `implementation_plan.md`.

---

## 1. Local development

### Prerequisites

- **Node.js 20+** and **npm**
- **Python 3.11 or 3.12** (with `python3-venv` ideally — `apt install python3.12-venv` on Debian/Ubuntu — but anaconda works too)
- **git**

### First-time setup

```bash
git clone <your-fork>.git
cd Smart_Irrigation_Advisor

scripts/setup.sh
```

`setup.sh` will:

- Detect or create `backend/.venv` (falls back to anaconda if `python3-venv` is missing).
- Install `backend/requirements.txt`.
- Run `npm install` in `frontend/`.
- Copy `.env.example` → `.env` (backend) and `.env.local` (frontend) if missing.

### Fill in environment variables

You need a working **Supabase project** before the app does anything useful. See
[§2 Supabase setup](#2-supabase-setup), then come back here.

`backend/.env`:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=<service-role-secret>     # Settings → API → service_role
SUPABASE_JWT_SECRET=<jwt-secret>               # Settings → API → JWT Secret
OPEN_METEO_BASE_URL=https://api.open-meteo.com/v1
ALLOWED_ORIGINS=http://localhost:3000
DEBUG=true
```

> Leave `SUPABASE_JWT_SECRET` empty if your project uses **RS256/JWKS** —
> `dependencies.py` will auto-fall back to `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`.

`frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>   # Settings → API → anon public
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Run

```bash
scripts/dev.sh              # both servers, Ctrl+C kills both
# or, separately:
scripts/backend-dev.sh      # FastAPI on :8000 with auto-reload
scripts/frontend-dev.sh     # Next.js on :3000
```

Sanity check while it's running:

```bash
curl http://localhost:8000/api/health        # {status:ok, model:{available:false,...}}
curl http://localhost:8000/api/crops          # list of crops from Supabase
open http://localhost:3000                    # landing page
```

`/api/health` will report `model.available: false` until you finish §3.

---

## 2. Supabase setup

### 2.1 Create the project

1. Sign up at [supabase.com](https://supabase.com) — free tier is fine.
2. **New Project** → name `smart-irrigation` → region `eu-west-3` (Paris) for low Morocco latency.
3. Set a strong DB password and save it.
4. Wait for provisioning (~2 min).

### 2.2 Run the SQL files in order

Open **SQL Editor** → **+ New query** and paste each file in this exact order:

| Step | File | What it does |
|---|---|---|
| 1 | `database/schema.sql` | Tables, indexes, the `handle_new_user` trigger that mirrors `auth.users` into `public.users` |
| 2 | `database/rls_policies.sql` | Row-level security for every table |
| 3 | `database/seed_data.sql` | 12 regions, 10 crops with Kc values, 5 soil types — required for the irrigation form to have options |
| 4 | `database/storage_bucket.sql` | Creates the `disease-images` storage bucket + RLS for it |

Each block is idempotent — safe to re-run.

### 2.3 Grab the keys

**Project Settings → API**:

| Variable | Where to copy from | Goes into |
|---|---|---|
| `SUPABASE_URL` | "Project URL" | both backend `.env` and frontend `.env.local` |
| `SUPABASE_SERVICE_KEY` | "service_role" secret (long string starting `eyJ…`) | backend only — never expose to the browser |
| `SUPABASE_JWT_SECRET` | "JWT Secret" | backend only |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | "anon public" | frontend only |

### 2.4 Create your first admin user

The signup flow creates rows in `public.users` with role `user`. To get admin
access:

1. Run the app locally (`scripts/dev.sh`).
2. Register through the UI at `http://localhost:3000/fr/register`.
3. In Supabase **SQL Editor**, promote your user:

```sql
UPDATE public.users
   SET role = 'admin'
 WHERE email = 'you@example.com';
```

4. Log out and back in. The Navbar now shows the **Administration** link.

### 2.5 Optional but recommended

- **Settings → Auth → Email Templates**: customise the verification email
  (defaults work for development).
- **Settings → Auth → URL configuration**: add your Vercel production URL once
  you have it.

---

## 3. Train the disease-detection model

The backend serves `/api/disease/predict` only when `backend/app/ml/model.tflite`
and `backend/app/ml/class_labels.json` are present. Until then the endpoint
returns HTTP 503 — by design.

### 3.1 Get the dataset

**PlantVillage** (54 305 images, 38 classes) is the standard. Two options:

- **Kaggle**: <https://www.kaggle.com/datasets/abdallahalidev/plantvillage-dataset> — ~600 MB.
- **GitHub mirror**: <https://github.com/spMohanty/PlantVillage-Dataset>.

Folder layout the training script expects:

```
PlantVillage/
├── Apple___Apple_scab/
│   ├── image001.jpg
│   ├── image002.jpg
│   └── …
├── Apple___Black_rot/
└── …  (38 directories total — folder name = class key)
```

The class names must match the keys in `backend/app/services/disease_service.py:DISEASE_INFO`.
If your download uses slightly different folder names (e.g. spaces vs underscores),
rename them before training.

### 3.2 Train in Google Colab (free GPU — recommended)

1. Open [colab.research.google.com](https://colab.research.google.com), **New notebook**.
2. **Runtime → Change runtime type → T4 GPU**.
3. Upload `ml/train_disease_model.py`, `ml/convert_to_tflite.py`, `ml/requirements.txt`
   (or clone this repo).
4. Mount your dataset (Drive, Kaggle API, or `wget` from a URL).
5. Run:

```python
!pip install -q -r requirements.txt

!python train_disease_model.py \
    --data-dir /content/PlantVillage \
    --output-dir /content/output \
    --epochs-head 10 \
    --epochs-finetune 20
```

Expected: ~40 min on T4, validation accuracy ≥ 0.95.

6. Convert to TFLite:

```python
!python convert_to_tflite.py \
    --saved-model /content/output/saved_model \
    --output /content/output/model.tflite \
    --representative-data /content/PlantVillage
```

The `--representative-data` flag enables **INT8 post-training quantization**
(~15 MB float32 → ~4 MB INT8). Required for the DigitalOcean basic-xxs
instance which only has 1 GB RAM.

7. Download `model.tflite` and `class_labels.json` to your laptop.

### 3.3 Train locally (only if you have a GPU)

```bash
cd ml
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python train_disease_model.py --data-dir ./PlantVillage --output-dir ./output
python convert_to_tflite.py \
    --saved-model ./output/saved_model \
    --output ./output/model.tflite \
    --representative-data ./PlantVillage
```

### 3.4 Drop the model into the backend

```bash
cp model.tflite         backend/app/ml/model.tflite
cp class_labels.json    backend/app/ml/class_labels.json
```

### 3.5 Verify

Restart the backend, then:

```bash
curl http://localhost:8000/api/disease/status
# {"available": true, "error": null, "classes": 38}
```

Test with a real leaf image:

```bash
python ml/evaluate_model.py \
    --model backend/app/ml/model.tflite \
    --labels backend/app/ml/class_labels.json \
    --images-dir /path/to/PlantVillage \
    --n 50
```

If accuracy is < 90 % on a held-out sample, retrain with more epochs or check
that your folder names match `DISEASE_INFO` keys exactly.

---

## 4. Deploy the backend to DigitalOcean

### 4.1 Sign up + get $200 credits

- [digitalocean.com](https://www.digitalocean.com) — student/dev programmes
  ([GitHub Student Pack](https://education.github.com/pack)) often include credits.
- Verify your billing card.

### 4.2 Push your repo to GitHub

The deploy reads from a public or private GitHub repo. Make sure
`backend/app/ml/model.tflite` is committed (Git LFS recommended for files > 50 MB,
but ~4 MB INT8 is fine in regular Git).

```bash
git add backend/app/ml/model.tflite backend/app/ml/class_labels.json
git commit -m "Add trained disease detection model"
git push origin main
```

### 4.3 Create the app

**Option A — UI (easiest):**

1. DigitalOcean dashboard → **Apps** → **Create App**.
2. Choose **GitHub**, authorise, pick the repo.
3. Branch `main`, source directory `backend`.
4. DO auto-detects the `Dockerfile` — keep it.
5. Plan: **Basic / basic-xxs** ($6/mo, 1 GB RAM).
6. **HTTP port: 8000**, **health check path: `/api/health`**.
7. Add env vars (mark all secrets):

   | Key | Value | Type |
   |---|---|---|
   | `SUPABASE_URL` | from §2.3 | SECRET |
   | `SUPABASE_SERVICE_KEY` | from §2.3 | SECRET |
   | `SUPABASE_JWT_SECRET` | from §2.3 | SECRET (or empty for JWKS) |
   | `OPEN_METEO_BASE_URL` | `https://api.open-meteo.com/v1` | plain |
   | `ALLOWED_ORIGINS` | `https://<your-vercel-url>` | plain (update after §5) |

8. **Create resources**. First build takes ~5 min.

**Option B — via `.do/app.yaml`:**

1. Edit `backend/.do/app.yaml`: replace `REPLACE_ME` with your GitHub user/repo.
2. `doctl apps create --spec backend/.do/app.yaml` (requires `doctl` CLI + envs).

### 4.4 Verify

Your app gets a URL like `smart-irrigation-api-abc12.ondigitalocean.app`.

```bash
curl https://<your-do-url>/api/health
# {"status":"ok","version":"1.0.0","model":{"available":true,"error":null,"classes":38}}
```

If `model.available` is `false`, the .tflite is missing from the deployed image.
Confirm it's in Git and re-deploy.

---

## 5. Deploy the frontend to Vercel

### 5.1 Connect the repo

1. [vercel.com](https://vercel.com) → **Add New Project** → import the GitHub repo.
2. **Root directory: `frontend`**.
3. Framework preset: **Next.js** (auto-detected).
4. Build command: leave default (`next build`).
5. Output directory: leave default (`.next`).

### 5.2 Environment variables

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from §2.3 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from §2.3 |
| `NEXT_PUBLIC_API_URL` | `https://<your-do-url>` (from §4.4) |

Set them for **Production**, **Preview**, and **Development**.

### 5.3 Deploy

Click **Deploy**. First build takes ~2 min. You'll get a URL like
`smart-irrigation.vercel.app`.

### 5.4 Connect the dots

- **DigitalOcean → Settings → App-Level Environment Variables**: update
  `ALLOWED_ORIGINS` to include the Vercel URL (comma-separated, no trailing slash).
  Redeploy backend.
- **Supabase → Authentication → URL Configuration**: add the Vercel URL to
  *Site URL* and *Redirect URLs* so OAuth/email confirmation links work.

---

## 6. Post-deploy: keep-alive, CORS, smoke test

### 6.1 Keep Supabase awake

Supabase free projects pause after **7 days** of zero DB activity. Set up a
ping to prevent this:

**UptimeRobot** (free, easiest):

1. [uptimerobot.com](https://uptimerobot.com) → **New monitor**.
2. Type **HTTP(s)**, URL `https://<your-do-url>/api/health`, interval **5 min**.
   This call hits Supabase through `auth.users` lookup, which counts as activity.
3. Add a second monitor for `https://<your-vercel-url>/` (catches frontend dead-deploys).

**GitHub Actions cron** (alternative):

```yaml
# .github/workflows/keepalive.yml
name: keepalive
on:
  schedule: [{cron: "0 */6 * * *"}]   # every 6 hours
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS https://<your-do-url>/api/health
      - run: curl -fsS https://<your-do-url>/api/crops
```

### 6.2 Smoke test checklist

Run this against production right after each deploy:

- [ ] `GET /api/health` returns 200 with `model.available: true`
- [ ] `GET /api/crops` returns 10 crops
- [ ] `GET /api/regions` returns 12 Moroccan regions
- [ ] Landing page loads at `/fr` and `/ar` (RTL renders correctly)
- [ ] Register a fresh test account → email confirmation arrives
- [ ] Login → Dashboard loads, charts render empty without errors
- [ ] Irrigation form: pick crop + region + soil → submit → recommendation displayed in both languages
- [ ] Disease detection: upload a tomato-leaf image → diagnosis + treatment shown
- [ ] Promote yourself to admin (§2.4) → admin sidebar appears → all five admin pages load
- [ ] Submit a contact form anonymously → message appears in `/fr/admin/contacts`
- [ ] Subscribe to the newsletter → row appears in `/fr/admin/newsletter`

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Backend boots but `/api/crops` returns 500 | Wrong `SUPABASE_SERVICE_KEY` or schema not loaded | Re-run §2.2 SQL, verify keys |
| Frontend 500: `Cannot find module '../messages/undefined.json'` | next-intl couldn't resolve locale | Re-check `i18n/request.js` (already fixed in repo) and middleware locale matcher |
| Disease predict returns 503 | `model.tflite` missing from deployed image | Verify file is committed; redeploy |
| Disease predict returns 401 | Frontend sending stale token | Sign out and back in to refresh JWT |
| Open-Meteo "Connection timed out" in logs | API blip — service falls back to last cached row automatically | Nothing to do; check `weather_cache` table |
| CORS error in browser | `ALLOWED_ORIGINS` doesn't include Vercel URL | Update env var on DigitalOcean and redeploy |
| Admin link doesn't appear | User row has `role='user'` | Run §2.4 promotion SQL, log out/in |
| Supabase auth emails not arriving | Free tier rate-limits | Configure SMTP under Auth → SMTP Settings |
| `Cannot connect to API: ECONNREFUSED` from frontend in dev | Backend not running on the port `NEXT_PUBLIC_API_URL` points to | `scripts/backend-dev.sh` or fix `.env.local` |
| Image upload silently returns empty `image_url` | `disease-images` bucket missing or RLS denies upload | Run `database/storage_bucket.sql` |
| `502 Bad Gateway` on DigitalOcean | First request after deploy / OOM on basic-xxs | Wait 30 s; if persistent, bump to basic-xs ($12/mo) or check Open-Meteo response size |

### Useful commands

```bash
# Tail backend logs on DigitalOcean
doctl apps logs <app-id> --type run --follow

# Inspect a JWT's contents (no signature verification)
python -c "import sys, json, jose.jwt as j; print(json.dumps(j.get_unverified_claims(sys.argv[1]), indent=2))" "$TOKEN"

# Reset local databases (DANGEROUS — wipes everything)
# In Supabase SQL editor:
#   TRUNCATE public.users CASCADE;       # cascades to predictions
```

---

## Quick reference

| What | Where |
|---|---|
| Architecture overview | [`implementation_plan.md`](implementation_plan.md) §1 |
| API endpoint list | [`implementation_plan.md`](implementation_plan.md) §5 |
| DB schema | [`database/schema.sql`](database/schema.sql) |
| Dev scripts | [`scripts/`](scripts/) |
| Training scripts | [`ml/`](ml/) |
| Backend code | [`backend/app/`](backend/app/) |
| Frontend code | [`frontend/app/`](frontend/app/) |
