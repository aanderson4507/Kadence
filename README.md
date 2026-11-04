# Kadence

Kadence is a goals and productivity app built with React, TypeScript, and Vite.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Development

```sh
npm install
npm run dev
```

## Production build

```sh
npm run build
npm run preview
```

The login screen opens at `/`, and the dashboard is available at `/dashboard`.
The app entry point is `src/App.tsx`; the login and dashboard screens live in
`src/Login.tsx` and `src/Dashboard.tsx`. Their styles are in `src/Login.css` and
`src/App.css`, and Figma-exported SVGs are stored in `public/assets`.

Authentication is not connected yet. The demo login accepts any non-empty
username and password, does not send or store credentials, and opens the
dashboard.

The dashboard opens to the to-do list with sample tasks. Tasks can be filtered
by priority (Very High through None), added, completed, and deleted. Changes are
kept in page state and reset when the page is refreshed.

The Breakdown view displays the sample website goal, its connected goals, and
ten milestones. Milestones can be completed or reopened; progress is updated in
the summary and resets when the page is refreshed.

The Priority view lets you search tasks, select one, and save or reset its
priority. Saved priority changes stay in sync with the to-do list until refresh.
