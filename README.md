# piija-mask-standalone

A browser-based web app that automatically masks
personally identifiable information (PII) in
Japanese text.

## Packages

### @redactjp/redact

Core library for PII detection and masking,
including name detection powered by Sudachi.
Works in both browser and Node.js environments.

### @redactjp/web-ui

Minimal web client built on `@redactjp/redact`.
The morphological analysis dictionary is
lazy-loaded after the page renders.

## Requirements

- Node.js 18+

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Build

```bash
npm run typecheck
npm run build
```

### 3. Serve the Web UI

Serve the `@redactjp/web-ui` build output with any
static file server.

```bash
npx serve dist

# or
python3 -m http.server --directory dist 8080
```

## License

Please include license notices for Sudachi and its
bundled dictionaries.
