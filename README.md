# RelayBoard API

RelayBoard API is a REST backend for collaborative task management. It models workspaces, projects, and project-scoped tasks while enforcing JWT authentication and workspace-role authorization.

## Current capabilities

- Register and log in with hashed passwords and JWTs.
- Create workspaces and automatically register their creator as the `OWNER`.
- Create and list projects inside a workspace; only `OWNER` and `ADMIN` roles can create projects.
- Create, list, and update task status inside a project.
- Reject requests for projects outside the caller's workspace.
- Run PostgreSQL locally with Docker.

## Tech stack

Node.js, Express, PostgreSQL, Prisma ORM, Docker, bcryptjs, and JSON Web Tokens.

## Local setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and set a long random `JWT_SECRET`.
3. Start PostgreSQL: `docker compose up -d db`
4. Apply the schema: `npm run prisma:migrate`
5. Start the API: `npm run dev`

The API runs at `http://localhost:2121` by default. Visit `GET /health` to confirm that it is running.

## API endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/auth/register` | Create an account and receive a JWT. |
| POST | `/auth/login` | Log in and receive a JWT. |
| GET | `/workspaces` | List workspaces the authenticated user belongs to. |
| POST | `/workspaces` | Create a workspace and assign its creator the `OWNER` role. |
| GET | `/workspaces/:workspaceId/projects` | List projects in a workspace. |
| POST | `/workspaces/:workspaceId/projects` | Create a project (`OWNER` or `ADMIN`). |
| GET | `/workspaces/:workspaceId/projects/:projectId/tasks` | List a project's tasks. |
| POST | `/workspaces/:workspaceId/projects/:projectId/tasks` | Create a task in a project. |
| PATCH | `/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/status` | Change a task to `TODO`, `IN_PROGRESS`, or `DONE`. |

Protected endpoints require this header:

```http
Authorization: Bearer <jwt>
```
