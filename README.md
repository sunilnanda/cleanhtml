# CleanHTML

Paste content from Word, Google Docs, or any rich-text editor and get clean, semantic HTML instantly.

## Features

- **WYSIWYG Input** — Paste rich text directly from Word, Google Docs, or any source. The editor preserves formatting so you can see what you pasted.
- **Auto-Clean** — HTML is cleaned in real-time as you paste or type. No button clicks needed.
- **Heading Markers** — Lines prefixed with `H1:`, `H2:`, or `H3:` are automatically converted to proper heading tags.
- **Attribute Stripping** — Removes `class`, `style`, `dir`, `aria-level`, `role="presentation"`, and other clutter added by editors.
- **Span Removal** — All `<span>` tags are unwrapped, keeping only meaningful semantic elements.
- **Beautify / Minify** — Toggle between nicely indented HTML or a compressed single-line output.
- **HTML & Preview Modes** — Switch between raw HTML code view and a rendered visual preview. Both are editable.
- **Smart Copy** — Two copy buttons: **Copy HTML** copies raw code, **Copy** copies formatted rich text. Both respect text selection.
- **Remove `<br>`** — One-click removal of all `<br>` tags from the output.
- **Dark Mode** — Automatic dark/light theme based on system preference.

## Tech Stack

- [Next.js](https://nextjs.org) 16
- [React](https://react.dev) 19
- [Tailwind CSS](https://tailwindcss.com) 4 + Typography plugin
- [TypeScript](https://www.typescriptlang.org) 5

## Getting Started

```bash
git clone https://github.com/sunilnanda/cleanhtml.git
cd cleanhtml
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deploy

Deploy instantly on [Vercel](https://vercel.com):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sunilnanda/cleanhtml)

## License

MIT
