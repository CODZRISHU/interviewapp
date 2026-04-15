# Kevin AI

Kevin AI is a resume-aware mock interview platform with a React frontend and a FastAPI backend. It is now configured as an owned stack with backend-controlled AI, MongoDB storage, JWT auth, Google OAuth support, and no subscription/paywall flow in the main app experience.

## Stack

- Frontend: React + Tailwind + CRACO
- Backend: FastAPI
- Database: MongoDB Atlas or local MongoDB
- AI: Gemini or OpenAI from the backend only
- Voice: Browser speech recognition for MVP, optional backend transcription providers later

## Project Structure

```text
frontend/
  src/
    components/
    context/
    pages/
    services/

backend/
  controllers/
  middleware/
  models/
  routes/
  services/
  utils/
  main.py

render.yaml
```

## Local Development

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
corepack yarn install
corepack yarn start
```

## Environment Variables

### Backend

Copy [backend/.env.example](C:\Users\shiva\Downloads\kevin_ai_bot-main\kevin_ai_bot-main\backend\.env.example) to `backend/.env`.

Required production values:

- `ENVIRONMENT=production`
- `MONGO_URL`
- `DB_NAME`
- `JWT_SECRET_KEY`
- `JWT_REFRESH_SECRET_KEY`
- `FRONTEND_APP_URL`
- `PUBLIC_APP_URL`
- `CORS_ORIGINS`
- `GOOGLE_CLIENT_ID` if using Google sign-in
- `GEMINI_API_KEY` or `OPENAI_API_KEY`

Recommended:

- `GEMINI_MODEL=gemini-2.5-flash-lite`
- `STT_PROVIDER=browser`
- `SUPPORT_EMAIL=support@yourdomain.com`

### Frontend

Copy [frontend/.env.example](C:\Users\shiva\Downloads\kevin_ai_bot-main\kevin_ai_bot-main\frontend\.env.example) to `frontend/.env`.

```env
REACT_APP_API_BASE_URL=https://api.yourdomain.com/api
REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id
```

## Deploy to Production

### 1. MongoDB Atlas

Create a MongoDB Atlas cluster and create a database user.

Use:

- `MONGO_URL=mongodb+srv://<user>:<password>@cluster.mongodb.net/`
- `DB_NAME=kevin_ai`

In Atlas:

- allow the backend host IP or use `0.0.0.0/0` during initial setup
- then tighten network access later if needed

### 2. Backend on Render

This repo includes [render.yaml](C:\Users\shiva\Downloads\kevin_ai_bot-main\kevin_ai_bot-main\render.yaml), so you can deploy the backend with Render Blueprint or create the service manually.

Manual Render settings:

- Root directory: `backend`
- Environment: `Python`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health check path: `/health`

Set these environment variables in Render:

```env
ENVIRONMENT=production
MONGO_URL=mongodb+srv://<user>:<password>@cluster.mongodb.net/
DB_NAME=kevin_ai
JWT_SECRET_KEY=use-a-long-random-secret
JWT_REFRESH_SECRET_KEY=use-another-long-random-secret
FRONTEND_APP_URL=https://app.yourdomain.com
PUBLIC_APP_URL=https://app.yourdomain.com
CORS_ORIGINS=["https://app.yourdomain.com"]
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-2.5-flash-lite
STT_PROVIDER=browser
GOOGLE_CLIENT_ID=your-google-client-id
SUPPORT_EMAIL=support@yourdomain.com
```

If you prefer OpenAI instead of Gemini:

```env
OPENAI_API_KEY=your-openai-key
OPENAI_MODEL=gpt-4o-mini
```

### 3. Frontend on Vercel

Import the `frontend` folder as a Vercel project.

Recommended settings:

- Framework preset: Create React App
- Root directory: `frontend`
- Build command: `npm install && npx craco build`
- Output directory: `build`

Set these Vercel environment variables:

```env
REACT_APP_API_BASE_URL=https://api.yourdomain.com/api
REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id
```

This repo includes [frontend/vercel.json](C:\Users\shiva\Downloads\kevin_ai_bot-main\kevin_ai_bot-main\frontend\vercel.json) so React Router routes resolve correctly in production.

### 4. Google OAuth Setup

In Google Cloud Console:

- create or open your OAuth client
- add authorized JavaScript origins:
  - `http://localhost:3000`
  - `https://app.yourdomain.com`

Use the same client ID in:

- backend `GOOGLE_CLIENT_ID`
- frontend `REACT_APP_GOOGLE_CLIENT_ID`

### 5. Custom Domains

Recommended domain split:

- Frontend: `app.yourdomain.com`
- Backend: `api.yourdomain.com`

Then use:

- `FRONTEND_APP_URL=https://app.yourdomain.com`
- `PUBLIC_APP_URL=https://app.yourdomain.com`
- `REACT_APP_API_BASE_URL=https://api.yourdomain.com/api`

## Core Endpoints

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/google`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/config`

Interview:

- `POST /api/upload-resume`
- `GET /api/resume`
- `POST /api/start-interview`
- `POST /api/next-question`
- `POST /api/end-interview`
- `GET /api/interviews`
- `GET /api/interviews/{id}`

Reports:

- `GET /api/reports`
- `GET /api/reports/{id}`

## Production Checklist

- MongoDB Atlas connection works
- `/health` returns OK on Render
- frontend points to the correct backend API URL
- register/login works
- Google sign-in works if enabled
- resume upload works
- interview start works
- next-question works
- report generation works
- no AI keys are exposed in the frontend
- only backend calls Gemini/OpenAI

## Notes

- The app currently uses browser-based speech recognition for the simplest SaaS-friendly setup.
- Frontend billing/subscription UI was removed from the active app flow.
- There is still some old backend billing code in the repo, but it is not required for deploying the current no-subscription version.
