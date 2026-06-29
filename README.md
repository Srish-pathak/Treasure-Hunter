# Strata — GATE Study Planner

A focused, single-page study planner built for GATE (and any exam) prep. No sign-up, no backend, no tracking — everything is stored locally in your browser.

**[Live demo →](#)** *(replace with your GitHub Pages link once deployed — see below)*

## Features

- **Subjects** — add the papers/topics you're preparing (Data Structures, TOC, Networks, whatever your syllabus needs), each with a color and an optional target-hours goal.
- **Pomodoro timer** — configurable focus/short-break/long-break durations and cycle length. Studied minutes are automatically logged against whichever subject is selected.
- **Daily plan** — a simple checklist of what you want to get through today, tied to a subject.
- **Streak system** — a GitHub-style contribution graph that fills in as you study. Tracks current streak and longest streak.
- **Calendar view** — month-by-month view of which days you studied.
- **Exam countdown** — set your GATE date and see days remaining at a glance.

All data lives in `localStorage` in your browser. Nothing is sent to a server. If you clear your browser data or switch devices, your progress won't carry over (by design — no accounts needed).

## Running it

No build step. Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Under "Build and deployment", set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`.
4. Save. Your planner will be live at `https://<your-username>.github.io/<repo-name>/` within a minute or two.

## Tech

Plain HTML, CSS, and vanilla JavaScript. No frameworks, no dependencies, no build tools. Fonts are loaded from Google Fonts (IBM Plex Mono + Inter); everything else is self-contained.

## Browser support

Uses `<dialog>` and `structuredClone`, both supported in current versions of Chrome, Firefox, Safari, and Edge.

## License

MIT — see [LICENSE](LICENSE).
