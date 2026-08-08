import { clampNormalized } from '../math/util'

/**
 * Phase-offset follow: every mover in a split runs the same pan/tilt modulation, but
 * each one is advanced by a fixed slice of the LFO cycle relative to the one before it,
 * so the movement rolls across the rig instead of firing in unison.
 *
 * The `moverPhaseX` / `moverPhaseY` params are normalized 0–1 = 0–360° of stagger
 * **per fixture**, so 0 is unison and 1 wraps a full cycle back to unison.
 */
export const MOVER_PHASE_MAX_DEGREES = 360

/** Below this the offset is inaudible on a DMX step; treated as unison (fast path). */
const MOVER_PHASE_MIN_ACTIVE_CYCLES = 0.0005

export function moverPhaseStepCycles(paramValue: number | undefined): number {
  return clampNormalized(Number(paramValue ?? 0))
}

export function moverPhaseStepDegrees(paramValue: number | undefined): number {
  return moverPhaseStepCycles(paramValue) * MOVER_PHASE_MAX_DEGREES
}

export function moverPhaseStepIsActive(paramValue: number | undefined): boolean {
  return moverPhaseStepCycles(paramValue) >= MOVER_PHASE_MIN_ACTIVE_CYCLES
}

/** Cycle offset for the mover sitting at `orderIndex` of the DMX-address order. */
export function moverPhaseOffsetCycles(
  orderIndex: number,
  stepCycles: number
): number {
  if (!Number.isFinite(orderIndex) || orderIndex <= 0) return 0
  return Math.floor(orderIndex) * stepCycles
}

export type MoverPhaseOrderEntry = {
  /** Stable per-fixture key — the fixture id everywhere it exists. */
  key: string
  universe: number
  /** Start (base) DMX channel of the fixture. */
  channel: number
}

/**
 * Fixture order used to assign phase rungs. DMX address for now — patch order is the
 * one ordering every rig already has. A configurable order (Movers tab) can replace
 * this by feeding entries in a different sequence.
 */
export function moverPhaseOrderIndexes(
  entries: ReadonlyArray<MoverPhaseOrderEntry>
): Map<string, number> {
  const seen = new Set<string>()
  const unique: MoverPhaseOrderEntry[] = []
  for (const entry of entries) {
    if (entry.key.length <= 0 || seen.has(entry.key)) continue
    seen.add(entry.key)
    unique.push(entry)
  }

  unique.sort((left, right) => {
    if (left.universe !== right.universe) return left.universe - right.universe
    if (left.channel !== right.channel) return left.channel - right.channel
    return left.key.localeCompare(right.key, 'en')
  })

  const indexByKey = new Map<string, number>()
  unique.forEach((entry, index) => {
    indexByKey.set(entry.key, index)
  })
  return indexByKey
}
