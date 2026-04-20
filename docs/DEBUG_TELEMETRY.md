# Captivate Telemetry And Debugging

## What Is Captured

Captivate now records:

- Main process health:
  - CPU %
  - memory usage
  - event loop lag
- Engine timing:
  - realtime tick duration
  - DMX calculation duration
  - NodeLink fallback activations/recoveries
- Renderer health:
  - uncaught errors
  - unhandled promise rejections
  - event loop lag
  - RAF FPS heartbeat
- Lighting 3D health:
  - frame stalls and recoveries
  - average frame time and FPS
  - **fps_1s** (frames completed in the last second while the viewport is visible)
  - **frame_ms_max_1s** (worst single-frame time in that second)
  - frame render errors
- Audio engine telemetry:
  - input/energy levels
  - detected BPM
  - analysis timing
- Streaming telemetry:
  - NDI/RTSP start/stop/errors
  - frame pipeline timing
  - ffmpeg lifecycle events
- WLED telemetry:
  - discovery warnings/errors
  - device add/remove/rebind
  - UDP send errors and broadcast tick timing
- IPC usage counters across core commands.

## How To Export A Snapshot

Use:

- `Help -> Export Telemetry Snapshot`

This writes a JSON snapshot to the app log directory and shows the file path.

## Diagnostics Log Locations (Windows)

- `%APPDATA%\\captivate2\\logs\\captivate-diagnostics.log`
- `%TEMP%\\captivate-diagnostics.log`
- `C:\\Users\\<user>\\AppData\\Local\\Programs\\captivate2\\captivate-diagnostics.log`

Log rotation is enabled automatically when a log exceeds 10 MB.

## Lighting 3D live HUD (while the app is running)

In the Lighting 3D viewport (embedded or detached window):

- Press **Alt+Shift+H** to toggle an on-screen overlay with **FPS (1s)**, **avg / max / last frame ms**, **draw calls**, **triangle count**, **geometry/texture counts**, **JS heap** (Chromium), **canvas size / DPR**, fixture counts, and stall / volumetric-fog flags.
- The choice is persisted in `localStorage` under key **`captivate.debug.lighting3dPerfHud`** (`1` = show on next load).

Telemetry from the detached Lighting 3D window is tagged **`renderer-page`**; the main window uses **`renderer-main`**, so snapshots can tell which process produced each mark.

### Live NDJSON stream (agent / terminal friendly)

1. Set environment variable **`CAPTIVATE_TELEMETRY_LIVE_LOG=1`** and start Captivate (main process must pick this up).
2. Main process appends every `lighting3d*` **`TelemetryMark`** as one JSON line to:
   - **`%TEMP%\captivate-telemetry-lighting3d-live.ndjson`**
3. From PowerShell (repo root):

```powershell
.\tools\tail-lighting3d-telemetry-live.ps1
```

Or: `Get-Content $env:TEMP\captivate-telemetry-lighting3d-live.ndjson -Tail 50 -Wait`

**Note:** `captivate-diagnostics.log` only receives **warn/error** diagnostics (e.g. renderer event-loop lag). Gauges such as `lighting3d.render.frame_ms_avg` use the NDJSON stream or **Help → Export Telemetry Snapshot**.

## Recommended Debug Workflow

1. Start app fresh.
2. Reproduce issue.
3. Export telemetry snapshot from Help menu.
4. Collect:
   - latest telemetry JSON
   - latest diagnostics log
5. Compare timestamps around the issue window.

## Key Signals To Check

- `lighting3d.frame_stall_detected`
- `lighting3d.render.fps_1s` vs `lighting3d.render.frame_ms_avg` / `frame_ms_max_1s`
- `engine.realtime.tick_ms` p95
- `engine.dmx.calculate_ms` p95
- `process.event_loop_lag_ms`
- `audio.detected_bpm`
- `stream.output.*` error counters

## Fixture Library + Lighting 3D Preview Diagnostics

### Fixture library persistence/import checks

Relevant codepaths:

- Storage path + file IO: `src/main/fixtureLibraryStorage.ts`
- Main IPC handlers: `src/main/engine/ipcHandler.ts`
- Renderer helpers: `src/renderer/autosave.ts`
- Import parsing: `src/shared/fixtureLibrary.ts`

Default fixture database path:

- `app.getPath('userData')/fixture-library/captivate-fixtures.captivate-fixtures`

When users report missing fixtures after restart:

1. In **DMX > Fixtures**, use **Save DB** and confirm the success path shown by the app.
2. Restart and use **Load DB**. If nothing loads, verify the file exists at the
   default path from step 1.
3. Export telemetry snapshot and check IPC counters for:
   - `load_fixture_library_default`
   - `save_fixture_library_default`
   - `get_fixture_library_default_path`
4. If import errors mention invalid content, verify the input contains valid
   fixture payloads (`name` + `channels`) and is one of:
   - Captivate fixture JSON
   - Open Fixture Library JSON
   - QLC+ fixture XML (`.qxf`)

### Detached Lighting 3D sync checks

Relevant codepaths:

- Detached window creation + bootstrap send: `src/main/main.ts`
- Lighting 3D IPC channels + tick throttling: `src/main/engine/ipcHandler.ts`
- Utility worker tick offload: `src/main/engine/lighting3dUtilityWorkerHost.ts`
- Detached-page tick apply path: `src/renderer/index.tsx`
- Runtime tick reducer bridge: `src/renderer/lighting3d/Lighting3dPreviewRuntimeManager.ts`

Expected runtime sequence:

1. Page opens as detached `Lighting3D` window.
2. Main sends `lighting3d_preview_bootstrap` (full snapshot).
3. Main streams `lighting3d_realtime_tick` (~60/s max, min 17ms interval).
4. Detached page applies bootstrap state, then applies realtime ticks.

If detached preview looks stale/choppy:

- Confirm the window URL includes `page=Lighting3D`.
- Verify the detached page is receiving both bootstrap and realtime channels.
- Compare telemetry:
  - `lighting3d.render.fps_1s`
  - `lighting3d.render.frame_ms_avg`
  - `lighting3d.render.frame_ms_max_1s`
  - `engine.realtime.tick_ms`
- Use `CAPTIVATE_TELEMETRY_LIVE_LOG=1` + NDJSON tailing to inspect per-second
  Lighting 3D telemetry marks during repro.
