# Zorvyn Finance Backend

A finance dashboard backend built for the Zorvyn screening task. Provides user management, role-based access control, financial record CRUD with filtering and pagination, and a dashboard analytics API — all backed by SQLite.

## Stack

- **Runtime**: Node.js 25
- **Framework**: Express 5
- **Database**: SQLite (via Node.js built-in `node:sqlite` module)
- **Auth**: JWT + bcryptjs
- **Validation**: Zod 4
- **Testing**: Node.js built-in `node:test`

---

## Clone & Run

```bash
# Clone the project
git clone https://github.com/alokvadera/zorvyn-finance-backend
cd zorvyn-finance-backend

# Install dependencies
npm install

# Seed demo data (creates 4 users + 15 financial records)
npm run seed

# Start the server
npm start
```

Server runs at `http://localhost:3000`.

---

## Demo Credentials

| Email | Password | Role | Notes |
|---|---|---|---|
| admin@zorvyn.com | admin123 | admin | Full access |
| analyst@zorvyn.com | analyst123 | analyst | Read records + dashboard |
| viewer@zorvyn.com | viewer123 | viewer | Dashboard only |
| inactive@zorvyn.com | viewer123 | viewer | Cannot log in |

---

## API Endpoints

Base URL: `http://localhost:3000/api`

All authenticated endpoints require the header:
```
Authorization: Bearer <token>
```

### Auth

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@zorvyn.com","password":"admin123"}'
# Returns: { token, user }

# Get current user
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <token>"
# Returns: { user: { id, name, email, role, status, created_at } }
```

### Users (Admin only)

```bash
# Create user
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@zorvyn.com","password":"secret123","role":"analyst"}'

# List all users
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer <token>"

# Get user by ID
curl http://localhost:3000/api/users/1 \
  -H "Authorization: Bearer <token>"

# Update user fields
curl -X PATCH http://localhost:3000/api/users/1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Smith","role":"viewer"}'

# Activate / deactivate user
curl -X PATCH http://localhost:3000/api/users/3/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status":"inactive"}'
```

### Financial Records

```bash
# Create record (admin only)
curl -X POST http://localhost:3000/api/records \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "type": "income",
    "category": "consulting",
    "record_date": "2025-04-01",
    "notes": "Q2 project milestone"
  }'

# List records (analyst / admin)
# Query params: type, category, start_date, end_date, limit, offset
curl "http://localhost:3000/api/records?type=expense&category=salary&limit=5&offset=0" \
  -H "Authorization: Bearer <token>"

# Get single record
curl http://localhost:3000/api/records/1 \
  -H "Authorization: Bearer <token>"

# Update record (admin only)
curl -X PATCH http://localhost:3000/api/records/1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"notes":"Updated after review"}'

# Delete record (admin only)
curl -X DELETE http://localhost:3000/api/records/1 \
  -H "Authorization: Bearer <token>"
```

### Dashboard

```bash
# Analytics summary (viewer, analyst, admin)
curl http://localhost:3000/api/dashboard/summary \
  -H "Authorization: Bearer <token>"

# Response shape:
# {
#   summary: {
#     total_income: 270000,
#     total_expenses: 75500,
#     net_balance: 194500
#   },
#   category_breakdown: [{ category, type, total, count }],
#   recent_activity: [{ id, amount, type, category, record_date, created_by }],
#   monthly_trend: [{ month, income, expenses }]
# }
```

---

## Role Permission Matrix

| Permission | Viewer | Analyst | Admin |
|---|---|---|---|
| View dashboard summary | Yes | Yes | Yes |
| Read financial records | No | Yes | Yes |
| Create financial records | No | No | Yes |
| Update financial records | No | No | Yes |
| Delete financial records | No | No | Yes |
| Create users | No | No | Yes |
| List users | No | No | Yes |
| Update users | No | No | Yes |
| Activate/deactivate users | No | No | Yes |

---

## Validation Rules

- `email` — must be a valid email address
- `password` — minimum 6 characters
- `amount` — must be a positive number
- `type` — must be `"income"` or `"expense"`
- `category` — non-empty string
- `record_date` — must match `YYYY-MM-DD`
- `role` — must be `"viewer"`, `"analyst"`, or `"admin"`
- `status` — must be `"active"` or `"inactive"`

All validation errors return HTTP 400 with a `details` array:
```json
{ "error": "Validation failed", "details": [{ "field": "email", "message": "Invalid email format" }] }
```

---

## Assumptions & Tradeoffs

1. **SQLite over Postgres** — chosen because it requires no external setup and keeps the project self-contained. For production with concurrent writes, swap `src/db/index.js` to use `pg` with a Postgres connection.

2. **JWT secret** — defaults to `zorvyn-dev-secret-change-in-production`. Set the `JWT_SECRET` environment variable for production deployments.

3. **Viewers cannot read records** — they only have access to the dashboard summary. This is intentional per the role matrix. If a viewer needs record access, their role should be upgraded to analyst.

4. **Seed data is idempotent** — running `npm run seed` twice is safe; it checks for existing users before inserting.

5. **No soft delete on records** — financial records are hard-deleted. If audit trails are needed, add a `deleted_at` column and update the delete endpoint accordingly.

6. **No pagination metadata beyond total/limit/offset** — page count and hasNext flags can be added if needed.

7. **Single-file Zod schemas** — for a larger project, schemas would be split into per-route files under `src/schemas/`.

---

## Project Structure

```
src/
  app.js              # Express app + route mounting
  server.js           # Entry point (db init + listen)
  db/
    index.js          # SQLite connection + schema init
    seed.js           # Demo data seeder
  middleware/
    auth.js           # JWT authenticate + authorize
    validation.js     # Zod error handler
  routes/
    auth.js           # /api/auth/*
    users.js          # /api/users/*
    records.js        # /api/records/*
    dashboard.js      # /api/dashboard/*
  services/
    validation.js     # All Zod schemas
  tests/
    app.test.js       # 23 integration tests
```

---

## Commands

```bash
npm start          # Start production server (port 3000)
npm run dev        # Start with auto-reload (node --watch)
npm run seed       # Seed demo users and records
npm test           # Run all 23 integration tests
```

---

## Summary

| Item | Detail |
|---|---|
| Total endpoints | 13 |
| Test coverage | 23 tests across 6 suites |
| RBAC roles | viewer, analyst, admin |
| Database | SQLite (file-based, no setup) |
| Validation | Zod on all write endpoints |
| Auth | JWT, 24h expiry, bcrypt passwords |
