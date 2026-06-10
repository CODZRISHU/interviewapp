# Kevin AI Environment and Release Flow

Kevin AI now uses three controlled environments and a strict promotion path.

## Environments

| Environment | Branch | Purpose | Data |
| --- | --- | --- | --- |
| `dev` | `dev` | Local development and active implementation | Disposable development data |
| `test` | `test` | QA, smoke testing, and release candidate validation | Isolated test data |
| `prod` | `prod` | Production baseline and live release branch | Production data only |

`main` is the imported production baseline from the original repository. Treat `prod` as the production working branch from this point forward.

## Local Environment Activation

From the app root:

```powershell
.\scripts\use-env.ps1 dev
```

Available options:

```powershell
.\scripts\use-env.ps1 dev
.\scripts\use-env.ps1 test
.\scripts\use-env.ps1 prod
```

The script copies tracked templates from `config/environments` into:

- `backend/.env`
- `frontend/.env`

These generated `.env` files are intentionally ignored by git.

## Backend Runtime Selection

The backend reads `backend/.env` by default. If a specific file is needed, start the backend with `ENV_FILE`:

```powershell
$env:ENV_FILE=".env"
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Promotion Rules

1. Start every task from the latest `dev` branch.
2. Create a feature branch from `dev` for every single code or documentation change.
3. Make the change only on that feature branch.
4. Validate the change locally.
5. Push the feature branch and open a pull request back into `dev`.
6. After approval, merge the feature branch into `dev`.
7. Promote approved `dev` changes into `test` through a PR or cherry-pick.
8. Run smoke tests in `test`.
9. After QA approval, promote the validated change into `prod`.
10. Deploy production only from `prod`.

Do not commit directly to `dev`, `test`, or `prod` unless explicitly instructed for an emergency fix.

## Required Checks Before Promotion

GitHub Actions runs these checks automatically on pull requests into `dev`, `test`, and `prod`.

Backend:

```powershell
cd backend
python -m compileall .
```

Frontend:

```powershell
cd frontend
corepack yarn test --watchAll=false
corepack yarn build
```

Smoke test:

- `GET /health` returns `{"status":"ok","service":"Kevin AI"}`
- Registration/login works
- Resume upload works
- Interview start works
- Next question works
- Report generation works

See `docs/DEVOPS_CICD.md` for the complete CI/CD, deployment, Docker, and rollback setup.

## Environment Ownership

Never reuse production secrets in `dev` or `test`.

Recommended databases:

- `kevin_ai_dev`
- `kevin_ai_test`
- `kevin_ai`

Recommended domains:

- Dev frontend: `http://localhost:3000`
- Dev backend: `http://localhost:8000`
- Test frontend: staging/test URL
- Test backend: staging/test API URL
- Prod frontend: `https://app.yourdomain.com`
- Prod backend: `https://api.yourdomain.com`
