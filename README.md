# FluentFile

FluentFile is a browser-local file manager built with Microsoft's official **Fluent UI React v9** component library, used by Fluent 2 for React web experiences. Components are imported from `@fluentui/react-components` and the application is wrapped in `FluentProvider` with Fluent themes.

## Features

- Upload files or drag-and-drop into the current folder.
- Create nested folders; browse with breadcrumbs.
- Search files and folders; sort by name, size, or modified date.
- Grid and list layouts, file previews, and downloads.
- Favorites, recycle bin, restore, and permanent delete.
- ZIP backup and restore.
- Light and dark themes, using official Fluent UI React components.
- File contents are saved in the browser's IndexedDB. No file content is uploaded to a storage server.

## Development

Requires Node.js 20+.

```sh
npm install
npm run dev
```

## GitHub Pages

The `.github/workflows/pages.yml` workflow runs `npm install`, builds with Vite, and deploys the generated `dist` directory on every push to `main`. In **Settings → Pages**, choose **GitHub Actions** as the deployment source.

Site: https://bradleysouciercomputer.github.io/FluentFile/

## Local storage notes

Files are local to this browser profile and this site origin; they do not sync across devices. Clearing the site's browser data or storage eviction may remove them, so use ZIP backups regularly. Backup and restore uses JSZip as an app dependency.

## Official references

- [Fluent 2 — Start developing](https://fluent2.microsoft.design/get-started/develop)
- [Fluent 2 React components](https://fluent2.microsoft.design/components/web/react/)
- [Microsoft Fluent UI React repository](https://github.com/microsoft/fluentui)
