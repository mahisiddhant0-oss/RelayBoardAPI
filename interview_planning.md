# RelayBoard API — interview preparation

This is a speaking guide for the **current implementation**. Use it to explain your own choices in an interview; adapt the wording to your experience. Keep claims about deployment, scale, and CI results for when they are actually verified.

## The 30-second introduction

> "RelayBoard API is a Node.js and Express REST API for teams to organize work. A user can create a workspace, add members, create projects, and manage tasks within those projects. I used PostgreSQL with Prisma for the data model, JWT for authentication, and workspace roles for authorization. The interesting part is making sure a task or project can only be accessed through its own workspace, while owners, admins, and members get different permissions. I added database-backed integration tests for those flows."

## If the interviewer asks for the full story

**Problem:** A personal to-do API is useful for learning CRUD, but real teams need shared work, ownership, and access rules. RelayBoard extends that idea to multiple workspaces, each containing projects and tasks.

**My design:** The data follows `User → WorkspaceMember → Workspace → Project → Task`. `WorkspaceMember` is a separate table so a user can join multiple workspaces with a different role in each. A task belongs to one project, and can optionally be assigned to a user who is a member of that workspace. Prisma defines the relationships and migrations; PostgreSQL stores the data.

**Request flow:** On a protected endpoint, the client sends `Authorization: Bearer <token>`. The authentication middleware verifies the JWT and puts the user's ID on the request. Workspace middleware looks up that user's membership and checks the required role. For project and task routes, another middleware verifies that the project ID belongs to the workspace ID in the URL. Route handlers then validate inputs and operate on the database.

**Example:** An owner registers, creates a workspace, and creates a project. Another registered user is added as a member. Both can create tasks and update their status; only the owner or an admin can assign tasks, manage projects, or remove members. Only the owner can rename or delete the workspace. If someone tries `/workspaces/1/projects/42/tasks` and project `42` belongs to another workspace, the request fails instead of crossing the workspace boundary.

## Decisions I should be able to explain

| Decision | Why it exists | Where to show it |
| --- | --- | --- |
| Separate membership table with `OWNER`, `ADMIN`, `MEMBER` | Role belongs to a **user within a workspace**, not globally to the user. A unique `(userId, workspaceId)` pair prevents duplicate memberships. | `prisma/schema.prisma`, `src/middleware/requireWorkspaceRole.js` |
| JWT plus password hashing | Passwords are stored as bcrypt hashes; login returns a signed token used on protected requests. Middleware requires a correctly formatted Bearer header and verifies the token, while membership checks decide what that caller can do. | `src/routes/authRoutes.js`, `src/middleware/authMiddleware.js` |
| Project lookup scoped to workspace | An ID alone should not give access to a project from a different workspace. The lookup requires both the project ID and workspace ID. | `src/middleware/requireProjectInWorkspace.js` |
| Assignment checks membership | A task cannot be assigned to a registered user who is outside its workspace. Removing a member clears their existing task assignments. | `src/routes/taskRoutes.js`, `src/routes/workspaceRoutes.js` |
| Transactions for linked writes and deletes | Creating a workspace also creates its owner membership; removing a member updates assignments; deleting a project or workspace deletes child records together. A transaction prevents partial changes if one step fails. | `src/routes/workspaceRoutes.js`, `src/routes/projectRoutes.js` |
| PostgreSQL + Prisma migrations | A relational schema makes workspaces, memberships, projects, and tasks explicit. Migrations make schema changes repeatable on another machine. | `prisma/schema.prisma`, `prisma/migrations/` |
| Database-backed tests and CI workflow | Tests exercise real HTTP requests and role boundaries against PostgreSQL, including cross-workspace access and cleanup. The workflow is configured to run those checks on push and pull requests. | `tests/collaboration.test.js`, `.github/workflows/ci.yml` |

## Likely follow-up questions

**Authentication versus authorization?** Authentication answers "who sent this request?" The JWT verification provides a user ID. Authorization answers "may this user perform this action here?" Membership and role middleware provide that answer for each workspace.

**Why is `WorkspaceMember` needed if `Workspace` has an owner ID?** The owner ID identifies the creator/owner, but it does not represent all users or their individual roles. Membership records let one account participate in many workspaces and let us distinguish admins from members. The owner is also recorded as an `OWNER` member during workspace creation.

**What if a user guesses another workspace or project ID?** Workspace membership is checked first. For nested project and task endpoints, the project is also looked up using both its ID and the workspace ID. The integration test checks these boundaries, including a user who owns two different workspaces.

**What happens when an assigned member leaves?** The removal route clears that user's assignments in the workspace and deletes their membership in one database transaction. The tasks remain, but are unassigned.

**What happens when a project or workspace is deleted?** The API explicitly deletes nested tasks before the parent records, within a transaction. Deleting a workspace also removes its projects and membership records. This is a destructive API operation and is restricted by role.

**How did you test it?** `npm test` starts the Express app on an ephemeral port, sends HTTP requests to exercise registration, login, token formatting, role rules, task status transitions, and cross-workspace isolation, then cleans up its test records. Locally, PostgreSQL is started using Docker Compose and Prisma migrations are applied first. GitHub Actions runs the same suite against a fresh PostgreSQL service on pushes and pull requests; cite the successful run for the commit you discuss.

## Honest scope and next talking points

- **Implemented:** JWT login/registration, workspaces and membership roles, project and task CRUD, task status filtering and assignment, cross-workspace checks, PostgreSQL migrations, local integration tests, and a CI workflow file.
- **Release verification:** confirm the GitHub Actions run for the final commit. Run the setup from a fresh clone on a machine with Docker Desktop when available. A public deployment is optional and has not been made; do not claim production usage or performance improvements without measuring them.
- **Resume framing after verification:** "Built a multi-workspace REST API with Node.js, Express, PostgreSQL, and Prisma; enforced JWT authentication and workspace-scoped role permissions; tested cross-workspace isolation with database-backed integration tests and CI."

When a feature changes, update this narrative and `README.md` to describe the actual behavior. Add a new interview explanation for the decision behind the feature, not merely its endpoint name.
