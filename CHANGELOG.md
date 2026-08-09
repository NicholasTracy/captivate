# Changelog

## Unreleased

### Show control & DMX

- Movers: **phase-offset follow**. New `moverPhaseX` / `moverPhaseY` params (0–360° per
  fixture) stagger each mover's pan/tilt modulation along the LFO cycle, so a move rolls
  across the rig instead of firing in unison. Both sliders live in the Advanced Movers
  panel and can themselves be driven by an LFO.
- Movers tab: per-fixture **Order** column setting the phase-offset follow sequence, with
  Number Order / Reset Order. Blank follows DMX address, so existing projects are
  unchanged.
- Movers: **mirroring is now a modifier, not a mode**. Mirror L/R and T/B stack on Follow,
  Tandem, and phase-offset follow instead of being an exclusive third pattern, so a
  tandem fan or a phase wave can be mirrored. Mover Pattern is now Follow / Tandem.
  Projects saved before this (`PROJECT_SAVE_VERSION` 8, `AUTOSAVE_VERSION` 5) are
  migrated on load so their output is unchanged.
- Movers: phase-offset follow now walks **per phase group** — one mover group, and within
  it one mirror half per mirrored axis — instead of one wave across the whole split. A
  mirrored line of 6 runs 0,1,2 down each side of 3, with the mirrored side reversed so
  the timing is symmetric about the mirror axis, not just the aim.

### Fixes

- Mover calibration is now stored **per fixture** instead of per fixture type. Aim
  references (home / front / back / up / down) depend on where a head is rigged, so
  calibrating one mover moved every other fixture of the same model. A fixture with no
  calibration of its own still falls back to the type's, so existing projects are
  unchanged until a head is calibrated.
- Mover calibration preview now lights the head it is previewing. With the transport
  stopped every other channel sits at its default — dimmer at `min`, shutter closed — so
  the head aimed correctly but stayed dark and there was nothing to sight along.
- Randomizer: a split now shows **one slot per fixture**. `flatten_fixture` splits a
  fixture into channel-family partitions (RGB / white / the rest), and slots were counted
  per partition while being consumed per fixture — so a 2-mover split drew 4 bars and left
  2 of them permanently dark. All of a fixture's emitters now share its slot, so they dim
  together.
- Randomizer now runs on the **dimmer** for any fixture that has one, instead of only on
  colour channels. A moving head dims through its master, and a movers split usually
  carries no colour params at all, so the randomizer had nothing to act on and appeared
  dead. `flatten_fixture` marks the dimmer as the carrier whenever a fixture has a master
  channel and the emitter channels then skip it, so it is applied exactly once. Fixtures
  with no dimmer (RGB-only pars) still randomize through colour as before.
- Search For Fixture Online no longer trips GitHub's `429` / rate-limit error while
  browsing. Each library now loads a single index instead of one directory listing per
  manufacturer: QLC+ uses its published `FixturesMap.xml` over `raw.githubusercontent.com`
  and makes **no** API calls at all, while Open Fixture Library and the Captivate
  Community Library make one each. Switching manufacturers is also instant, and the
  rate-limit message now says when the limit resets.

## 1.1.3

### Fixes

- macOS: stop wiping koffi’s prebuilt natives during darwin universal rebuild (app no longer crashes on launch with “Cannot find the native Koffi module”).
- macOS: prefer vendor universal prebuilds for `usb` / `@serialport/bindings-cpp`; install correct-arch `ffmpeg-static` and projectM runtime per DMG in afterPack.
- Lazy-load koffi so a missing native cannot brick main-process boot.

## 1.1.2

### Show control & DMX

- Audio LFO envelope correctness (per-split state, beat clock, peek vs advance).
- Randomizer slot identity and universe-safe lookup.
- Gobo/prism mid-slot DMX, focus clamp, and safer type lookups.
- Modulation matrix dedicated-group / movers filter fixes.

### Packaging & docs

- projectM packaging env fixes; README CI/release badges.
- Release CI screenshot review pack (artifact + `screenshots-review.zip`, not auto-merged).
- Fixture-rich screenshot demo project (`tools/screenshots/fixtures/demo.cap`).

### Fixes

- Scene remove/copy guards, audio stream start race, mixer slice naming, and related hardening.
- Project load no longer mutates frozen Redux device state when a save omits the device slice.
- Atmospherics no longer infinite-loops (React #185) when selecting a fixture without existing control config.

## 1.1.1

### Audio input

- Advanced Music Energy controls: energy response, dynamics, and rhythm emphasis in the audio input menu.

### Connections & fixes

- Ableton Link toggle and status stay in sync while transport is playing.
- Windows CI native rebuild fix for updated GitHub Actions runner images.

## 1.1.0

### Projects & fixtures

- File-based projects (`.cap` + `.cfx`), New Project dialog, file autosave, and Recent Projects.
- Subfixtures, emitter layout editor improvements, and fixture mapping/placement polish.

### Show engine & UI

- True transport stop/play freeze with live mixer, audio, and patching while paused.
- Instant DMX response for master, blackout, split params, and mixer overrides.
- Smoother engine/UI timing, engine-synced beat meter and mixer display, canvas LFO graph.
- Redesigned status bar; wide master fader and aligned blackout control.
- Lighting 3D preview improvements and detached preview window.

### Fixes

- Transport resume jump, live control lag, UI stutter, beat gauge drift, mixer display lag, and layout regressions.
- Windows/macOS packaging and CI build fixes.

## 1.0.1

### Community fixture library

- **Search For Fixture Online** now includes **Captivate Community Library** — download fixtures other users have shared, organized by manufacturer and model.
- **Share to Library…** on any fixture sends your definition to the community library after a quick GitHub sign-in in your browser (paste the sign-in code from your clipboard when asked).
- Clear step-by-step progress in the share dialog so you know what happens from sign-in through publishing.
- Help links and documentation for browsing and sharing fixtures.

### Fixtures improvements

- Cleaner **Fixtures** list layout with easier-to-read rows and **Load DB** / **Save DB** always at the bottom.
- **Fixture mapping** panel updates: compact position and rotation controls, clearer help, and options that match your fixture settings (including Z depth when enabled).
- Small polish across fixture editing and online search.

## 1.0.0

- First public release of Captivate 2.

## 0.9.4

- Initial Beta release
