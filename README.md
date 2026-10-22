# FluentFile — Browser-local file storage

FluentFile is a static file organizer with a Microsoft Fluent 2-inspired interface. It runs on GitHub Pages and stores file contents in the browser using IndexedDB; it does not upload them to a cloud storage server.

## Features

- Upload multiple files or drag and drop them into the site.
- Create, open, and rename folders.
- Search files and folders, sort files, and switch between grid and list views.
- Preview common images, PDFs, text files, audio, and video.
- Favorite files, download individual files, and create ZIP backups.
- Recycle bin with restore and permanent-delete actions.
- Responsive layout and an automatic request for persistent browser storage where supported.

## GitHub Pages

The site is served directly from `index.html`. The workflow in `.github/workflows/pages.yml` publishes that page after each push to `main`, or when manually run. In repository settings, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.

After the workflow succeeds, the project site URL is:

https://bradleysouciercomputer.github.io/FluentFile/

## Storage and privacy

- Files are saved in IndexedDB for this browser profile and this site origin. They do not sync between devices or browsers.
- The site itself is hosted by GitHub Pages, but file contents stay in the visitor's browser and are not uploaded by FluentFile.
- Clearing the browser's site data, using another browser profile, or storage eviction can remove stored files. Create ZIP backups regularly.
- Backup/restore uses JSZip from a public CDN and therefore needs an internet connection when that feature is used.

## Design reference

- [Microsoft Fluent 2 design system](https://fluent2.microsoft.design/)
- [Fluent UI React documentation](https://react.fluentui.dev/)
