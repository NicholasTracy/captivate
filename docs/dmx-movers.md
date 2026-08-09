# DMX output and movers

How Captivate builds DMX universes, routes them to USB / Art-Net, and drives
moving-head pan/tilt without fine-channel chatter during travel.

## Architecture

```text
Realtime loop (~90 Hz)
  → DMX compute at configured output rate
  → calculateDmx (scenes → HTP / axis overrides → mixer)
  → AtmosphericsOutputManager.apply (fog / FX channels)
  → finalizeDmxUniverses (blackout + zero unpatched)
  → USB DMX devices and/or Art-Net UDP
```

Entry points:

| Layer | Path |
|-------|------|
| Engine tick / flush | `src/main/engine/engine.ts` |
| Universe frame build + mover pathing | `src/main/engine/dmxEngine.ts` |
| Channel math / coarse–fine emit | `src/shared/dmxUtil.ts` |
| Output rate selection | `src/shared/dmxOutputRate.ts` |
| USB DMX | `src/main/engine/connections/dmx/` |
| Art-Net | `src/main/engine/connections/art-net/` |
| Connections UI | `src/renderer/overlays/Devices.tsx` |
| Movers page / pad targets | `src/renderer/pages/Movers.tsx`, `src/shared/moverPadTargets.ts` |

## Universes and rates

| Constraint | Value |
|------------|--------|
| Channels per universe | 512 (`DMX_NUM_CHANNELS`) |
| Max universes | 16 (`DMX_MAX_UNIVERSES`) |
| Open DMX USB default rate | 30 Hz (UI range 5–40) |
| USB DMX Pro | 40 Hz |
| Art-Net send period | ~44 Hz (`1000/44` ms), UDP port `0x1936` (6454) |

Universe count is `max(1, connectionSettings.universeCount, highest patched fixture universe)`.
DMX compute interval uses the highest configured output rate among active USB and
Art-Net targets (`getConfiguredDmxOutputRateHz`).

## Frame composition

For each universe, `calculateDmx` / `calculateDmxForUniverse`:

1. Start from zeros, write fixture defaults.
2. Apply active light-scene splits via `getDmxValue`.
   - Non-axis channels use HTP (`Math.max` across splits).
   - Pan/tilt axis channels use the planned axis override (exact write).
3. Apply mixer overwrites (normalized 0..1 → 0..255).
4. Zero unpatched addresses, then normalize.

After scene DMX, atmospherics may raise fog/FX channels. `finalizeDmxUniverses`
re-zeros unpatched slots and, when **Blackout** is on, zeros every universe.

## Connections setup

1. Open **Connections** (ethernet icon in the status bar).
2. Set **Universe Count** (1–16).
3. Enable a USB DMX interface and assign its universe. For Enttec-style clones
   that need Widget protocol, enable **USB Pro protocol** for that device.
4. For Art-Net, enter an IPv4 address per universe. Blank routes are not sent.
   If a per-universe IP is empty, Captivate falls back to `connectable.artNet[0]`.

### Art-Net SubUni

Art-Net packets encode Captivate universe **1** as SubUni **0** (0-based index).
Receivers that expect 1-based universe numbers can appear “off by one.”

Invalid / non-IPv4 targets are skipped. UDP send errors close and recreate the
socket (`ArtNetManager`).

## Movers: pad → DMX

Operator aim comes from the scene XY pad (`xAxis` / `yAxis`) and optional
Advanced Movers controls:

Aim is built in layers, not picked from a menu. `moverMode` chooses the **base
pattern**; mirroring and phase offset are **modifiers** that stack on whatever it
produced.

| Base pattern (`moverMode`) | Behavior |
|----------------------------|----------|
| 0 Follow | Shared aim (follow override can force this) |
| 1 Tandem | Group members spread around the pad; max spread **0.65** |
| ~~2 Mirror~~ | Legacy exclusive mode. Folds to Follow; the mirror flags carry it |

