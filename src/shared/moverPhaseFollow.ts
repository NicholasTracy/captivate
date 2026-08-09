import { clampNormalized } from '../math/util'
import { resolveMoverGroupSides } from './moverPadTargets'

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
  /**
   * Explicit order number from the Movers tab. Lower goes first; unset fixtures
   * follow all numbered ones in DMX-address order.
   */
  order?: number
}

/** Largest order number the Movers tab accepts — a rig will never come close. */
export const MOVER_PHASE_ORDER_MAX = 999

/** Positive integer, or undefined for "follow DMX address". */
export function normalizeMoverPhaseOrderValue(
  value: unknown
): number | undefined {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  const rounded = Math.round(parsed)
  if (rounded < 1) return undefined
  return Math.min(MOVER_PHASE_ORDER_MAX, rounded)
}

/**
 * Fixture order used to assign phase rungs: explicit Movers-tab numbers first (ascending),
 * then everything unnumbered in DMX-address order. With no numbers assigned this is pure
 * patch order, which is what a rig gets for free.
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
    const leftOrder = left.order ?? Number.POSITIVE_INFINITY
    const rightOrder = right.order ?? Number.POSITIVE_INFINITY
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
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

export type MoverPhaseFixture = MoverPhaseOrderEntry & {
  /** Mover group; tandem, mirror, and phase all operate within one. */
  groupKey: string
  /** Placement, used to split the group into mirror halves. */
  x: number
  y: number
  sortOrder?: number
}

/**
 * Per-fixture phase rung, restarting inside each **phase group**: one mover group, and
 * within it one mirror half per axis being mirrored.
 *
 * A mirrored line of 6 therefore walks 0,1,2 down each side rather than 0…5 across the
 * whole line. The mirrored half also runs its sequence backwards, so a fixture and its
 * reflection share a rung and the wave is symmetric about the mirror axis — mirroring
 * the timing as well as the aim. Mirroring on both axes reverses twice, i.e. not at all.
 */
export function resolveMoverPhaseRungs(
  movers: ReadonlyArray<MoverPhaseFixture>,
  options: { mirrorLeftRight: boolean; mirrorTopBottom: boolean }
): Map<string, number> {
  const byGroup = new Map<string, MoverPhaseFixture[]>()
  for (const mover of movers) {
    const group = byGroup.get(mover.groupKey)
    if (group === undefined) {
      byGroup.set(mover.groupKey, [mover])
    } else {
      group.push(mover)
    }
  }

  const rungByKey = new Map<string, number>()

  for (const groupMovers of byGroup.values()) {
    const sideByKey =
      options.mirrorLeftRight || options.mirrorTopBottom
        ? resolveMoverGroupSides(groupMovers)
        : null

    // Partition key + whether that partition's sequence runs backwards.
    const partitions = new Map<
      string,
      { reversed: boolean; movers: MoverPhaseFixture[] }
    >()

    for (const mover of groupMovers) {
      const side = sideByKey?.get(mover.key)
      const mirroredX = options.mirrorLeftRight && side?.isRight === true
      const mirroredY = options.mirrorTopBottom && side?.isBottom === true
      const partitionKey = `${mirroredX ? 1 : 0}:${mirroredY ? 1 : 0}`
      const partition = partitions.get(partitionKey)
      if (partition === undefined) {
        partitions.set(partitionKey, {
          reversed: mirroredX !== mirroredY,
          movers: [mover],
        })
      } else {
        partition.movers.push(mover)
      }
    }

    for (const partition of partitions.values()) {
      const indexByKey = moverPhaseOrderIndexes(partition.movers)
      const lastIndex = indexByKey.size - 1
      for (const [key, index] of indexByKey) {
        rungByKey.set(key, partition.reversed ? lastIndex - index : index)
      }
    }
  }

  return rungByKey
}
