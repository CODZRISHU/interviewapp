# Kevin AI CI/CD and DevOps

Kevin AI uses a strict-free, low-complexity delivery setup:

- GitHub Actions validates every PR into `dev`, `test`, and `prod`.
- Vercel deploys the React frontend from Git.
- Render deploys the FastAPI backend from Git.
- Docker is used for local backend parity and CI build confidence, not as the required production deployment path.

## Branch and Deployment Map

| Branch | Purpose | Deployment behavior |
| --- | --- | --- |
| Feature branches | Single-task implementation | CI runs; Vercel can create frontend previews |
| `dev` | Approved development integration | CI runs; no production deployment |
| `test` | QA and release candidate validation | CI runs; staging/test validation lane |
| `prod` | Production release branch | CI runs; Vercel and Render production deploy from here |

Production must deploy only from `prod`.

## GitHub Actions

The workflow lives at `.github/workflows/ci.yml` and runs on:

- Pull requests into `dev`, `test`, and `prod`
- Pushes to `dev`, `test`, and `prod`

Checks:

- Backend dependency install and `python -m compileall .`
- Future backend `pytest` hook when `pytest` is added
- Frontend dependency install, test command, and production build
- Backend Docker image build without pushing to a registry

## Required GitHub Branch Protection

Configure these rules in GitHub for `dev`, `test`, and `prod`:

- Require pull requests before merging
- Require the GitHub Actions CI checks to pass
- Block direct pushes except an emergency admin override
- Require branches to be up to date before merging when practical

Keep the standing rule: every change starts from the latest `dev` branch, then goes through a feature branch PR back into `dev`.

## Vercel Frontend Setup

Use the existing `frontend/vercel.json`.

Recommended project settings:

- Root directory: `kevin_ai_bot-main/frontend`
- Framework preset: Create React App
- Build command: `corepack yarn build`
- Output directory: `build`
- Production branch: `prod`

Environment variables:

- `REACT_APP_API_BASE_URL`
- `REACT_APP_GOOGLE_CLIENT_ID`

Use Vercel preview deployments for feature branches and `dev`.

## Render Backend Setup

Use the existing `render.yaml` for the production backend.

Recommended service settings:

- Root directory: `kevin_ai_bot-main/backend`
- Runtime: Python
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health check path: `/health`
- Production branch: `prod`

Required Render environment variables are listed in `config/environments/backend.prod.example`.

Render free services can cold start, restart, and have usage limits. This is accepted for the strict-free setup.

## Local Docker

Activate a local environment first:

```powershell
.\scripts\use-env.ps1 dev
```

Run backend and MongoDB:

```powershell
docker compose up --build
```

Docker Desktop must be running before Docker build or Compose commands can start containers on Windows.

Backend:

- `http://localhost:8000`
- Health: `http://localhost:8000/health`

MongoDB:

- `mongodb://localhost:27017`

The Compose backend overrides `MONGO_URL` to use the local `mongo` container.

## Secrets

Never commit `.env` files or production secrets.

Store secrets in:

- GitHub repository secrets for future CI-only secrets
- Vercel environment variables for frontend public config
- Render environment variables for backend secrets
- MongoDB Atlas for database credentials

## Rollback

Production rollback should be simple:

1. Revert the bad commit on `prod`.
2. Push `prod`.
3. Let Vercel and Render redeploy from Git.
4. Verify `/health`, login, resume upload, interview start, and report generation.
