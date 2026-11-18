# Crystal Estates - Backend API Server

Dedicated Node.js / Express backend server for Crystal Estates, providing REST APIs connected to MongoDB for real-time plot layouts, inventory management, and CRUD operations.

## Architecture & Structure

```
server/
├── src/
│   ├── config/
│   │   └── db.js            # MongoDB connection pooling & getDb helper
│   ├── routes/
│   │   ├── plots.js         # /api/plots (Featured plots endpoints)
│   │   └── kolapakkam.js    # /api/plots/kolapakkam (Master plan & CRUD endpoints)
│   ├── lib/
│   │   └── svgPathCentroid.js # Centroid computation for SVG boundaries
│   ├── data/
│   │   ├── kolapakkamPlots.js # Layout metadata & fallback plot coordinates
│   │   └── site.js          # Fallback featured plots data
│   └── server.js            # Express server initialization, CORS, middleware & routes
├── scripts/
│   ├── seed_mongodb.mjs     # Database seeder script
│   └── test_mongo.mjs       # Database connectivity verification
├── .env                     # Server environment variables (port, db uri)
├── .env.example             # Example environment file
└── package.json             # Server dependencies & scripts
```

## API Endpoints

### Health Check
- `GET /api/health` - Check server status and MongoDB database connectivity

### Featured Plots
- `GET /api/plots` - Retrieve all featured plots from MongoDB (with static fallback)
- `PATCH /api/plots` or `PATCH /api/plots/:id` - Update status, price, facing, or area

### Kolapakkam Interactive Master Plan
- `GET /api/plots/kolapakkam` - Retrieve layout metadata and dynamic plot boundaries
- `POST /api/plots/kolapakkam` - Add a new plot (with automated label centroid calculation)
- `PATCH /api/plots/kolapakkam` - Update plot status (`Available`, `Booked`, `Sold`, `Blocked`), dimensions, or price
- `DELETE /api/plots/kolapakkam?plotNo=1` - Delete a plot by `plotNo` or `id`

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` if needed:
```bash
cp .env.example .env
```
Default port is `5000`.

### 3. Run Development Server
```bash
npm run dev
```

### 4. Run Production Server
```bash
npm start
```

### 5. Seed Database
```bash
npm run seed
```

## CRM Admin Accounts

There is no built-in login. `POST /api/auth/login` only accepts a user in the `users`
collection whose `passwordHash` matches. Passwords are stored as salted scrypt hashes;
older unsalted sha256 hashes still work and are upgraded on the user's next login.

These scripts write to whatever database `MONGODB_URI` points at, so check it first.

### Create the first admin

| Variable | Required | Notes |
| --- | --- | --- |
| `ADMIN_EMAIL` | yes | Login email for the admin |
| `ADMIN_PASSWORD` | yes | At least 12 characters |
| `ADMIN_NAME` | no | Display name, defaults to `Crystal Admin` |

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-unique-password' npm run seed:admin
```

If a user with that email already exists it is left alone. To replace its password
(and sign it out), add `-- --reset-password`:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-new-password' npm run seed:admin -- --reset-password
```

Don't leave `ADMIN_PASSWORD` in a committed or long-lived `.env`.

### Remove plain-text passwords (one-off)

Older code saved a plain-text `password` field next to `passwordHash`. Login no longer reads it.
Run the migration once, dry run first:

```bash
npm run migrate:passwords
npm run migrate:passwords -- --apply
```

It also flags any account still using a well-known default password such as the old `admin123`;
rotate those with `seed:admin -- --reset-password`.

