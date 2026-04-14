# Recetario Back

Express.js REST API for a recipe sharing platform, using Supabase as database and auth provider.

## Commands

```bash
npm run dev     # Development with nodemon
npm start       # Production
```

## Architecture

```
server.js                     # Entry point
src/
  config/
    db.js                     # Supabase clients
    environment.js            # Env var validation
  controllers/
    recipeController.js       # Recipe CRUD
    userController.js         # Profiles, followers
    collectionController.js   # Collections
    favoriteController.js     # Favorites
    tagController.js          # Tags + translations
  middleware/
    auth.js                   # verifyAuth / optionalAuth
    errorHandler.js           # Global error handler + 404
    requestLogger.js          # Request logging
  routes/
    index.js                  # Main router
    recipeRoutes.js
    userRoutes.js
    collectionRoutes.js
    tagRoutes.js
  utils/
    responseFormatter.js      # formatSuccess / formatError / formatPagination
```

## Environment Variables

```
PORT=3000
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NODE_ENV=development
```

## Supabase Clients

- **`supabase`** (default export) — anon client, used for public reads without auth context.
- **`getAuthenticatedClient(token)`** — creates a client with the user's JWT, enforcing RLS. Used in all authenticated operations.

Pattern in controllers:
```js
// Optional auth endpoint
const client = req.token ? getAuthenticatedClient(req.token) : supabase;

// Required auth endpoint
const client = getAuthenticatedClient(req.token);
```

## Auth Middleware

- **`verifyAuth`** — requires valid Bearer token. Attaches `req.user`, `req.userId`, `req.token`. Returns 401 otherwise.
- **`optionalAuth`** — same but never blocks. Attaches user info if token is valid.

## Response Format

All responses use `responseFormatter.js`:

```js
// Success
{ status, statusCode, message, data }

// Error
{ status, statusCode, message }

// Paginated
{ status, statusCode, message, results, totalItems, currentPage, totalPages, data }
```

Pagination query params: `?page=1&limit=20`

## Database Schema (Supabase / public)

| Table | Key columns |
|---|---|
| `users` | `id` (uuid), `name`, `email`, `avatar_url`, `location`, `bio`, `created_at` |
| `recipes` | `id`, `user_id` → `users.id`, `name`, `description`, `prep_time`, `servings`, `difficulty`, `calories`, `main_image_url`, `is_public`, `created_at` |
| `ingredients` | `id`, `recipe_id`, `name`, `quantity`, `optional`, `order` |
| `steps` | `id`, `recipe_id`, `step_number`, `description`, `tip`, `image_url` |
| `tags` | `id`, `name`, `color` |
| `tag_translations` | `tag_id`, `lang`, `name` |
| `recipe_tags` | `recipe_id`, `tag_id` |
| `user_followers` | `follower_id`, `following_id`, `created_at` |
| `recipe_favorites` | `user_id`, `recipe_id`, `created_at` |
| `collections` | `id`, `user_id`, `name`, `description`, `cover_image_url`, `is_public`, `created_at` |
| `collection_recipes` | `collection_id`, `recipe_id`, `added_at` |

All tables have RLS enabled. Auth is enforced via the authenticated Supabase client (user JWT). Ownership checks for write operations are done in the controller layer.

## API Endpoints

### Recipes — `/recipes`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/recipes` | Optional | List recipes (paginated) |
| GET | `/recipes/:id` | Optional | Get recipe by ID |
| POST | `/recipes` | Required | Create recipe |
| PUT | `/recipes/:id` | Required | Update recipe |
| DELETE | `/recipes/:id` | Required | Delete recipe |
| POST | `/recipes/:id/favorite` | Required | Add to favorites |
| DELETE | `/recipes/:id/favorite` | Required | Remove from favorites |
| GET | `/recipes/:id/is-favorited` | Required | Check favorite status |

### Users — `/users`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users/me/favorites` | Required | My favorited recipes (paginated) |
| PUT | `/users/me` | Required | Update own profile |
| GET | `/users/:id` | Optional | Public profile + stats |
| GET | `/users/:id/recipes` | Optional | User's recipes (owner sees private too) |
| GET | `/users/:id/collections` | Optional | User's collections (owner sees private too) |
| POST | `/users/:id/follow` | Required | Follow user |
| DELETE | `/users/:id/follow` | Required | Unfollow user |
| GET | `/users/:id/followers` | None | List followers |
| GET | `/users/:id/following` | None | List following |
| GET | `/users/:id/is-following` | Required | Check follow status |

### Collections — `/collections`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/collections` | Required | Create collection |
| GET | `/collections/:id` | Optional | Get collection + recipes |
| PUT | `/collections/:id` | Required | Update collection (owner only) |
| DELETE | `/collections/:id` | Required | Delete collection (owner only) |
| POST | `/collections/:id/recipes` | Required | Add recipe to collection (owner only) |
| DELETE | `/collections/:id/recipes/:recipeId` | Required | Remove recipe (owner only) |

### Tags — `/tags`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/tags` | None | All tags |
| GET | `/tags/:lang` | None | Tags translated to language |

## Notes

- ES Modules throughout (`"type": "module"` in package.json)
- `/users/me` routes must be defined before `/:id` to avoid param collision
- `recipes.user_id` has two FKs (to `public.users` and `auth.users`) — always use `users!user_id` in Supabase select to disambiguate
- A recipe can belong to multiple collections (`collection_recipes` is many-to-many)
- Email is never returned in public-facing responses
