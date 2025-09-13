# @redactjp/redact-wasm

WebAssembly-based Japanese morphological analysis for personal information masking.

## Overview

This package provides a WebAssembly implementation of Japanese name detection using morphological analysis. It's designed to work both in Node.js and browser environments.

## Features

- **WASM-based**: Fast morphological analysis compiled to WebAssembly
- **Universal**: Works in Node.js and browsers
- **Lightweight**: Optimized for personal information detection
- **Privacy-focused**: Runs locally without sending data to external services

## API

```typescript
// Initialize with dictionary data
await init(dictBytes: Uint8Array): Promise<void>

// Check if tokenizer is ready
isReady(): boolean

// Detect names in Japanese text
detectNames(text: string): Finding[]
```

## Usage

```typescript
import { init, detectNames, isReady } from '@redactjp/redact-wasm';

// Load dictionary data
const dictBytes = await fetchDictionary();
await init(dictBytes);

if (isReady()) {
  const findings = detectNames('田中太郎さんが来社しました。');
  console.log(findings);
  // [{ type: 'name', start: 0, end: 3, original: '田中太郎' }]
}
```

## Building

```bash
# Install wasm-pack if not already installed
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Build the WASM package
npm run build
```

## License

MIT License - see LICENSE file for details.

## Third-party Dependencies

This package may include Sudachi dictionary data. Please see THIRD-PARTY-NOTICES.md for license information.
