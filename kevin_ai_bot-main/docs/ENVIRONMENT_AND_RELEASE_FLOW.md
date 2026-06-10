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

1. Work only on `dev` for feature implementation.
2. Push `dev` and open a pull request into `dev` if the work was done on a feature branch.
3. After approval, cherry-pick or merge the approved commit into `test`.
4. Run smoke tests in `test`.
5. Push `test` and open a pull request into `test` if the work was staged on a release branch.
6. After QA approval, cherry-pick or merge the validated commit into `prod`.
7. Deploy production only from `prod`.

## Required Checks Before Promotion

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
