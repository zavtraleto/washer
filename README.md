# Washer Game

A TypeScript + React + Phaser 3 game built with Vite.

## Architecture

- **`src/app/`** — React UI layer (routes, components, store)
- **`src/game/`** — Phaser game engine (scenes, entities, systems)
- **Strict TypeScript** with path aliases: `@app/*`, `@game/*`
- **Single persistent canvas** — Phaser mounts once behind React

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

## Technology Stack

- **Phaser 3.80** — Game runtime with WebGL rendering
- **React 18** — UI framework
- **React Router** — Client-side routing
- **Zustand** — State management
- **Vite** — Fast HMR and builds
- **TypeScript** — Strict mode with enhanced checks
- **ESLint + Prettier** — Code quality

## Development

### Path Aliases

```typescript
import { App } from '@app/App';
import { DemoScene } from '@game/phaser/scenes/DemoScene';
```

### Phaser Integration

Phaser canvas is mounted **once** on app initialization and persists across route changes:

1. `src/app/boot/phaserHost.ts` — Creates fixed `<div id="game-root">` at z-index 0
2. `src/game/phaser/PhaserGameHost.ts` — Factory for Phaser.Game instance
3. `src/main.tsx` — Calls `initializePhaserHost()` before React mounts

The canvas uses `Phaser.Scale.FIT` mode and auto-centers, responding to window resize and DPR changes.

### Adding Scenes

```typescript
// 1. Create scene class
export class MyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MyScene' });
  }
  // ... preload, create, update
}

// 2. Attach to host in phaserHost.ts
phaserHost.attachScenes([{ key: 'MyScene', sceneClass: MyScene }]);

// 3. Start scene
phaserHost.game.scene.start('MyScene');
```

### HMR Support

Phaser properly cleans up on hot module reload. The host is destroyed and recreated, preventing memory leaks during development.

## Project Constraints

- **No cross-imports** between `src/app` and `src/game`
- UI communicates with game via event bus (to be implemented)
- React UI is positioned above Phaser canvas with `pointer-events: auto`
- Game canvas has `pointer-events: none` for UI interaction priority

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
