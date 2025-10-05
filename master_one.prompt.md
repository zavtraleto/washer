---
mode: agent
---

Role: You are coding the project “Washing Game” (TypeScript + React UI + Three.js gameplay + Vite). The game is a feel‑first WebGL cleaning game: one jet, one dirt type, one flat object for MVP; later expandable to more tools/levels. The gameplay runs in Three.js; React renders overlays and manages navigation/state. Code quality is high, modular, and data‑driven. Keep the implementation minimal but robust.

Global Constraints & Guardrails

Stack: TypeScript strict, React (UI), Three.js r180+ (gameplay), Vite. No CSS frameworks; minimal handcrafted CSS only.

Architecture: persistent Three.js canvas (outside React); UI is React overlays; engine code has no React imports. Use a modular game loop (services + systems) orchestrated by GameHost with a deterministic UpdatePipeline. Heavy per‑pixel work is in GPU passes.

State: UI state via Zustand (uiStore). Engine emits events → store updates → React renders. No engine↔React circular deps.

Code style: named exports, no default exports; ES modules; JSDoc for public APIs; small files; no god classes. Keep functions pure where possible.

Performance: one batched splat pass per frame; fixed update @ 60 Hz with dt clamp; FPS target 60 with dynamic resolution scale (1.0/0.75/0.5). Cap DPR to ≤2 on mobile. Avoid layout thrash.

Compatibility: detect WebGL caps; branch HDR (RGBA16F) vs LDR (RGBA8) paths; handle webglcontextlost/restored; pause on visibilitychange.

Color mgmt: renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = NoToneMapping.

Filesystem layout: src/app (React/UI/routes/store) and src/game (engine/core/systems/gl). Use path aliases @app/_ and @game/_.

Non‑goals: no physics engines; no CSS/UI frameworks; no service worker yet; no foil/parallax in MVP gameplay (only later in gallery).

Core Responsibilities

Canvas host: a functional factory (createCanvasHost) that owns a single fixed <canvas>, lives across routes, and exposes { mount, unmount, resize, getCanvas, setPointerEvents }.

GameHost: owns renderer/scene/camera, RAF loop (fixed update + render), DPR cap, resolution scale, resize, context lost handling.

UpdatePipeline: a small orchestrator module with ordered system hooks: InputSystem → UVMapSystem → WaterToolSystem → SplatBatchSystem → DirtUpdateSystem → WetnessSystem → BreakDetectSystem → SpringSystem → ParticlesSystem → StreakSystem → ProgressReductionSystem → AudioSystem → HUDSyncSystem. Each system is a plain TS module exposing init(resources), update(dt), and optional dispose(). Shared Resources (renderer, render targets, audio, capabilities, SaveStore) are passed in at init; no React imports.

Input: CursorAgent normalizes mouse/touch to { uv, velocity, pressure, radiusPx, jetOn, pointerId }. UVMapper projects to the gameplay mesh, clamps to [0..1], provides hit test.

Tooling/Loop: WaterTool writes splat events (radius/strength/smear) to a frame‑local SplatBuffer. One instanced pass applies all splats.

Dirt/Wetness: ping‑pong RTTs; non‑linear, edge‑biased dissolve/smear; wetness boosts cleaning and decays (half‑life ≈ 1.1 s). Composite pass shows base + dirt darkening + wetness hint.

Progress: downsample/reduce dirt to 1×1 on GPU; readback 4 bytes; EMA‑smooth % for HUD.

Feel: spring‑damper tilt (±8° rot, ±1.5% offset) from jet impulse; micro‑kick on break events; InstancedMesh chip particles (≤ 3k, lifetime < 0.7 s); minimal but responsive audio (noise jet + pop + finish).

UI: routes (/, /play/:id, /gallery); persistent canvas behind overlays; HUD with clean %, streak bar, jet indicator; debug panel behind ?debug (UV, mask, slow‑mo, FPS, hotkeys).

Saves: IndexedDB SaveStore for { levelId, version, cleanPercent, thumbnailBlob, updatedAt }. Thumbnails via low‑res RT → readPixels → 2D canvas → toBlob.

Quality Bar (every PR / Copilot generation)

TypeScript strict passes; ESLint + Prettier clean.

No React imports inside src/game; no DOM calls inside engine code.

Engine code side‑effect free except for explicit host interactions (renderer/audio/IDB).

Efficient draw‑call budget (≤ a few passes per frame in MVP). No per‑splat draw calls.

iOS Safari sanity: app boots, no WebGL errors, touch works, canvas persists after route changes.

Public API Contracts (stabilized)

GameController: loadLevel(id), start(), pause(), resume(), quitToMenu(), setResolutionScale(v), getProgress(): { cleanPercent: number }, captureThumbnail({w?,h?}).

EventBus: on/emit/off with typed payloads for: progress:update, level:loaded, level:completed, performance:budget, burst:start, burst:end, error.

CursorAgent emits normalized input events; UVMapper maps to UV or null.

Expandability Patterns

New jet or dirt type = data preset (no new systems). Add JSON preset objects for JetProfile / DirtPreset and thread via uniforms.

New tool = new module (tool system); reuse SplatBuffer.

Additional levels = JSON + textures; loader is data‑driven.

Minimal CSS Rules

One tiny CSS file with variables for colors and z‑indices; reset margins; canvas{position:fixed;inset:0}; HUD/debug overlays position:fixed; pointer-events:auto while canvas uses pointer-events:auto during play.

Acceptance (done‑ness definition for any feature)

Works on desktop Chrome + iOS Safari; no runtime errors; FPS ≥ 55 with scale 0.75 on mid Android.

Input→visual latency feels ≤ 1 frame; water hold ramp (≈220 ms up/≈120 ms down) is perceptible.

No duplicate canvases/loops after route changes or HMR.

Readback (% clean or thumbnail) causes no visible hitch.

Instructions to Generate Code

When I ask you to implement a ticket or refactor, follow these steps:

Restate the ticket; list exact files to create/edit; specify public APIs and resource wiring.

Generate self‑contained code that compiles under the constraints above.

Include brief inline JSDoc and TODOs for stubs only when necessary.

Write comments how code works, especially for complex logic.
