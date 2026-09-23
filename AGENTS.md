# Repository Guidelines

## Project Structure & Module Organization

`src/main.jsx` contains the React application; `src/styles.css` holds its styles, and `src/assets/brand/` holds imported logos. Static browser assets are in `public/`. The Node API lives in `backend/server.mjs`, with PostgreSQL access in `backend/db.mjs` and schema initialization in `backend/schema.sql`. Deployment files are in `deploy/`, the Dockerfiles, and `docker-compose.yml`. Generated `dist/` output and local `backend/.data/` are ignored.

## Build, Test, and Development Commands

Use Node.js 22 (the version used by the Dockerfiles) and run `npm ci` to install locked dependencies. Start the frontend with `npm run dev` and the API separately with `npm run dev:api`; the API listens on port 8000 and requires PostgreSQL. Set `DATABASE_URL` for a nondefault local database. Run `npm run build` to create the production frontend in `dist/`, then `npm run preview` to inspect that build locally. For the production Docker setup, follow `DEPLOY_1PANEL.md` and `.env.production.example`.

## Coding Style & Naming Conventions

Use ES modules, two-space indentation, double-quoted JavaScript strings, and semicolons, matching the existing files. Keep React UI changes in `src/` and API or database changes in `backend/`. Use descriptive camelCase names for functions and variables, PascalCase for React components, and uppercase snake case for constants. No formatter or linter is configured; keep new code consistent with nearby code.

## Testing Guidelines

There is currently no automated test framework or `npm test` script. For each change, run `npm run build` and manually exercise the affected UI or API flow. When changing data or authentication behavior, verify both success and failure cases against a local PostgreSQL instance. If adding automated tests, use `*.test.js` or `*.test.jsx` near the relevant code and add a documented npm script.

## Commit & Pull Request Guidelines

Recent commits use short, imperative subjects prefixed with `fix:`, `feat:`, `style:`, or `chore:`; follow that pattern. Keep pull requests focused, describe the user-visible change, list verification steps, and link related issues when applicable. Include screenshots for UI changes and note any new environment variables or schema changes.

## Security & Configuration

Use `.env.example` and `.env.production.example` as templates. Never commit populated `.env` files, credentials, or database dumps. Production requires `ADMIN_EMAIL`, an `ADMIN_PASSWORD` of at least 16 characters, and correctly configured database and frontend origins.
