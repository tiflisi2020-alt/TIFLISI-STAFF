# Deploy TIFLISI-STAFF from GitHub

The application is a React frontend plus an Express/Node.js server. Its source repository is `https://github.com/tiflisi2020-alt/TIFLISI-STAFF`. A repository upload is not a running website. GitHub Pages cannot run this server, its OAuth callback, or its protected Supabase administrative API.

## Render setup

Open [Deploy to Render](https://render.com/deploy?repo=https://github.com/tiflisi2020-alt/TIFLISI-STAFF). Review the account and service terms before creating the service. The included `render.yaml` declares a Docker web service with a free compute plan and **automatic deployment disabled initially**. It does not create any service by itself and does not imply hosting has been authorized or completed.

The Dockerfile installs locked dependencies, builds the app and runs `node dist/index.js`. The server listens on `0.0.0.0` using the host's `PORT`, with a default of 3000. `/api/health` is an unauthenticated health endpoint. Data is stored in Supabase, not in the container filesystem.

Supply the environment variables declared in `.env.example` in the hosting dashboard. Never put real keys in GitHub, README files, `render.yaml`, frontend code or build output. The Supabase key must be a server-side service-role key for the existing restaurant-schedule project. Use a new rotated key because a previous key was shared in chat. The app's existing database tables and policies remain unchanged by deployment.

## Authentication must be configured separately

The current app uses **Manus OAuth**, not a Supabase password login. Preserve that provider unless a migration is explicitly agreed. The host needs the public OAuth project/client identifier and public authorization/API endpoints. Configure them in the dashboard; no real values are committed in this repository.

Use a fresh cryptographically random `MANUS_JWT_SECRET` for the standalone host. This secret signs this application's own sessions; it must not be copied from the Manus Preview environment. Existing Preview sessions will not work on the new host.

Before claiming login works, the new site's HTTPS callback URL (`https://YOUR-SERVICE.onrender.com/api/oauth/callback`) must be accepted by the Manus OAuth redirect policy. The source upload does **not** establish that acceptance. If the provider rejects the new origin, keep login closed and resolve callback registration or explicitly migrate authentication to Supabase. Do not bypass login or trust an email typed into a form to grant administrative access.

The manager identity remains `merabtamoevi@gmail.com`, checked from a real OAuth identity on the server. Normal employees cannot grant themselves the admin role. All administration routes remain server-protected.

## Checks before sharing the site

Confirm the build succeeds, `/api/health` returns HTTP 200, the roster is read from Supabase, `/admin` prompts anonymous visitors to sign in, and anonymous calls to the admin API are rejected. Then test a real manager login, account linking and an intentional schedule change with the restaurant owner. Avoid test writes to the live restaurant schedule.

After the first successful deployment, enable automatic deployment from `main` in the Render dashboard if desired. Until then, pushes only update the source and do not publish a live website.

## Local development

Install Node.js 22 and pnpm 10.18.0. Copy `.env.example` to an ignored `.env` file and supply runtime values. Run `pnpm install --frozen-lockfile`, then `pnpm dev`. Run `pnpm check`, `pnpm test` and `pnpm build` before deployment. `pnpm start` runs the production build. The browser OAuth callback still requires an accepted HTTPS origin; a local HTTP URL is not assumed to be permitted.

## Official references

- [Render blueprint specification](https://render.com/docs/blueprint-spec)
- [Render environment variables and secrets](https://render.com/docs/configure-environment-variables)
- [Docker on Render](https://render.com/docs/docker)
