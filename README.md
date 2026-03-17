# The Hat

The Hat is a full-stack multiplayer party game built with .NET on the backend and React on the frontend.

## Repository structure

- `src/backend` — ASP.NET Core backend API
- `src/frontend` — React + TypeScript frontend
- `src/shared` — shared contracts and cross-cutting code placeholder
- `docs` — backlog, issue tracking, and developer documentation

## Local development

### Backend

From the repository root:

1. `dotnet restore src/backend/TheHat.slnx`
2. `dotnet run --project src/backend`

The backend runs independently and exposes the default ASP.NET Core API surface.

### Frontend

From the repository root:

1. `cd src/frontend`
2. `npm install`
3. `npm run dev`

The frontend runs independently with Vite.

## Environment variable strategy

Local configuration follows framework conventions:

- Backend uses ASP.NET Core configuration sources such as `appsettings.json`, `appsettings.Development.json`, and environment variables.
- Frontend uses Vite `VITE_`-prefixed environment variables from `.env` files.

Example local variables:

- Backend: `ASPNETCORE_ENVIRONMENT=Development`
- Backend: `ASPNETCORE_URLS=http://localhost:5000`
- Frontend: `VITE_API_BASE_URL=http://localhost:5000`

Use [src/frontend/.env.example](src/frontend/.env.example) as the frontend starting point.

## Notes

- The solution file is [src/backend/TheHat.slnx](src/backend/TheHat.slnx).
- Issue backlog lives in [docs/features.md](docs/features.md).
- Progress tracking lives in [docs/issue-status.md](docs/issue-status.md).
