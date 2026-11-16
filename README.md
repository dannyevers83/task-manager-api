# Task Manager API

An Express REST API for a React task manager. This backend learning project demonstrates routes, JSON bodies, validation, UUIDs, HTTP responses, and CRUD operations.

## Hosted API

[Health check](https://task-manager-api-bbj6.onrender.com/health) · [Tasks](https://task-manager-api-bbj6.onrender.com/tasks)

The API is hosted on Render. Verify the responses and the frontend connection after deployment; a successful hosting status alone does not verify every endpoint.

**Data is stored in server memory.** A browser refresh can read back changes while the same server instance runs, but a restart, redeploy, or sleeping host resets the list. All visitors share the same demo data. There are no accounts or database.

## Run locally

Use Node.js 24 (or a supported newer version) and npm:

```bash
npm install
npm run dev
```

The server listens on port 3000 by default. `npm run dev` watches files and restarts the process when code changes. Each restart also creates new example tasks and IDs.

For a normal server process:

```bash
npm start
```

You can copy `.env.example` to `.env` to configure `PORT` and `CORS_ORIGINS`. The start scripts load `.env` if it exists. Do not commit local `.env` files.

## Endpoints

| Method | Path         | Behavior                                  | Success         |
| ------ | ------------ | ----------------------------------------- | --------------- |
| GET    | `/health`    | Report availability and temporary storage | 200             |
| GET    | `/tasks`     | List all tasks                            | 200             |
| GET    | `/tasks/:id` | Read one task                             | 200             |
| POST   | `/tasks`     | Add a task from a title                   | 201             |
| PATCH  | `/tasks/:id` | Set the completion status                 | 200             |
| DELETE | `/tasks/:id` | Delete one task                           | 204, empty body |

POST body:

```json
{ "title": "Practice API requests" }
```

The server trims the title, rejects empty/non-string values and titles over 200 characters, creates a UUID, and sets `completed` to false. Client-supplied IDs or completion values are not used for creation.

PATCH body:

```json
{ "completed": true }
```

Only a boolean is accepted. `false` is valid; the string `"false"` is not. PATCH currently changes only `completed`.

Missing tasks return JSON 404. Invalid fields or JSON return 400; JSON bodies over 16 KiB return 413. Unknown routes return a JSON 404. Responses use `Cache-Control: no-store` so stale lists are not intentionally cached.

## Try it with curl

```bash
curl http://localhost:3000/tasks
curl -i -X POST http://localhost:3000/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Practice API requests"}'
```

Copy an actual ID from the response, then replace `TASK_ID`:

```bash
curl -i -X PATCH http://localhost:3000/tasks/TASK_ID \
  -H 'Content-Type: application/json' \
  -d '{"completed":true}'
curl -i -X DELETE http://localhost:3000/tasks/TASK_ID
```

A successful DELETE has no JSON response body. The browser address bar makes GET requests; use the frontend, curl, or REST Client for the other methods.

## Tests

```bash
npm test
```

The tests exercise the actual Express application and JSON middleware using in-process request/response streams. They do not open a network port. Coverage includes reading, creation and validation, UUIDs, both completion values, deletion and empty 204 responses, missing IDs, invalid/oversized JSON, browser origins, preflight requests, and isolated server state.

These are not live-host or browser networking tests. Verify the deployed service separately through `/health`, `/tasks`, and the frontend.

## Files

```text
app.js             Creates the Express app, middleware, routes, and example data
index.js           Starts the server using PORT or port 3000
tests/api.test.js  In-process Express request tests
.env.example       Example local configuration
.node-version      Hosting Node version
render.yaml        Render Free web-service blueprint
```

## Deploy on Render

1. Publish this directory as its own GitHub repository, such as `task-manager-api`. Commit `package-lock.json`; exclude `node_modules` and `.env`.
2. In Render, create a **Web Service** from that repository, or use its `render.yaml` blueprint.
3. Use the **Free** instance plan, build command `npm ci`, and start command `npm start`.
4. Set the health check to `/health`. Render supplies `PORT`; the server binds to `0.0.0.0`.
5. Set `CORS_ORIGINS` to `https://danny-task-manager-react.netlify.app`. Additional allowed origins can be comma-separated, with no trailing slash on an origin.
6. After deployment, open the actual service URL followed by `/health` and `/tasks`.
7. Ensure `VITE_API_URL` in the frontend's `netlify.toml` matches the actual API origin and redeploy the frontend. It currently uses `https://task-manager-api-bbj6.onrender.com`.

CORS permits the listed browser origins; it does not authenticate users or prevent non-browser clients from using the API. This API is intentionally a shared public learning demo. Do not use it as private or durable storage.

Render Free sleeps after inactivity and can take around a minute to wake. Tasks reset on restart or sleep. No PostgreSQL instance or paid plan is required for this version. Deployment has not been confirmed merely by preparing these files.

Official guides: [Render Express deployment](https://render.com/docs/deploy-node-express-app) and [free instance limitations](https://render.com/docs/free).

## Author

[Danny Evers](https://github.com/dannyevers83) · [Portfolio](https://dannyevers.xyz/)
