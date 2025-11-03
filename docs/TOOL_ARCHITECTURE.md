# Tool System Architecture

## Overview

Multi-tool cleaning system with clean separation of concerns and easy extensibility.

## Core Abstractions

### ITool Interface (`src/types/tools.ts`)

Contract for all cleaning tools:

- **Lifecycle**: `activate()`, `deactivate()`
- **Input Handling**: `handleDown()`, `handleMove()`, `handleUp()`
- **Updates**: `update(deltaMs)`
- **Validation**: `isValidInputLocation(worldX, worldY, isOnObject)`

### BaseTool (`src/tools/BaseTool.ts`)

Abstract base class:

- Manages `active` state
- Stores tool config (id, name, icon)
- Enforces implementation of all ITool methods

### Concrete Tools

#### ScrubbingTool (`src/tools/ScrubbingTool.ts`)

- **Mechanic**: Click & drag, stamp-based cleaning
- **Internal**: Wraps StrokeSystem for evenly-spaced stamps
- **Validation**: Only works ON object surface
- **Events**: Emits STAMP_APPLIED via GameEventDispatcher

#### Future: PowerWashTool

- **Mechanic**: Continuous spray, larger radius
- **Internal**: Direct particle emission, area-based dirt removal
- **Validation**: Works both on/off object (spray can miss)

## Supporting Systems

### ToolManager (`src/systems/ToolManager.ts`)

Manages active tool state:

- `setActiveTool(tool)` — switches tools, handles deactivation
- `getActiveTool()` — returns current tool
- `deactivateAll()` — cleanup on shutdown
- **Ensures**: Only one tool active at a time

### InputController (`src/systems/InputController.ts`)

Coordinates input with tilt + tool:

- Accepts `ITool` interface (tool-agnostic)
- Delegates pointer events to active tool
- Manages input locking (e.g., after win)
- Coordinates with TiltController for mesh physics

### StrokeSystem (`src/systems/StrokeSystem.ts`)

Internal helper for stamp-based tools:

- Converts drag path → evenly-spaced stamps
- Handles jitter, speed boost, soft falloff
- Emits STAMP_APPLIED events
- **Note**: Not exposed to GameScene, only used by ScrubbingTool

## Event Flow

```
User Input (pointer)
  ↓
InputService (normalized world coords)
  ↓
InputController (delegates to active tool)
  ↓
ActiveTool (e.g., ScrubbingTool)
  ↓
StrokeSystem (internal, stamp logic)
  ↓
DirtSystem (apply dirt removal)
  +
  ↓
GameEventDispatcher (emit STAMP_APPLIED)
  ↓
ParticlesSystem (react with spray particles)
```

## Tool Switching Flow

```
GameScene.switchTool(newTool)
  ↓
ToolManager.setActiveTool(newTool)
  ├─ oldTool.deactivate()
  └─ newTool.activate()
  ↓
InputController updated with new tool reference
```

## Code Metrics

- **ITool interface**: 71 lines (types/tools.ts)
- **BaseTool**: 43 lines (abstract base)
- **ScrubbingTool**: 87 lines (concrete implementation)
- **ToolManager**: 47 lines (lifecycle management)
- **StrokeSystem**: 165 lines (internal helper, simplified)

## Extensibility

To add a new tool:

1. Create `src/tools/NewTool.ts` extending `BaseTool`
2. Implement all ITool methods
3. Define tool-specific config interface
4. Instantiate in GameScene
5. Add to ToolManager via `setActiveTool()`
6. (Optional) Add UI button to call `GameScene.switchTool()`

## Principles

- **Single Responsibility**: Each class has one clear job
- **Interface Segregation**: ITool defines minimal contract
- **Open/Closed**: Easy to add tools without modifying existing code
- **Dependency Inversion**: InputController depends on ITool, not concrete classes
