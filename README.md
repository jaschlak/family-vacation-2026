# Our Week Away — Family Vacation 2026

A small family planning site for July 18–25, 2026. Relatives can:

- Claim one of the eight vacation days for their family to lead.
- Add activity and location ideas with an audience, scheduled time or everyday availability, link, notes, and contributor name.
- Filter ideas for everyone, adults, seniors, teens, kids, or little kids.
- Vote for ideas without creating an account.
- Use a shared group chat and discuss individual activity ideas.
- Switch to a day timeline that places ideas vertically by time and shows overlapping choices side by side.

The production site is designed for **Cloudflare Pages + D1**. D1 is Cloudflare’s managed SQLite-compatible database, so claims and ideas persist independently of a deployment or maintenance restart. The site intentionally has no account requirement; anyone with the public URL can contribute.

## Preview locally

The zero-dependency preview server includes a small JSON-backed local database and Terri Schlak's three NY sightseeing ideas.

```powershell
cd family_vacation_2026
..\roots_capoeira_site\node-local.cmd dev-server.mjs
```

Open <http://localhost:8788>. Local claims and ideas are written to `.data/local.json`, which is ignored by Git.

## Deploy to Cloudflare Pages

1. Create a free Cloudflare account and a new D1 database:

   ```powershell
   npx wrangler login
   npx wrangler d1 create family-vacation-2026
   ```

2. Copy the returned database ID into `wrangler.toml`, replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`.

3. Create a Pages project in the Cloudflare dashboard and connect the GitHub repository. Use:

   - Framework preset: **None**
   - Build command: leave blank
   - Root directory: `family_vacation_2026` when this directory stays in the current monorepo; leave it blank if this becomes its own repository
   - Build output directory: `.`

4. In the Pages project, open **Settings → Bindings**, add a **D1 database binding** named `DB`, and select `family-vacation-2026`. Add it to both Production and Preview.

5. Apply the schema and seed data from this directory:

   ```powershell
   npm install
   npm run db:remote
   ```

6. Push to GitHub. Cloudflare Pages will deploy automatically and provide a free `pages.dev` address.

The migrations create the eight trip days and add Terri’s three sightseeing ideas without duplicating them.

## Admin maintenance

Voting is anonymous. Each browser receives a random ID stored locally so a vote can be toggled without collecting a name, email address, or account. Clearing browser storage or using another browser allows another vote; this is intended as lightweight family polling rather than a tamper-proof election.

Maintenance actions are intentionally not exposed on the public website. They require the Wrangler login authorized for the Cloudflare account. From the project directory, list activity IDs and vote totals before changing anything:

```powershell
..\roots_capoeira_site\npm-local.cmd exec -- wrangler d1 execute family-vacation-2026 --remote --command "SELECT activities.id, activities.title, COUNT(activity_votes.voter_id) AS votes FROM activities LEFT JOIN activity_votes ON activity_votes.activity_id = activities.id GROUP BY activities.id ORDER BY activities.id;"
```

Clear the votes for one activity, replacing `3` with its ID:

```powershell
..\roots_capoeira_site\npm-local.cmd exec -- wrangler d1 execute family-vacation-2026 --remote --command "DELETE FROM activity_votes WHERE activity_id = 3;"
```

Clear every vote while keeping all activities:

```powershell
..\roots_capoeira_site\npm-local.cmd exec -- wrangler d1 execute family-vacation-2026 --remote --command "DELETE FROM activity_votes;"
```

List recent group-chat and event-discussion messages:

```powershell
..\roots_capoeira_site\npm-local.cmd exec -- wrangler d1 execute family-vacation-2026 --remote --command "SELECT messages.id, messages.author, messages.message, messages.created_at, activities.title AS activity FROM messages LEFT JOIN activities ON activities.id = messages.activity_id ORDER BY messages.id DESC LIMIT 100;"
```

Delete one message, replacing `12` with its ID:

```powershell
..\roots_capoeira_site\npm-local.cmd exec -- wrangler d1 execute family-vacation-2026 --remote --command "DELETE FROM messages WHERE id = 12;"
```

Clear the group chat while preserving event discussions:

```powershell
..\roots_capoeira_site\npm-local.cmd exec -- wrangler d1 execute family-vacation-2026 --remote --command "DELETE FROM messages WHERE activity_id IS NULL;"
```

Clear one event discussion, replacing `3` with the activity ID:

```powershell
..\roots_capoeira_site\npm-local.cmd exec -- wrangler d1 execute family-vacation-2026 --remote --command "DELETE FROM messages WHERE activity_id = 3;"
```

Delete one activity, its votes, and its discussion, replacing `3` with its ID:

```powershell
..\roots_capoeira_site\npm-local.cmd exec -- wrangler d1 execute family-vacation-2026 --remote --command "DELETE FROM messages WHERE activity_id = 3; DELETE FROM activity_votes WHERE activity_id = 3; DELETE FROM activities WHERE id = 3;"
```

These commands modify production data immediately. Always run the list command first and double-check the ID and title.

## Privacy and maintenance notes

- The site is public-by-link. Contributor names, chat posts, and event discussions are visible. Do not add private addresses, door codes, or sensitive travel details.
- A claim is intentionally first-come, first-served. Editing or releasing claims should be done in the D1 dashboard for now, which prevents anonymous visitors from changing someone else’s day.
- Before broadly sharing the URL, consider enabling Cloudflare Web Analytics and a basic WAF rate-limit rule for `/api/*` if traffic becomes noisy.
