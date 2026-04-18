# Kevin AI v2 Private Beta Launch Guide

Kevin v2 must launch on a fully isolated stack so v1 production remains unchanged.

## Branching Model

- `main` continues serving v1 production only
- `release/v2-beta` is the long-lived branch for Kevin v2
- feature work for v2 should branch off `release/v2-beta`
- do not merge `release/v2-beta` into `main` until cutover approval

## Infrastructure Isolation

Create separate beta resources:

- Frontend beta app on Vercel
- Backend beta service on Render
- MongoDB database `kevin_ai_v2`
- beta-only environment variables, JWT secrets, OAuth origins, and support URLs

Never point v2 to the v1 database or v1 production frontend/backend URLs.

## Backend Beta Setup

Use [render.beta.yaml](C:\Users\shiva\Downloads\kevin_ai_bot-main\kevin_ai_bot-main\render.beta.yaml) or equivalent manual settings.

Required beta backend env:

- copy [backend/.env.beta.example](C:\Users\shiva\Downloads\kevin_ai_bot-main\kevin_ai_bot-main\backend\.env.beta.example)
- use `DB_NAME=kevin_ai_v2`
- use `APP_ENV=beta`
- use `APP_VERSION=v2`
- set `BETA_INVITE_ONLY=true`
- set `BETA_ALLOWED_EMAILS` to the invited tester list

Example beta URLs:

- frontend: `https://beta.yourdomain.com`
- backend: `https://api-beta.yourdomain.com`

## Frontend Beta Setup

- create a separate Vercel project for v2
- use branch `release/v2-beta`
- set root directory to `kevin_ai_bot-main/frontend`
- load env from [frontend/.env.beta.example](C:\Users\shiva\Downloads\kevin_ai_bot-main\kevin_ai_bot-main\frontend\.env.beta.example)

The frontend beta build exposes:

- a persistent environment banner
- beta/invite-only auth messaging
- separate API base URL support

## Google OAuth

Register separate JavaScript origins for beta, for example:

- `https://beta.yourdomain.com`
- `https://kevin-v2.vercel.app`

Do not rely on the v1 production origin registration for v2.

## Beta Acceptance Gates

Before promoting v2 beyond invited testers, confirm:

- auth works on beta only
- resume upload works
- interview start/continue/end works
- report generation works
- Google sign-in works on beta domain
- v2 data lands only in `kevin_ai_v2`
- v1 production URLs and data remain unchanged

## Cutover

Only after v2 is approved:

- freeze v1 feature changes temporarily
- merge `release/v2-beta` into `main`
- repoint production services after smoke tests
- keep the old v1 deployment available for rollback for at least 7 days
