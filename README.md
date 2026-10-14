# Forge

Log your workouts like Strong: start one (or repeat your last), check off sets with a rest timer between them, and see
your history and personal records. Habits and nutrition (with nutrition-label scanning) come next, then an iPhone app.

Built with .NET 10, ASP.NET Core, EF Core, and SQL Server, with a React + TypeScript + Tailwind web app. It follows
NextTrain's setup (`../NextTrain`).

## How it works

- **Sign in with Apple** (iPhone). `POST /auth/apple` checks Apple's identity token and returns Forge's own token, sent as
  `Authorization: Bearer`; the API turns it into the account's `X-User-Id`, which every table is keyed by. So your data
  comes back on a new phone or after reinstalling. The first sign-in keeps the anonymous ID a beta build had made up on
  that phone, so beta data carries over. In a browser (development), the app still sends a made-up `X-User-Id`.
- **A workout in progress lives on the phone** (`localStorage`) until you tap Finish, so a reload or no signal at the gym
  loses nothing. Finish saves it with `PUT /workouts/{id}`, where the app made up the ID: a retry after a lost response
  can never save it twice, and editing a past workout is the same call. If you're offline, it uploads when you're back.
- **PRs**: a set is a PR when its estimated one-rep max (Epley) beats every earlier workout's for that exercise (reps,
  for bodyweight exercises).

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/exercises` | The built-in exercises and yours, by name |
| POST | `/exercises` | Add your own: `{ "name": "Zercher Squat", "muscleGroup": "Legs" }` |
| GET | `/workouts` | Your workouts with their sets, newest first |
| GET | `/workouts/{id}` | One workout |
| PUT | `/workouts/{id}` | Save a finished workout: creates it (201) or replaces it and its sets (200) |
| DELETE | `/workouts/{id}` | Delete a workout and its sets |
| GET | `/health` | 200 when the database is reachable, 503 when not |

Everything except `/health` and `/auth/apple` needs a sign-in token (or, until `Auth__RequireSignIn` is on, the `X-User-Id` header). Weights are in pounds. Example `PUT` body:

```json
{ "name": "Push day", "startedAt": "2026-10-10T21:00:00Z", "finishedAt": "2026-10-10T21:55:00Z",
  "sets": [ { "exerciseId": 1, "weight": 135, "reps": 8 }, { "exerciseId": 1, "weight": 135, "reps": 6 } ] }
```

## Run locally

Requires the .NET 10 SDK, Node 24, and SQL Server on `localhost` (Windows authentication).

```
dotnet run --project Forge.Api                    # API at http://localhost:5212 (Swagger at /swagger); creates ForgeDb
cd Forge.Web && npm install && npm run dev        # web app at http://localhost:5174, forwards /api/* to the API
```

The ports differ from NextTrain's, so both can run at once.

## Tests

```
dotnet test Forge.slnx
cd Forge.Web && npm run lint && npm test && npm run build
```

API tests run against a real SQL Server database (`ForgeDb_Tests` on `localhost` by default; override with the
`FORGE_TEST_DB` connection string). Web tests (Vitest) cover PRs, estimated 1RM, "Previous" values, and the
workout-in-progress logic. CI runs all of it on every pull request.

## Project layout

- `Forge.Api`: `Program.cs` (start-up and middleware), `Controllers/`, `Domain/` (entities), `Data/` (EF Core DbContext,
  built-in exercises), `Migrations/`
- `Forge.Tests`: xUnit endpoint and hosting tests
- `Forge.Web`: React app (Vite, Tailwind, React Router). `src/draft.ts` is the workout in progress, `src/workouts.ts`
  the PR and formatting logic, `src/pages/` the screens

## Hosting (Azure)

Merging to `main` deploys automatically once CI passes (`.github/workflows/deploy.yml`):

| Piece | Azure service (resource group `forge-rg`) | Cost |
|---|---|---|
| Website | Static Web Apps `forge-web` (Free) | $0 |
| API | Container Apps `forge-api` (Consumption, 0.25 vCPU, scales to zero), image on ghcr.io | ~$0 |
| Database | Azure SQL `ForgeDb` on `forge-sql-fz1r03`, Basic (5 DTU, 2 GB) | ~$5/month |

The API scales to zero when idle, so the first request after a quiet spell waits for it to start (seconds, sometimes
longer). If that gets annoying, add a `cron` scale rule like NextTrain's to keep one instance up during the day.

Production settings live in Azure, never in the repo: the connection string is the Container App secret `db-conn`, and
`Cors__AllowedOrigins__2` adds the website's address. Sign-in needs the secret `Auth__SigningKey` (32+ random
characters; changing it signs everyone out), and Delete Account's Apple revoke needs `Auth__AppleTeamId`,
`Auth__AppleKeyId`, and `Auth__AppleP8` (a Sign in with Apple key from developer.apple.com → Keys). Once the beta
testers have signed in, set `Auth__RequireSignIn=true` to stop accepting the anonymous `X-User-Id`. GitHub signs in to Azure with OIDC (the `forge-github-deploy` app,
Contributor on `forge-rg` only) using the `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID` repository
variables; `API_URL` is the address the website calls, and the `SWA_DEPLOY_TOKEN` secret uploads it. **If the API
address changes, update `connect-src` in `Forge.Web/public/staticwebapp.config.json`**, or the website can't reach it.

To stop all costs: `az group delete -n forge-rg`.