| Modifier | Behavior |
|----------|----------|
| `moverMirrorX` / `moverMirrorY` | Folds the right-hand / lower movers around the pad center |
| `moverPhaseX` / `moverPhaseY` | Staggers each mover along the LFO cycle (see below) |

Order of application is base aim → phase offset → tandem spread → mirror, so a
mirrored fixture reflects the aim it actually had. Follow override is the one thing
that wins outright: a pinned group ignores both modifiers.

With **Advanced** off, every mover in the split gets the same base aim (no
group/tandem/mirror/phase). With Advanced on, `resolveMoverPadTargetsForGroup`
builds per-fixture targets; missing pan+tilt targets fall back to home mapping.

### Phase-offset follow

`moverPhaseX` / `moverPhaseY` stagger each mover's pan / tilt **modulation** by a
slice of the LFO cycle, so a move rolls across the rig instead of firing in unison.
Both are normal 0–1 params, so an LFO can drive the stagger itself.

| Aspect | Behavior |
|--------|----------|
| Slider range | 0–1 = **0–360° per mover** (`MOVER_PHASE_MAX_DEGREES`) |
| Fixture order | Movers tab **Order** column, falling back to DMX address |
| Phase group | One mover group, and within it one mirror half per mirrored axis |
| Rung 0 | First mover of each phase group keeps the split aim |
| Axes | Pan and tilt are independent; equal steps share one evaluation |
| Interaction | Composes with tandem / mirror — the offset replaces each fixture's aim *before* spread and mirroring |
| Follow override | Wins; a pinned group ignores phase offset |

#### Phase groups

Rungs restart inside each phase group rather than running once across the split, so
mirroring splits the wave instead of flipping half of a global one. A mirrored line of
six walks `0,1,2` down each side of three; unmirrored it walks `0…5` across all six.

The mirrored half also runs its sequence **backwards**, so a fixture and its reflection
share a rung and the whole rig is symmetric about the mirror axis — the timing mirrors
along with the aim. Mirroring both axes reverses twice, i.e. not at all.

```text
line of 6, phase 60°, sin on pan   ->  253  207   81    1   47  173
same line + Mirror L/R             ->  253  207   81 | 173   47    1
                                       rungs 0,1,2     rungs 2,1,0, aim mirrored
```

Because a mover group is the unit, a split holding two mover groups gives each its own
wave — the same scoping tandem and mirror already use.

`360 / moverCount` spreads a phase group evenly (the UI shows this hint). Offsets past
180° read as the wave running the other way.

#### Order

**Movers** tab (Advanced) gives every mover an **Order** box:

- Blank = follow DMX address (universe first, then start channel). A rig that never
  touches this behaves exactly as if the column did not exist.
- A number pins that mover's place; lower goes first. Anything still blank follows
  all numbered movers, among themselves in DMX-address order.
- **Number Order** stamps 1…N onto the current sequence so a couple of movers can be
  swapped without typing every row; **Reset Order** clears back to address order.
- The `#` beside each box is the mover's place across the whole rig. Phase walks the
  same sequence but restarts per phase group, so a split does not always start at #1.

Order lives in `dmx.moverPhaseOrderByFixtureId` (project state, shared by every
split). Every consumer resolves it through `getMoverPhaseOrderEntries()` — the tab's
`#` badge via `moverPhaseOrderIndexes()`, and the engine and pad preview via
`resolveMoverPhaseRungs()`, which adds the phase-group partitioning.

### Legacy mover modes

Mirroring used to require `moverMode: 2`, which meant tandem spread and mirroring
could never run together, and mirror flags left behind by an earlier mode selection
sat inert. Now that they compose, those stale flags would silently start mirroring, so
`migrateExclusiveMoverModes` rewrites old scenes to the (mode, flags) pair that
reproduces exactly what they used to output.

It is **version-gated at the load boundary** — `PROJECT_SAVE_VERSION` 8 and
`AUTOSAVE_VERSION` 5 — not run from `fixLightScenes`. Running it unconditionally would
wipe a deliberate Follow + Mirror every time a project was reopened. At runtime
`normalizeMoverMode` folds a stored `2` to Follow, so an unmigrated scene still behaves
correctly.

