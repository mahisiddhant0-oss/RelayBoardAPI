# RelayBoard API

RelayBoard API is a REST backend for collaborative task management. It models workspaces, projects, and project-scoped tasks while enforcing JWT authentication and workspace-role authorization.

For the design story and interview talking points, see [interview_planning.md](interview_planning.md).

## Current capabilities

- Register and log in with hashed passwords and JWTs.
- Create workspaces and automatically register their creator as the `OWNER`.
- Let owners rename or delete their workspaces; deletion removes the workspace's projects and tasks.
- Create and list projects inside a workspace; only `OWNER` and `ADMIN` roles can create projects.
- Edit and delete projects with role checks; deleting a project also deletes its tasks.
- Create, list, and update task status inside a project.
- List and add workspace members; owners can grant admin access, and admins can add members.
- Assign tasks to workspace members, edit task details, and delete tasks with role checks.
- Remove members while automatically clearing their task assignments.
- Reject requests for projects outside the caller's workspace.
- Run PostgreSQL locally with Docker.

## Tech stack

Node.js, Express, PostgreSQL, Prisma ORM, Docker, bcryptjs, and JSON Web Tokens.

## Local setup

Requirements: Node.js 22+, npm, and Docker with Compose. Run these commands from the repository root:

```bash
npm ci
cp .env.example .env
docker compose up -d db
npm run prisma:migrate
npm run prisma:generate
npm run dev
```

Before starting the API, replace the example `JWT_SECRET` in `.env` with a long random value. The example database URL points to the PostgreSQL container on `localhost:5432`. Keep `.env` private; it is ignored by Git.

The API runs at `http://localhost:2121` by default. Visit `GET /health` to confirm that it is running.

## Try the API

Register an owner. Save the `token` from the response and use it in later requests:

```bash
curl -X POST http://localhost:2121/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"owner@example.com","password":"example-password-123"}'
```

Create a workspace with your JWT. Replace `YOUR_TOKEN` with the token value only, without angle brackets:

```bash
curl -X POST http://localhost:2121/workspaces \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{"name":"Demo team"}'
```

Use the returned workspace `id` to create a project. Then use the project `id` to create tasks:

```bash
curl -X POST http://localhost:2121/workspaces/1/projects \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{"name":"Launch board"}'

curl -X POST http://localhost:2121/workspaces/1/projects/1/tasks \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{"title":"Write release notes"}'
```

Replace each `1` with the actual ID returned by your API. To add a teammate, they must register first; then the owner can call `POST /workspaces/:workspaceId/members` with `{"username":"teammate@example.com","role":"MEMBER"}`.

### Workspace permissions

| Action | OWNER | ADMIN | MEMBER |
| --- | --- | --- | --- |
View projects, members, and tasks | Yes | Yes | Yes |
Create or edit tasks and update status | Yes | Yes | Yes |
Create, edit, or delete projects; assign or delete tasks | Yes | Yes | No |
Add or remove members | Yes | Yes (members only) | No |
Add an admin; rename or delete workspace | Yes | No | No |

Removing a member clears their task assignments. Deleting a project or workspace also deletes its nested tasks; these delete requests cannot be undone through the API.

## API endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/auth/register` | Create an account and receive a JWT. |
| POST | `/auth/login` | Log in and receive a JWT. |
| GET | `/workspaces` | List workspaces the authenticated user belongs to. |
| POST | `/workspaces` | Create a workspace and assign its creator the `OWNER` role. |
| PATCH | `/workspaces/:workspaceId` | Rename a workspace (`OWNER` only). |
| DELETE | `/workspaces/:workspaceId` | Delete a workspace and its content (`OWNER` only). |
| GET | `/workspaces/:workspaceId/members` | List members (`OWNER`, `ADMIN`, `MEMBER`). |
| POST | `/workspaces/:workspaceId/members` | Add an existing user (`OWNER` or `ADMIN`); only owners can add admins. |
| DELETE | `/workspaces/:workspaceId/members/:userId` | Remove a member and unassign their tasks (`OWNER` or `ADMIN`); the owner cannot be removed. |
| GET | `/workspaces/:workspaceId/projects` | List projects in a workspace. |
| POST | `/workspaces/:workspaceId/projects` | Create a project (`OWNER` or `ADMIN`). |
| PATCH | `/workspaces/:workspaceId/projects/:projectId` | Edit a project (`OWNER` or `ADMIN`). |
| DELETE | `/workspaces/:workspaceId/projects/:projectId` | Delete a project and its tasks (`OWNER` or `ADMIN`). |
| GET | `/workspaces/:workspaceId/projects/:projectId/tasks` | List a project's tasks; optionally filter with `?status=TODO`, `IN_PROGRESS`, or `DONE`. |
| POST | `/workspaces/:workspaceId/projects/:projectId/tasks` | Create a task in a project. |
| PATCH | `/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/status` | Change a task to `TODO`, `IN_PROGRESS`, or `DONE`. |
| PATCH | `/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/assignee` | Assign by username, or send `null` to unassign (`OWNER` or `ADMIN`). |
| PATCH | `/workspaces/:workspaceId/projects/:projectId/tasks/:taskId` | Edit task title or description. |
| DELETE | `/workspaces/:workspaceId/projects/:projectId/tasks/:taskId` | Delete a task (`OWNER` or `ADMIN`). |

Protected endpoints require this header:

```http
Authorization: Bearer <jwt>
```

## Tests

With the local PostgreSQL container running and migrations applied, run `npm test`. The integration test creates temporary accounts and a workspace, checks role-based access, and cleans up its test data. GitHub Actions runs this suite against a fresh PostgreSQL service on every push and pull request.
