# RelayBoard API

RelayBoard API is a REST backend for authenticated task management. It is being developed as a portfolio project focused on API design, JWT authentication, PostgreSQL, Prisma, Docker, and secure resource ownership.

## Current capabilities

- Register and log in with hashed passwords and JWTs.
- Validate registration, login, and task-creation input.
- Create, list, update, and delete tasks for the authenticated user.
- Enforce task ownership for updates and deletes.
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
| GET | `/todos` | List the authenticated user's tasks. |
| POST | `/todos` | Create a task. |
| PUT | `/todos/:id` | Mark an owned task complete or incomplete. |
| DELETE | `/todos/:id` | Delete an owned task. |

Protected endpoints require this header:

```http
Authorization: Bearer <jwt>
```