Mechanically, `getOutputParamsAtPhaseOffset` re-runs the split's modulation matrix
with every **wave** LFO slid along its own cycle (`Lfo.phaseShift`), applied after
inter-mod so an `intermod:*:phaseShift` route cannot clamp it away. Audio-shape LFOs
are peeked, never advanced and never shifted — a live envelope has no cycle to slide
along, and `getOutputParams` already owns its state for the tick. Aim is computed
once per DMX frame in `calculateDmx` and shared across universes.

Pathing runs only when the fixture has a planner key
(`u{universe}:{fixtureId}:x{panCh}:y{tiltCh}`). Without planner state, output is
**rounded coarse only** and fine is disabled.

### Pathing limits

| Constant | Value |
|----------|--------|
| Max pan / tilt speed | 360 / 320 DMX units per second |
| Max pan / tilt accel | 1700 / 1400 DMX units per second² |
| Planner state stale | 15 s idle reset |
| Target deadband | 0.05 DMX |

### Fine channels (16-bit axes)

Fine is **only for final alignment inside one coarse DMX step**. Coarse owns
travel. Fine enables only when the commanded target is still and the axis has
settled near it; any newly accepted target disables fine again.

| Gate | Distance (DMX) | Velocity (DMX/s) |
|------|----------------|------------------|
| Enable | ≤ 0.48 | ≤ 0.85 |
| Disable | ≥ 0.85 **or** target moving | ≥ 1.8 |

Emit rules (`axisOverrideDmxToChannelValue`):

- **Travel / fine off:** coarse rounded to whole DMX steps; fine parked at **0**
  (not mid-step), so 16-bit fixtures do not sit halfway between coarse steps
  while moving.
- **Fine on:** axis quantized to `1/64` DMX (~4 fine LSBs) to avoid LSB chatter;
  fine carries the fractional residue.
- Values within **0.06** DMX of an integer snap to that step.

This matches the chatter fix that keeps fine off during pad tracking and travel.

## Operator pitfalls

- **Fine quiet while moving is intentional.** Expect fine to sit at 0 until the
  head settles on a still target.
- **`moverFloorLock`** is a UI / param flag for floor-bound visualization; it does
  not clamp live pan/tilt to `moverBounds` inside `dmxEngine`.
- **Unpatched → 0.** Mixer writes to unpatched addresses are cleared again during
  finalize.
- **Status bar “No DMX output”** reflects USB enablement, not Art-Net-only setups.
- **Phase offset needs movement to show.** With no LFO on pan/tilt every fixture sits
  at the same static aim, so any phase offset looks like nothing happened.
- **Legacy path:** if no axis overrides are present, `calculate_axis_channel` can
  still emit continuous fine — different from the park-at-0 travel path.

## Troubleshooting

| Symptom | Check |
|---------|--------|
| No USB output | Device enabled in Connections; drivers; port not in use; Widget protocol for Pro clones |
| Art-Net silent | Per-universe IPv4 set (or fallback `artNet[0]`); SubUni 0-based vs receiver numbering; firewall UDP 6454 |
| Head chatters on fine | Confirm fixture has pan/tilt fine channels; fine should stay 0 while travelling — if chatter persists, check for a second controller writing the same addresses |
| Slow / stepped movers | Pathing accel limits; raise Open DMX Hz only for Open DMX USB; Art-Net is fixed ~44 Hz |
| Mixer fader ignored | Address must be patched; blackout zeros everything |

## Related

- [Project files and autosave](PROJECTS.md) — DMX Settings section in `.cap`
- [Atmospherics](atmospherics.md) — fog / FX channel writes after scene DMX
- [WLED fixtures](wled-fixtures.md) — LED output (separate from DMX universes)
- [Remote control (LAN)](remote-control.md) — remote mixer / connections view
