# Recipe Vault Design

## Goal

Build a small personal web app for saving recipes the user has made or wants to make. The first version should be public on the internet but private to the user through Cloudflare Access.

## Platform

- Runtime: Cloudflare Workers
- Web framework: Hono with TypeScript
- Database: Cloudflare D1
- Deployment: Wrangler
- Access control: Cloudflare Access with Google login, restricted to the user's Google account

The app itself will not implement Google OAuth in the first version. Cloudflare Access protects the whole site before requests reach the Worker.

## User Experience

The first screen is the recipe list. It supports search, status filtering, and tag filtering. The user can open an existing recipe, add a new recipe, edit details, or delete an entry.

Recipe creation starts with a URL. The Worker fetches the page and attempts to read its HTML title. If title extraction fails, the app uses the URL as a temporary title and lets the user edit it.

Each recipe stores:

- URL
- title
- status: `want_to_make` or `made`
- tags
- ingredients
- steps
- notes
- created and updated timestamps

## Screens

### Recipe List

Shows saved recipes in reverse update order. Each item displays title, status, tags, URL host, and a short note preview when present.

Controls:

- text search across title, URL, tags, ingredients, steps, and notes
- status filter
- tag filter
- link to create a recipe

### New Recipe

Provides a URL field plus optional fields for title, status, tags, ingredients, steps, and notes. If the title is blank, the server attempts to fetch the URL title on submit.

### Recipe Detail and Edit

Shows all recipe fields in editable form. The user can update any field, open the source URL, or delete the recipe.

## Data Model

Table: `recipes`

- `id` text primary key
- `url` text not null
- `title` text not null
- `status` text not null check constrained to `want_to_make` or `made`
- `tags` text not null, stored as JSON array
- `ingredients` text not null default empty string
- `steps` text not null default empty string
- `notes` text not null default empty string
- `created_at` text not null ISO timestamp
- `updated_at` text not null ISO timestamp

Indexes:

- `idx_recipes_updated_at` on `updated_at`
- `idx_recipes_status` on `status`

## Routes

- `GET /` list recipes
- `GET /recipes/new` new recipe form
- `POST /recipes` create recipe
- `GET /recipes/:id` recipe detail and edit form
- `POST /recipes/:id` update recipe
- `POST /recipes/:id/delete` delete recipe

## Architecture

The Worker entrypoint creates a typed Hono app with a D1 binding named `DB`.

Code is split into small modules:

- `src/index.ts`: app setup and route registration
- `src/routes/recipes.ts`: recipe routes and request handling
- `src/db/recipes.ts`: D1 queries and row mapping
- `src/views/layout.ts`: shared HTML layout
- `src/views/recipes.ts`: list and form HTML
- `src/lib/url-title.ts`: URL title fetching and parsing
- `src/lib/forms.ts`: form parsing and validation helpers

Server-rendered HTML keeps the first version lightweight. CSS lives in `src/styles.ts` and is served by a route or embedded in the layout.

## Validation and Errors

URL is required and must parse as `http:` or `https:`. Title is required after fallback. Status must be one of the allowed values. Tags are split from comma-separated user input, trimmed, deduplicated, and stored as JSON.

When title fetching fails, creation still succeeds with a fallback title. User-facing errors return the form with a concise message. Unexpected errors return a generic error page and log structured details.

## Testing

Unit tests cover:

- tag parsing
- URL validation
- title extraction from HTML
- form payload normalization

Integration-level smoke checks cover:

- app builds with TypeScript
- D1 migration SQL is valid
- key routes render expected HTML

## Deployment Notes

Wrangler config defines the Worker, compatibility date, `nodejs_compat`, observability, and D1 binding. Cloudflare Access is configured outside the app in the Cloudflare dashboard or Zero Trust settings.

