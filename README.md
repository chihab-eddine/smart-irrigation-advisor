# Smart Irrigation Advisor

Bilingual (FR/AR) decision-support platform for Moroccan farmers. Combines
FAO-56 Penman-Monteith irrigation modelling with a MobileNetV2 plant-disease
classifier.

- **Frontend** — Next.js 16 + Tailwind + next-intl, deployed on Vercel
- **Backend** — FastAPI + TFLite + Supabase, deployed on DigitalOcean
- **Data** — Supabase Postgres + Storage, free tier
- **Weather** — Open-Meteo, free tier
- **Cost** — ~$6/mo, ~33 months runway on $200 DO credits

## Quick start

```bash
git clone <repo>
cd Smart_Irrigation_Advisor

scripts/setup.sh        # one-time: deps, env templates
# → fill in backend/.env and frontend/.env.local with Supabase credentials
scripts/dev.sh          # backend on :8000, frontend on :3000
```

`scripts/dev.sh` runs both servers with prefixed logs; Ctrl+C kills both.

You'll need a Supabase project set up first — see [DEPLOYMENT.md §2](DEPLOYMENT.md#2-supabase-setup).
Disease detection requires a trained `model.tflite` — see [DEPLOYMENT.md §3](DEPLOYMENT.md#3-train-the-disease-detection-model).

## What goes where

```
.
├── backend/                 # FastAPI app
│   ├── app/
│   │   ├── routers/         # one file per resource (irrigation, disease, admin, …)
│   │   ├── services/        # business logic: FAO ETo, TFLite inference, weather, storage
│   │   ├── models/          # Pydantic schemas + Supabase client
│   │   ├── ml/              # ← drop model.tflite + class_labels.json here
│   │   ├── dependencies.py  # JWT verification (HS256 + JWKS fallback)
│   │   ├── config.py
│   │   └── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .do/app.yaml         # DigitalOcean App Platform spec
│
├── frontend/                # Next.js 16 App Router
│   ├── app/[locale]/        # /fr/* and /ar/* (next-intl prefix routing)
│   │   ├── (auth)/          # login, register
│   │   ├── admin/           # admin dashboard + sub-pages
│   │   ├── dashboard/, irrigation/, disease/, profile/, contact/
│   │   └── layout.js
│   ├── components/          # Navbar, Icon, Spinner, LanguageSwitcher
│   ├── lib/                 # api.js (FastAPI client), supabase clients
│   ├── messages/{fr,ar}.json
│   └── middleware.js        # auth guard + admin guard + i18n routing
│
├── database/                # Supabase SQL — run in order
│   ├── schema.sql           # 1. tables + handle_new_user trigger
│   ├── rls_policies.sql     # 2. row-level security
│   ├── seed_data.sql        # 3. crops, regions, soil types
│   └── storage_bucket.sql   # 4. disease-images bucket + RLS
│
├── ml/                      # Training pipeline
│   ├── train_disease_model.py    # MobileNetV2 transfer-learning
│   ├── convert_to_tflite.py      # INT8 quantization
│   ├── evaluate_model.py         # sanity-check converted model
│   └── requirements.txt
│
├── scripts/                 # Local-dev runners
│   ├── setup.sh             # one-time installer
│   ├── dev.sh               # both servers, parallel
│   ├── backend-dev.sh
│   └── frontend-dev.sh
│
├── implementation_plan.md   # spec (architecture, endpoints, scope)
├── DEPLOYMENT.md            # step-by-step ops runbook ← READ THIS
└── README.md                # you are here
```

## Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** — local setup, Supabase, model training, DO + Vercel deploy, smoke test checklist, troubleshooting.
- **[implementation_plan.md](implementation_plan.md)** — original spec: architecture, endpoint list, DB schema, cost model.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, next-intl 4, Recharts |
| Backend | FastAPI, ai-edge-litert, Pillow, httpx, python-jose, supabase-py |
| Database | Supabase Postgres + Storage |
| ML | MobileNetV2 (PlantVillage, 38 classes) → TFLite INT8 |
| Weather | Open-Meteo |
| Deploy | Vercel (Hobby) + DigitalOcean App Platform (basic-xxs) |

## Conventions

- **All commits go on `main` for now** — once production traffic exists, switch to PR workflow.
- **Locales**: prefix routing (`/fr/*`, `/ar/*`) — never link to bare paths without a locale.
- **Currency / units**: metric only (mm of water, °C, km/h wind, ha of land).
- **Time zones**: store everything as UTC, render in `Africa/Casablanca`.
