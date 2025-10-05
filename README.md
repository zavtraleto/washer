# Washer

# Washer Game

A TypeScript + React + Three.js game built with Vite.

## Structure

- `src/app/` — React UI components (routes, store)
- `src/game/` — Three.js game engine (to be implemented)
- Strict TypeScript with path aliases: `@app/*`, `@game/*`

## Quick Start

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Routes

- `/` — Main menu
- `/play/:id` — Gameplay view
- `/gallery` — Level gallery

## Development

The project uses:
- **Vite** for fast HMR and builds
- **TypeScript** in strict mode with enhanced checks
- **React Router** for navigation
- **Zustand** for state management
- **Three.js** for 3D rendering (v0.180.0)
- **ESLint + Prettier** for code quality

Paths are aliased for clean imports:
```typescript
import { App } from '@app/App';
import { Engine } from '@game/Engine';
```

## Notes

- One persistent WebGL canvas will be managed by the game engine
- `src/app` and `src/game` should remain decoupled
- UI communicates with game via event bus (to be implemented)

## Project Structure

- `src/app/` - React UI layer (routes, components, state)
- `src/game/` - Three.js game engine

## Setup

Install dependencies:

```bash
npm install
```

## Development

Run the development server:

```bash
npm run dev
```

Open your browser to the URL shown in the terminal (typically `http://localhost:5173`).

## Build

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Linting

Run ESLint:

```bash
npm run lint
```

## Architecture Notes

- **Strict TypeScript**: All strict flags enabled including `noUncheckedIndexedAccess`, `noImplicitOverride`, and `exactOptionalPropertyTypes`
- **Path aliases**: `@app/*` and `@game/*` for clean imports
- **Separation of concerns**: `src/app` and `src/game` must not cross-import
- **Single WebGL canvas**: One persistent Three.js canvas for all game rendering
- **Zustand state**: UI state managed with Zustand store
