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

- Node + npm
- Python
- Build tools:
  - macOS: Xcode Command Line Tools
  - Windows: Visual Studio C++ Build Environment

### Setup

```bash
git clone https://github.com/NicholasTracy/captivate.git
git submodule update --init --recursive
git lfs pull
npm install
npm start
```

### Useful npm scripts

- `npm start`: main development entry point (Electron + renderer hot reload workflow).
- `npm run start:main`: run Electron main process watcher only.
- `npm run start:renderer`: run renderer dev server only.
- `npm run start:visualizer`: run visualizer dev server only.
- `npm run build`: production webpack build for main + renderer + visualizer.
- `npm run qlc_fixture_parse`: run QLC fixture parser tooling.

### Runtime architecture (code map)

Captivate runs as a multi-process Electron app:

- **Main process** (`src/main/main.ts`):
  - creates windows,
  - starts the engine,
  - wires IPC,
  - persists the default fixture library on quit when changed.
- **Engine loop** (`src/main/engine/engine.ts`):
  - updates realtime state at ~90 Hz,
  - updates DMX/MIDI connection status every second,
  - computes DMX output by universe.
- **Renderer** (`src/renderer/*`):
  - scene editing, DMX setup, device routing, save/load UI.
- **Visualizer window** (`src/visualizer/*`):
  - receives visualizer state over IPC from the engine.

### DMX and Art-Net workflow

Primary codepaths:

- DMX calculation: `src/main/engine/dmxEngine.ts`
- USB output transport: `src/main/engine/connections/dmx/DmxConnectionUsb.ts`
- Art-Net output transport: `src/main/engine/connections/art-net/ArtNetManager.ts`
- Device settings state: `src/renderer/redux/deviceState.ts`
- Device UI: `src/renderer/overlays/Devices.tsx`

Behavior and constraints:

1. Universe count is user-configurable (1-16) in the **Connections** overlay.
2. Per-device USB universe routing is configured in the same overlay.
3. DMX universe output is generated for all configured/used universes, not only universe 1.
4. Art-Net routing is configured per universe by destination IP. Blank IP disables output for that universe.
5. Open DMX refresh rate is adjustable in UI (5-40 Hz). DMX USB Pro runs at a fixed internal transport rate.
6. DMX output while stopped is intentionally zeroed except calibration preview modes.

### Fixture library workflows

Primary codepaths:

- Fixture parsing and format detection: `src/shared/fixtureLibrary.ts`
- QLC import: `src/shared/qlcFixtureImport.ts`
- OFL import: `src/shared/oflFixtureImport.ts`
- Fixture UI actions: `src/renderer/dmx/MyFixtures.tsx`
- Online fixture browser: `src/renderer/dmx/QlcFixtureBrowserModal.tsx`
- Default fixture DB path I/O: `src/main/fixtureLibraryStorage.ts`

Supported import formats:

- Captivate fixture library JSON (`.captivate-fixtures`, `.json`, `.db`)
- Open Fixture Library fixture JSON
- QLC+ fixture XML (`.qxf`)

Typical workflow:

1. Open **Universe** page -> **Fixtures**.
2. Choose:
   - **Import From File** (local fixture files), or
   - **Search For Fixture Online** (QLC+ / OFL GitHub sources), or
   - **Create New** (manual fixture).
3. Use **Save Fixture Database** to persist the current fixture set to the default fixture-library file.

Default fixture DB location:

- `<electron userData>/fixture-library/captivate-fixtures.captivate-fixtures`

### Save/load and autosave behavior

Primary codepaths:

- Autosave controller: `src/renderer/autosave.ts`
- Autosave storage mechanics: `src/renderer/AutoSavedVal.ts`
- Save payload contract: `src/shared/save.ts`
- Manual save/load UI: `src/renderer/menu/SaveLoad.tsx`

Notes:

- Autosave snapshots are written every second to browser localStorage.
- Snapshot retention uses multiple rolling slots (exponential spacing).
- On startup, the latest autosave is restored if present; otherwise default state is loaded.
- Manual save/load supports partial state application for:
  - DMX settings
  - Light scenes
  - Visual scenes
  - Serial device settings (MIDI + DMX)

### Troubleshooting runbook

#### DMX adapter not detected

- Open **Connections** -> **Troubleshoot** and inspect serial-port metadata.
- Current DMX-device filtering is based on USB product ID `6001` (`src/main/engine/connections/dmx/DmxDevice_t.ts`).
- If your interface does not enumerate with that product ID, it will not appear as a DMX device.

#### DMX adapter detected but no output

- Confirm device is enabled in **Connections** (it must be in connectable DMX list).
- Verify assigned universe and global universe count are correct.
- For Open DMX adapters, try lowering refresh rate if the interface is unstable.

#### Art-Net output not reaching node

- Verify per-universe Art-Net IP route is set and valid.
- Ensure universe count includes the routed universe.
- Leave a route blank to intentionally disable that universe's Art-Net output.

#### Fixture import fails

- Confirm the file is valid Captivate JSON, OFL JSON, or QLC+ `.qxf` XML.
- For malformed files, parser errors are surfaced in the UI import flow.

Thanks to [electron-react-boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate) for the app boilerplate

[MIT License](https://github.com/spensbot/Captivate2/blob/master/LICENSE)
