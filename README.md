# Captivate 2

<img src="https://github.com/spensbot/captivate/blob/main/design/readme/Thick.png" alt="Captivate Icon" width="150"/>

## Visual & Lighting Synth

[CaptivateSynth.com](https://CaptivateSynth.com)

Captivate 2 generates live visuals and dmx lighting. All synchronized to music.
Based on the wonderful work of Spencer @spencbot with Captivate as well as @fwcd and his fork of Captivate. Due to the discontinued nature of Captivate I am working to build upon the original code base with many new features and UI enhancements

## Ready to Impress?

Captivate is groundbreaking software that revolutionizes stage lighting and visuals. Music is intuitive, dynamic, and fun. Thanks to captivate, creating a visual experience feels just as good.

Concert quality visuals and lighting that is easy, fun, and dynamic. Captivate is designed to run autonomously, or you can take as much control as you'd like.

Captivate's design was inspired by synthesisers, so you'll find familiar tools like LFO's, midi integration, pads, and randomizers.

Captivate 2 builds upon this premise and brings new features and enhancements like a full feature fixture library database and the ability to share and import DMX fixtures, multi-window interface for multi screen control, multi-universe USB and Artnet, UI tooltips to help first time users learn the interface, Other UI tweaks and enhancements, and more!

## Add Dimension To Your DMX Universe

Configure your dmx universe in minutes.

Tell Captivate which fixtures you have, and where they are located in space.

Add fixtures seamlessly, without the need to update scenes.

![Captivate DMX Configurator](https://github.com/spensbot/captivate/blob/main/design/readme/screenshot_1_dmx_config.jpg)

## Breathtaking Lighting

With captivate 2, hundreds or even thousands of DMX channels boil down to a handful of intuitive parameters

Take control of these parameters live with MIDI mapping or your keyboard and mouse, or automate them with Captivate's familiar, synth-like modulation tools.

Light groups allow you to add complexity as needed

![Captivate DMX Configurator](https://github.com/spensbot/captivate/blob/main/design/readme/screenshot_2_light_scenes.jpg)

## Stunning Visuals

Combine visualizers and effects in any way to perfect your visual experience

Add your own videos and photos to create something truly unique

Visualizers and effects listen to the parameters from the active light scene so lighing and visuals are automatically synchronized.

![Captivate DMX Configurator](https://github.com/spensbot/captivate/blob/main/design/readme/screenshot_3_visual_scenes.jpg)

## Streamlined Complexity

With Captivate 2, you'll forget there are 512 DMX channels and up to 16 universes running behind the scenes

![Captivate DMX Configurator](https://github.com/spensbot/captivate/blob/main/design/readme/screenshot_4_dmx_console.jpg)

## Always Synchronized

With integrated [Ableton Link](https://www.ableton.com/en/link/) technology, captivate can synchronize bpm and phase with [hundreds of music apps](https://www.ableton.com/en/link/products/) across devices.

Intuitive MIDI mapping allows bi-directional synchronization with industry standard MIDI devices of different types, allows endless possabilities for control and syncronization.

## Create once, Perform anywhere

Since all dmx channels boil down to the same parameters, captivate scenes can play on any lighting setup. Add and remove fixtures, or change venues with ease.

### Watch the Youtube Video

[![Captivate Introduction Video](https://img.youtube.com/vi/6ZwQ97sySq0/0.jpg)](https://www.youtube.com/watch?v=6ZwQ97sySq0)

## Community

Join us on [Discord](https://discord.gg/96DVPcMUUv) or on the [Github Discussion Board](https://github.com/NicholasTracy/captivate/discussions)!

## Developers

### Prerequisites

- Node >= 14.x
- npm >= 7.x
- Python
- Build tools for native modules:
  - macOS: Xcode Command Line Tools
  - Windows: Visual Studio C++ Build Environment

### Local setup

```bash
git clone https://github.com/NicholasTracy/captivate.git
git submodule update --init --recursive
git lfs pull
npm install
npm start
```

`npm start` launches renderer dev server and also spawns:

- preload builder (`start:preload`)
- visualizer dev server (`start:visualizer`)
- Electron main process (`start:main`)

### Architecture at a glance

Captivate 2 is an Electron app with three runtime surfaces:

- **Main process** (`src/main/**`): device connections, DMX output engine, Art-Net output, IPC handlers, detached windows.
- **Renderer** (`src/renderer/**`): editor UI, state management, fixture library editing/importing, scene and device config.
- **Visualizer runtime** (`src/visualizer/**`): video/3D visual output synchronized from realtime state.

State synchronization uses IPC channels in `src/shared/ipc_channels.ts`.

### Core workflows and codepaths

#### 1) Fixture library workflow (import, parse, persist)

- UI entry point: **Universe page** (`src/renderer/pages/Universe.tsx`) -> **Fixtures panel** (`src/renderer/dmx/MyFixtures.tsx`)
- Import sources:
  - Local files via open dialog (`load_file` IPC)
  - Online search modal (`src/renderer/dmx/QlcFixtureBrowserModal.tsx`)
    - QLC+ GitHub fixture repo
    - Open Fixture Library GitHub fixture repo
- Parsing and normalization: `src/shared/fixtureLibrary.ts`
  - Accepts Captivate fixture JSON, OFL JSON, and QLC+ `.qxf` XML
  - Rejects empty/invalid fixture payloads with explicit errors
- Default fixture database storage:
  - Main process path builder: `src/main/fixtureLibraryStorage.ts`
  - Stored at: `<electron userData>/fixture-library/captivate-fixtures.captivate-fixtures`
- Startup sync:
  - Primary window auto-loads default fixture library at boot (`src/renderer/index.tsx`)
  - Missing file is treated as normal (no startup error)
- Shutdown sync:
  - Main window quit flow saves fixture library only when changed (`src/main/main.ts`)

#### 2) DMX output + routing workflow

- Realtime engine loop: `src/main/engine/engine.ts`
- USB DMX connections: `src/main/engine/connections/dmx/**`
  - Device type auto-detected as **DmxUsbPro** or **OpenDmxUsb**
  - OpenDMX refresh rate is configurable in UI
- Art-Net output: `src/main/engine/connections/art-net/ArtNetManager.ts`
  - Routing is configurable per universe (or fallback IP)
- Connection UI: `src/renderer/overlays/Devices.tsx`
  - Universe count range: **1..16**
  - Per-device universe assignment for DMX adapters
  - Per-universe Art-Net IP routing

#### 3) 3D lighting preview workflow

- Page entry: `src/renderer/pages/Lighting3D.tsx`
- Preview fixture mapping: `src/renderer/pages/lightingPreviewFixtures.ts`
- Fixture/source data: DMX state in `src/renderer/redux/dmxSlice.ts`
- Available controls in the page:
  - Curtain toggle
  - Bounds overlay toggle
  - Room toggle + room width/depth/height inputs
  - Fog slider (`0.00` to `1.00`)
- Important constraints:
  - Room dimensions are clamped to a minimum of **5 ft**
  - Stage dimensions are normalized and bounded in `src/shared/stage.ts`
  - If no fixtures exist, the page intentionally shows an empty-state message

### Save formats

- Project save/load format: `.captivate` (`src/renderer/menu/SaveLoad.tsx`)
- Fixture library format: `.captivate-fixtures` (also accepts `.json`, `.db`, `.qxf` for import)
- Save dialog supports partial save domains:
  - DMX settings
  - Light scenes
  - Visual scenes
  - Device settings

### Troubleshooting runbook

#### DMX device not outputting

1. Open **Connections** overlay.
2. Verify the adapter appears in DMX available devices.
3. Ensure the device is enabled (connectable) and connected.
4. Confirm assigned universe matches your fixture universe.
5. If using OpenDMX, adjust **Open Dmx Refresh Rate**.
6. Expand **Troubleshoot** section to inspect serial port metadata and copy details for debugging.

#### Art-Net not outputting

1. Set universe count to include desired universe.
2. Set destination IP for each universe in **Art-Net Routing**.
3. Leave universe IP blank to intentionally disable that route.
4. Validate target IP format (invalid addresses are ignored by sender code).

#### Fixture import fails

1. Confirm file is valid Captivate fixture JSON, OFL fixture JSON, or QLC+ `.qxf`.
2. For online import, verify internet access (GitHub API/raw fetch is required).
3. Retry with **Refresh** in online fixture modal.
4. Check parse error message surfaced by import UI for exact failure reason.

Thanks to [electron-react-boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate) for the app boilerplate

[MIT License](https://github.com/spensbot/Captivate2/blob/master/LICENSE)
