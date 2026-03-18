# The Hat

The Hat is a full-stack multiplayer party game built with .NET on the backend and React on the frontend.

## Repository structure

- `src/backend/Api` — ASP.NET Core API host
- `src/backend/Contracts` — backend API contracts
- `src/backend/Domain` — game domain model and engine
- `src/backend/Persistance` — EF Core persistence with direct `DbContext` usage
- `src/backend/tests` — backend tests
- `src/frontend` — React + TypeScript frontend
- `src/shared` — shared contracts and cross-cutting code placeholder
- `docs` — backlog, issue tracking, and developer documentation

## Local development

### Containerized local setup

From the repository root:

1. Copy [.env.example](.env.example) to `.env` if you want to override default ports or the frontend API base URL.
2. Run `docker compose up --build`.
3. Open the frontend at `http://localhost:4173` and the backend health endpoint at `http://localhost:5000/health`.

Container environment variables:

- `THE_HAT_API_PORT` — host port mapped to the backend container, default `5000`
- `THE_HAT_FRONTEND_PORT` — host port mapped to the frontend container, default `4173`
- `VITE_API_BASE_URL` — frontend build-time API base URL used inside the container network, default `http://backend:8080`
- `ConnectionStrings__TheHat` — backend SQLite file path inside the container, default `/app/data/thehat.db`

Basic health check strategy:

- Backend exposes `/health` and reports database readiness.
- Compose waits for the backend health check before starting the frontend dependency chain.
- The SQLite database lives in the `thehat-data` named volume so room state survives backend restarts.

### Backend

From the repository root:

1. `dotnet restore src/backend/TheHat.slnx`
2. `dotnet run --project src/backend/Api`

The backend runs independently, persists room state in SQLite, and exposes a health endpoint at `/health`.

Currently implemented API:

- `POST /api/rooms` creates a lobby room for the host and returns the room snapshot plus a shareable invite link.

### Frontend

From the repository root:

1. `cd src/frontend`
2. `npm install`
3. `npm run dev`

The frontend runs independently with Vite.

Currently implemented frontend flow:

- `/` shows the entry page for room creation.
- `/create-room` lets the host configure initial settings and create a room.
- A successful create request routes the host to a simple lobby view at `/rooms/{roomId}/lobby`.

## Environment variable strategy

Local configuration follows framework conventions:

- Backend uses ASP.NET Core configuration sources such as `appsettings.json`, `appsettings.Development.json`, and environment variables.
- Frontend uses Vite `VITE_`-prefixed environment variables from `.env` files.

Example local variables:

- Backend: `ASPNETCORE_ENVIRONMENT=Development`
- Backend: `ASPNETCORE_URLS=http://localhost:5000`
- Backend: `ConnectionStrings__TheHat=Data Source=App_Data/thehat.development.db`
- Backend: `Cors__AllowedOrigins__0=http://localhost:5173`
- Frontend: `VITE_API_BASE_URL=http://localhost:5000`

Use [src/frontend/.env.example](src/frontend/.env.example) as the frontend starting point.

## Notes

- The solution file is [src/backend/TheHat.slnx](src/backend/TheHat.slnx).
- Issue backlog lives in [docs/features.md](docs/features.md).
- Progress tracking lives in [docs/issue-status.md](docs/issue-status.md).
- Domain model and contract documentation lives in [docs/domain-model.md](docs/domain-model.md).
