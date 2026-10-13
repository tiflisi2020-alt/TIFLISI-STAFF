# TIFLISI-STAFF


Restaurant „ტიფლისი“ staff scheduling application, with a Georgian interface, weekly schedules, team directory, shift-swap requests and a protected administration page.

## Run the website

This repository contains both the React frontend and the Node.js backend. **Uploading code to GitHub does not publish a running website.** Use a server host, not GitHub Pages.

[Deploy using the Render blueprint](https://render.com/deploy?repo=https://github.com/tiflisi2020-alt/TIFLISI-STAFF)

Read [the deployment guide](docs/deployment.md) before launching. Supply secret values only in the host dashboard. The server's `/api/health` endpoint checks that the process is running; it does not prove login is configured. The new HTTPS OAuth callback must be accepted before external login can work.

## Application pages

`/` — dashboard; `/schedule` — weekly schedule; `/team` — employees; `/profile` — account and requests; `/swap` — shift-swap request; `/admin` — manager controls.

The admin identity is verified from a real OAuth login. Admin controls include individual schedule editing, request review and employee-account linking. Approving a request changes its status only; final schedule edits are separate.

## Development

Use Node.js 22 and pnpm 10.18.0. Create an ignored `.env` from `.env.example`, then run:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

For production:

```sh
pnpm check
pnpm test
pnpm build
pnpm start
```

Never commit `.env`, the Supabase service-role key, or application session signing secrets. No database contents or real secret credentials are included in this repository.

## Vercel deployment

The repository now includes `vercel.json` and a serverless Express API handler. Import the repository with **Framework: Other**, root directory at the repository root, build command `pnpm run build:vercel`, output directory `.vercel/output`, and Node.js 22.x. Configure runtime secrets in Vercel, never in GitHub. See [the Georgian Vercel guide](docs/vercel.md) for exact values and the external OAuth callback prerequisite. Deployment readiness is not proof of a live Vercel deployment or a working external login.
