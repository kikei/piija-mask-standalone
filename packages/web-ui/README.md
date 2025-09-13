# @redactjp/web-ui

Web UI for personal information masking tool.

## Scripts

- `npm run build`: Build the web UI for production
- `npm run dev`: Start development server
- `npm run test`: Run unit tests
- `npm run test:e2e`: Run end-to-end tests with Playwright
- `npm run typecheck`: Run TypeScript type checking
- `npm run format`: Format code with Prettier

## Testing

### Unit Tests (`tests/*.test.ts`)

- `text-utils.test.ts`: Text processing and masking utilities
- `position-calculator.test.ts`: DOM position calculation logic
- `html-renderer.test.ts`: HTML rendering functions

### End-to-End Tests (`tests/e2e.test.ts`)

- **Basic functionality**
  - Page loading and title verification
  - Automatic masking of emails and phone numbers
- **Interactive functionality**
  - Click-to-unmask tokens
  - Drag-to-mask manual selection
  - Tab switching between original and masked text
  - Copy to clipboard functionality
  - Reset to initial state
- **Line break preservation**
  - Multiline text handling in original and masked displays

## Test Coverage

The E2E tests verify:

1. ✅ Email masking: `test@example.com` → `＊＊＊＊`
2. ✅ Phone masking: `090-1234-5678` → `＊＊＊＊`
3. ✅ Manual masking: Drag selection → `＊＊＊＊`
4. ✅ Click unmasking: `＊＊＊＊` → original text
5. ✅ Tab switching: Original ↔ Masked views
6. ✅ Copy functionality: Button state + clipboard
7. ✅ Reset functionality: Return to initial masked state
8. ✅ Line breaks: Preserved in HTML display

## Architecture

The web UI is built with:

- **Small composable functions** for better testability
- **Modular design** split across utility files:
  - `text-utils.ts`: Text processing logic
  - `position-calculator.ts`: DOM selection mapping
  - `html-renderer.ts`: Display rendering
  - `main.ts`: Main application logic
- **Browser-compatible**: No Node.js dependencies in runtime
- **TypeScript strict mode**: Full type safety
