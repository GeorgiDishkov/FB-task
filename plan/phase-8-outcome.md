# Phase 8 · Outcome — seeded account + delivery

Status: **the app is feature-complete and documented.** One delivery item is not done and
one cannot be done by me; both are listed at the end.

Two pieces of work: a real user store (requested in this phase), and the reviewer-facing
README.

---

## The seeded account

**`admin` / `Password1!`** — and it is genuinely verified, not waved through.

This reverses the earlier "no user store" decision. The reasoning for that decision was
that the task supplies no credentials, so there was nothing to verify against; seeding one
removes the premise, so the decision goes with it. Recorded as entries 12–13 in the
reversals register in [AUDIT.md](AUDIT.md).

### Stored as a hash, not a password

`server/data/users.json` holds:

```json
{
  "users": [
    {
      "id": "1",
      "username": "admin",
      "displayName": "Admin",
      "passwordHash": "scrypt$16384$8$1$<salt>$<hash>",
      "createdAt": "…"
    }
  ]
}
```

**`scrypt` from `node:crypto`**, not bcrypt or argon2. It is a memory-hard KDF in the same
family as argon2, needs no native build step, and adds no dependency — which matters more
than algorithm fashion for a single seeded row. This reverses the earlier "no bcrypt /
argon2" line in the stack doc, whose stated reason ("there is no stored password to hash")
no longer holds.

The stored format is **self-describing** — `scrypt$N$r$p$salt$hash` — the way a real
password column is written, so the cost factors can be raised later without invalidating
existing rows. A test asserts the recorded parameters.

`npm run seed:users --workspace=server` regenerates it. The plaintext never reaches the
file.

### Two things that make it behave like a real login

| | Why it matters |
|---|---|
| **Wrong password and unknown username return the identical 401 `INVALID_CREDENTIALS`** | Distinguishing them lets an attacker enumerate valid usernames |
| **The missing-user branch burns the same KDF work** | Otherwise "unknown user" returns in microseconds while "wrong password" takes ~270 ms — a timing oracle that gives the answer away whatever the body says |

Both verified. Response bodies are byte-identical, and timing across five runs each:

| Outcome | Average |
|---|---|
| Wrong password | 274 ms |
| Unknown username | 272 ms |
| Correct credentials | 272 ms |

Indistinguishable.

### Verified

**Server, by curl:**

| Case | Result |
|---|---|
| `admin` / `Password1!` | 200 |
| `Admin` / `Password1!` | 200 — usernames match case-insensitively, as every real login does |
| `admin` / `wrongpass` | 401 `INVALID_CREDENTIALS` |
| `nobody` / `Password1!` | 401 `INVALID_CREDENTIALS`, identical body |
| `admin` / `abc` | **400** `INVALID_CREDENTIALS_FORMAT` — a client bug, deliberately distinct from a wrong guess |
| Response payload | `{ id, username, displayName }` — **no hash leaked** |
| Token claims | `sub: "1"` (the user id, not the username), `usr: "admin"`, `sid` |
| `/api/health` | reports `usersLoaded: 1` |

**Client, in the browser:**

- Wrong password → stays on the login page, "Username or password is incorrect."
- Unknown username → **the same message**, confirmed identical
- Correct credentials → `/table`, 10 rows, header shows the display name **Admin**
- `localStorage` and `sessionStorage` still hold no token

### Changes this pulled through

- `AuthUser` gained `id` and `displayName`; the JWT subject is now the **user id** rather
  than the username, since an id is stable and a display name is not.
- Sessions carry the identity, so `/auth/refresh` restores it without a second lookup.
- The login form now distinguishes **rejected credentials** from an **unreachable
  server** — one means "check what you typed", the other "check your connection".
  Collapsing them would send the user looking in the wrong place. A test asserts the
  credential message does not mention the connection.
- The login page's old disclaimer ("there is no user store: any username and password of
  4–30 characters is accepted") was **false** as of this change and is gone, replaced by
  the demo credentials. A demo login nobody can guess is a demo nobody can try.

### Tests: 89 total (12 new, in a new server suite)

`server/src/auth/passwords.test.ts` — a Vitest suite on the server for the first time:

- the hash is self-describing and **never contains the plaintext**
- the same password hashes differently every time (per-password salt)
- the correct password verifies
- rejects a wrong password, a case-changed password, a prefix, and an empty string
- rejects a malformed stored hash: unknown algorithm, too few fields, **the plaintext
  stored directly**, and an empty string
- the cost parameters recorded in the hash are the ones used

One typing note worth keeping: `promisify(scrypt)` picks the three-argument overload and
silently drops the options parameter, so the cost factors could not be passed. Replaced
with a hand-typed promise wrapper.

---

## Delivery

[`README.md`](../README.md) written for a reviewer, not for me:

- **Run it** in three commands, with the demo credentials up front
- **All 13 requirements** in a table, each linking to the file that implements it
- **"Try the interesting bits"** — step-by-step for the cache (including the five ways to
  corrupt an entry and watch it be rejected), the offline modal, and token refresh
- **Architecture** — the three workspaces and the one-directional dependency rule
- **Decisions and trade-offs** — thirteen of them, each with the reasoning, including the
  measured 44 KB Joi cost and why the offline image must be local
- **Known limitations** — seven, stated plainly, including that Lighthouse was not run
- **What I'd do next** — five items, so the scope reads as chosen rather than unfinished

Every relative link in the README was checked to resolve (16 targets, all present).

**No plaintext password leaked.** `Password1!` appears only where it is deliberately
published — the README, the plan docs, the login page's demo block, the seed script's
default, and two test fixtures. It does **not** appear in `server/data/users.json`.
`server/.env` is still ignored; `users.json` and `.env.example` are tracked.

## Final state

| Check | Result |
|---|---|
| `npm run build` | clean, both workspaces |
| `npm run lint` | 0 errors, 0 warnings at `--max-warnings 0` |
| `npm test` | **89 passing** — 77 client, 12 server |
| `npx prettier --check .` | clean |
| `eslint-disable` comments | **0** |
| `any` / `@ts-ignore` | **0** |

## Not done

- **Screenshots.** The README has a marked placeholder for four images
  (`login-desktop`, `table-desktop`, `table-mobile`, `offline-modal`). I can capture a
  browser view but cannot write image files to the repo, so this needs doing by hand —
  and per [FE/10-delivery.md](FE/10-delivery.md) it is the highest-return fifteen minutes
  left, because nobody should have to `npm install` to see whether it looks good.
- **No git remote, nothing pushed.** Creating a GitHub repository and pushing is
  outward-facing and needs an explicit go-ahead plus a remote URL. Nine commits sit on
  `main` locally.
