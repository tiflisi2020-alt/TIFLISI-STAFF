# Deploy TIFLISI-STAFF from GitHub

The application is a React frontend plus an Express/Node.js server. Its source repository is `https://github.com/tiflisi2020-alt/TIFLISI-STAFF`. A repository upload is not a running website. GitHub Pages cannot run this server, its OAuth callback, or its protected Supabase administrative API.

## Render setup

Open [Deploy to Render](https://render.com/deploy?repo=https://github.com/tiflisi2020-alt/TIFLISI-STAFF). Review the account and service terms before creating the service. The included `render.yaml` declares a Docker web service with a free compute plan and **automatic deployment disabled initially**. It does not create any service by itself and does not imply hosting has been authorized or completed.

The Dockerfile installs locked dependencies, builds the app and runs `node dist/index.js`. The server listens on `0.0.0.0` using the host's `PORT`, with a default of 3000. `/api/health` is an unauthenticated health endpoint. Data is stored in Supabase, not in the container filesystem.

Supply the environment variables declared in `.env.example` in the hosting dashboard. Never put real keys in GitHub, README files, `render.yaml`, frontend code or build output. The Supabase key must be a server-side service-role key for the existing restaurant-schedule project. Use a new rotated key because a previous key was shared in chat. The app's existing database tables and policies remain unchanged by deployment.

## Authentication

Interactive login now uses **Supabase Auth email/password**, as explicitly approved by the restaurant owner. The deployed site is https://tiflisi-staff.vercel.app. See [Supabase Auth](supabase-auth.md) for verified-email requirements and exact redirect URLs. Signup/reset redirects are currently configured for this canonical Vercel origin. Moving to another hosting origin requires updating the explicit application origins and adding its exact login/reset redirect URLs first; Render has not been deployed.

`MANUS_PROJECT_ID` and `MANUS_JWT_SECRET` names remain for this application's own signed session audience/secret; they do not send users to Manus. Keep all server secrets in the host dashboard. The only admin email is `merabtamoevi@gmail.com`, verified by Supabase on the server. Do not grant access based on user metadata or an unconfirmed email.

## Checks before sharing the site

Confirm the build succeeds, `/api/health` returns HTTP 200, the roster is read from Supabase, `/admin` prompts anonymous visitors to sign in, and anonymous calls to the admin API are rejected. Then test a real manager login, account linking and an intentional schedule change with the restaurant owner. Avoid test writes to the live restaurant schedule.

After the first successful deployment, enable automatic deployment from `main` in the Render dashboard if desired. Until then, pushes only update the source and do not publish a live website.

## Local development

Install Node.js 22 and pnpm 10.18.0. Copy `.env.example` to an ignored `.env` file and supply runtime values. Run `pnpm install --frozen-lockfile`, then `pnpm dev`. Run `pnpm check`, `pnpm test` and `pnpm build` before deployment. `pnpm start` runs the production build. Login forms currently target the canonical HTTPS deployment origin.

## Official references

- [Render blueprint specification](https://render.com/docs/blueprint-spec)
- [Render environment variables and secrets](https://render.com/docs/configure-environment-variables)
- [Docker on Render](https://render.com/docs/docker)
