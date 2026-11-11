# Fat-Loss Hub

This is a personal, offline-first web app for a 12-week fat-loss plan (9 Nov 2026 – 31 Jan 2027). It covers:

- daily weigh-ins
- workout logging, including garage supersets
- weekly check-ins
- progress tracking

All data stays in IndexedDB on your device. There are no accounts, no backend and no analytics.

## Run it locally

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build && npm run preview
```

The plan's numbers, sessions and rules all live in `src/plan.ts`.

## Deploy (free static hosting)

The app is a static site: the `dist/` folder after `npm run build`. Routing is hash-based, so no rewrite rules are needed.

### Netlify

1. Push this repo to GitHub, then go to app.netlify.com and choose **Add new site → Import an existing project**.
2. Pick the repo and branch. `netlify.toml` already sets the build command (`npm run build`) and publish folder (`dist`).
3. Click **Deploy**. You get an `https://<name>.netlify.app` URL.

### Vercel

1. Go to vercel.com/new, import the GitHub repo, and keep the defaults. `vercel.json` sets Vite, `npm run build` and `dist`.
2. Click **Deploy**. You get an `https://<name>.vercel.app` URL.

Both config files serve `sw.js` and `index.html` with `no-cache`, so updates reach your phone on the next launch.

## Install on iPhone

1. Open the site's URL in **Safari**. It must be Safari for Home Screen install.
2. Tap **Share**, then **Add to Home Screen**, then **Add**.
3. Open it once from the Home Screen while online. After that it works fully offline, including at the gym and in the garage.
4. Back up regularly: go to **More → Settings → Export everything (JSON)** and save the file to iCloud Drive or Files.
   - Home Screen apps get persistent storage.
   - However, iOS can still clear website data if you remove the app, so keep backups.

## Moving devices

To move to a new device:

1. On the old device, export the JSON backup.
2. Open the app on the new device.
3. Go to **Settings → Import backup** and choose the file. Import replaces everything with the backup's contents.
