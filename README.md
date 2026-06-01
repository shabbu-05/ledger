# Ledger — Personal Expense & Budget Tracker

A web app to track monthly income, log categorised expenses, set overall and per-category
budgets (with over-budget warnings), and view reports and income/spending/savings trends.

Built with React + Vite + Chart.js, backed by Supabase (auth + Postgres), deployed on Netlify.

## How it works

The app talks to one data layer (`src/lib/dataClient.js`) that has two modes:

- **Cloud mode** — active when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set.
  Real email/password login, data stored in Supabase, synced across all your devices.
- **Demo mode** — active when those vars are absent. Data is stored in the browser
  (localStorage) so you can try everything locally before connecting Supabase.

You do not change any code to switch modes — just the environment variables.

---

## Setup (about 15 minutes)

### 1. Create a Supabase project (free)
1. Go to https://supabase.com → sign up → **New project**. Pick a name and a strong DB password.
2. Wait ~2 min for it to provision.
3. In the left sidebar open **SQL Editor → New query**, paste the entire contents of
   `supabase-schema.sql` (included here), and click **Run**. This creates the `months`
   table and the row-level-security rules so each user only sees their own data.
4. Open **Project Settings → API**. Copy two values:
   - **Project URL**  → this is your `VITE_SUPABASE_URL`
   - **anon public** key → this is your `VITE_SUPABASE_ANON_KEY`
   (The anon key is safe to expose in a frontend; RLS is what protects the data.)

### 2. Run locally (optional but recommended)
```bash
npm install
cp .env.example .env.local      # then paste your two values into .env.local
npm run dev                     # open the printed localhost URL
```
With no `.env.local`, it runs in demo mode. With it, it uses your real Supabase.

### 3. Push to GitHub
```bash
git init && git add . && git commit -m "Ledger expense tracker"
# create a repo on github.com, then:
git remote add origin https://github.com/YOU/ledger.git
git push -u origin main
```

### 4. Deploy on Netlify
1. Go to https://netlify.com → **Add new site → Import an existing project** → pick your repo.
2. Netlify auto-detects the settings from `netlify.toml` (build `npm run build`, publish `dist`).
3. Before the first deploy, open **Site settings → Environment variables** and add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. Your app is live at the Netlify URL, with real login and cloud data.

### 5. One Supabase setting for email login
In Supabase **Authentication → Providers → Email**, you can turn off "Confirm email"
for instant sign-up while testing, or leave it on for production (users get a confirm link).
Under **Authentication → URL Configuration**, add your Netlify URL as a Site URL.

---

## Features
- Email/password login with per-user data isolation (Supabase RLS)
- Per-month income entry; switch between months freely
- Expense logging with 8 categories (Rent, Groceries, Hotel & Dining, EMI, Fuel,
  Utilities, Parents/Family, Miscellaneous) — edit the `CATS` array in `App.jsx` to change them
- Overall + per-category budgets, with a red popup warning when you add a spend to an
  over-budget category, and red "OVER" badges on breached categories
- "Unnecessary" flag on any expense (impulse / avoidable buys). Set a monthly
  unnecessary-spending limit in the Budgets tab; when a new unnecessary expense crosses it,
  you get a soft warning popup (it still adds the expense). The Reports tab shows your
  total unnecessary spend, its share of spending and income, the full list of flagged items,
  and the annualised cost of that habit.
- Reports: by category, by week, vs last month, plus unnecessary-spending breakdown
- Income vs spending vs savings trend line across all tracked months
- Dark / light theme toggle (preference saved per browser)
- Settings tab: manage categories (add / rename / recolour / remove), set default budgets
  that carry forward to seed each new month, choose currency, month-start day, and default theme
- Inline "Unnecessary" checkbox in the expense list, so you can flag (or un-flag) any expense
  later just by ticking the box in the table

Note: the unnecessary flag is stored inside the existing `expenses` JSON, and the
unnecessary limit inside the existing `budgets` JSON, so no database migration is needed —
the schema in `supabase-schema.sql` already supports it.

## Changing categories
Edit the `CATS` array near the top of `src/App.jsx` (and the same array in the demo HTML).
Each entry is `{ id, name, color }`. Existing data keyed to an old id stays under "Miscellaneous"
display if you remove a category, so prefer keeping ids stable.
