# FluentFile — Browser-local file storage

A file organizer built with Microsoft's official Fluent UI React v9 components, following the Fluent 2 design system. File contents are stored locally in the current browser using IndexedDB; the app does not upload file contents to a server.

## Features

- Upload files or drag and drop them into the app.
- Create and organize folders, move and rename files.
- Search and sort files; switch between grid and list views.
- Preview common images, PDFs, text files, audio, and video.
- Favorite files, download individual files, and create ZIP backups.
- Recycle bin with restore and permanent-delete actions.
- Responsive Fluent 2 interface and persistent-storage request where supported.

## Local development

Requires Node.js 20+ and npm.

```bash
npm install
npm run dev
```

## GitHub Pages

This repository includes a GitHub Actions workflow in `.github/workflows/pages.yml` that builds and deploys the site on pushes to `main` and on manual runs. In the repository's **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**.

## Storage notes

Files are saved to IndexedDB for this site origin and browser profile. They do not sync between devices or browsers. Clearing site data or browser storage eviction can remove files, so create ZIP backups regularly. Actual browser quotas vary. The site is static and stores file contents in the browser rather than uploading them.

## Design references

- [Fluent 2 development guide](https://fluent2.microsoft.design/get-started/develop)
- [Fluent UI React](https://react.fluentui.dev/)
- [Microsoft Fluent UI repository](https://github.com/microsoft/fluentui)
