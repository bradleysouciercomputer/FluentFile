# FluentFile

FluentFile is a browser-local file manager built with Microsoft's official **Fluent UI React v9** component library and Fluent 2 themes.

## Features

- Upload files or drag-and-drop into the current folder.
- Create, rename, move, and open nested folders; delete folders only when empty.
- Copyable deep links for folders and files (local to the current browser profile).
- Search by name and filter by file type; sort by name, size, or modified date.
- Grid and list layouts, previews, and downloads for common file types.
- Select multiple files for bulk favorite, recycle-bin, restore, permanent-delete, or ZIP-download actions.
- Duplicate files, folder ZIP export, and full ZIP backup/restore.
- Favorites, recent files, and recycle bin.
- Light/dark themes using Fluent UI React's official theme tokens.
- Keyboard shortcuts: Ctrl/⌘+K focuses search; Ctrl/⌘+Shift+U opens the upload dialog.
- File contents are saved in browser IndexedDB; FluentFile does not upload files to a storage server.

## Development

Requires Node.js 20+.

```sh
npm install
npm run dev
```

## GitHub Pages

The `.github/workflows/pages.yml` workflow installs dependencies, builds with Vite, and deploys `dist` on pushes to `main`.

Site: https://bradleysouciercomputer.github.io/FluentFile/

## Storage and links

Files are local to the browser profile and site origin; they do not sync between devices. A copied file/folder link is a local navigation link, not a public share or cloud link. It works only where that item's IndexedDB record already exists. Clearing the site's browser data or storage eviction may remove files, so make ZIP backups regularly.

## Official design references

- [Fluent 2 — Get started developing](https://fluent2.microsoft.design/get-started/develop)
- [Fluent 2 React components](https://fluent2.microsoft.design/components/web/react/)
- [Microsoft Fluent UI React repository](https://github.com/microsoft/fluentui)
