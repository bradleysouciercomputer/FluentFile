# FluentFile

FluentFile is a browser-local file manager built with Microsoft's official **Fluent UI React v9** component library and Fluent 2 themes.

## Features

- Upload files or drag-and-drop into the current folder.
- Create, rename, move, and open nested folders; delete folders only when empty.
- Copyable deep links for folders, files, FluentFile Docs, and FluentFile Slides (local to the current browser profile).
- Create and edit rich-text documents inside the same file workspace.
- FluentFile Canvases drawing workspace with pen, eraser, lines, rectangles, ellipses, text labels, color/background controls, brush sizing, grid toggle, undo/redo, autosave, and PNG or editable JSON export.
- FluentFile Slides presentation workspace with editable slide titles and body content, title/content/quote layouts, slide reordering and duplication, speaker notes, themes, presentation mode, autosave, and HTML/JSON export.
- Search by name and filter by file type; sort by name, size, or modified date.
- Grid and list layouts, previews, and downloads for common file types.
- Select multiple files for bulk favorite, recycle-bin, restore, permanent-delete, or ZIP-download actions.
- FluentFile Docs editor with headings, emphasis, bulleted/numbered lists, interactive checklists, quotes, code blocks, links, horizontal dividers, and date/time insertion.
- Document outline navigation for heading-based jumping, find/replace across inline formatting, live word/character counts, and estimated reading time.
- Autosave with ordered writes, Ctrl/⌘+S manual save, undo/redo, clean print layout, and HTML/Markdown/plain-text export.
- ZIP backups and folder exports preserve FluentFile Docs metadata so restored docs remain editable.
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
