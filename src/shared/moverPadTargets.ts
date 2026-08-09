import { clampNormalized } from '../math/util'
import { getParam, Params } from './params'

export const MOVER_TANDEM_MAX_SPREAD = 0.65

export type MoverPadPlacementEntry = {
  key: string
  x: number
  y: number
  sortOrder?: number
  /**
   * Per-fixture aim, replacing the shared pad aim for this fixture only (mover
   * phase-offset follow). Tandem spread and mirroring still apply on top of it.
   */
  baseX?: number
  baseY?: number
}

export type MoverPadTarget = {
  key: string
  x: number
  y: number
  mirrored: boolean
}

export function mirrorAroundCenter(value: number, center: number): number {
  return center * 2 - value
}

/** Every mover in the group shares the pad aim. */
export const MOVER_MODE_FOLLOW = 0
/** Movers fan out around the pad aim by `moverSpread`. */
export const MOVER_MODE_TANDEM = 1
/**
 * Legacy exclusive "Mirror" mode. Mirroring is now a modifier that layers on any
 * mode, so this folds to Follow and the mirror flags carry the behavior.
 */
export const MOVER_MODE_LEGACY_MIRROR = 2

export function parseMoverModeFromParams(params: Params): number {
  return normalizeMoverMode(Number(params.moverMode ?? 0))
}

export function normalizeMoverMode(value: number): number {
  if (!Number.isFinite(value)) return MOVER_MODE_FOLLOW
  const rounded = Math.round(value)
  if (rounded === MOVER_MODE_TANDEM) return MOVER_MODE_TANDEM
  // Legacy mirror (and anything out of range) is a plain shared aim now.
  return MOVER_MODE_FOLLOW
}

/**
 * `moverMode` used to be exclusive: mirror flags only did anything in mode 2, tandem
 * spread only in mode 1. Mirroring is a modifier now, so a split left holding stale
 * mirror flags from an earlier mode selection would start mirroring by itself.
 *
 * Rewrites one split's params to the (mode, flags) pair that reproduces exactly what
 * the old engine emitted. **Version-gated at the load boundary** — running it on a
 * project already saved in the new shape would wipe a deliberate Follow + Mirror.
 */
export function migrateExclusiveMoverModeParams(baseParams: Params): boolean {
  if (baseParams.moverMode === undefined) {
    return false
  }

  if (Math.round(Number(baseParams.moverMode)) === MOVER_MODE_LEGACY_MIRROR) {
    // Mirroring was live; it keeps working as a modifier on a plain shared aim.
    baseParams.moverMode = MOVER_MODE_FOLLOW
    return true
  }

  // Follow / Tandem never mirrored, so any flags parked here were inert.
  let changed = false
  if (baseParams.moverMirrorX) {
    baseParams.moverMirrorX = 0
    changed = true
  }
  if (baseParams.moverMirrorY) {
    baseParams.moverMirrorY = 0
    changed = true
  }
  return changed
}

/** Applies {@link migrateExclusiveMoverModeParams} to every split of every scene. */
export function migrateExclusiveMoverModes(light: {
  ids: string[]
  byId: { [id: string]: { splitScenes: Array<{ baseParams: Params }> } | undefined }
}): boolean {
  let changed = false
  for (const id of light.ids) {
    const scene = light.byId[id]
    if (scene === undefined || !Array.isArray(scene.splitScenes)) continue
    for (const splitScene of scene.splitScenes) {
      if (splitScene?.baseParams === undefined) continue
      if (migrateExclusiveMoverModeParams(splitScene.baseParams)) {
        changed = true
      }
    }
  }
  return changed
}

export type MoverGroupPlacement = {
  key: string
  x: number
  y: number
  sortOrder?: number
}

/** Which half of its mover group a fixture sits in, per mirror axis. */
export type MoverGroupSide = {
  isRight: boolean
  isBottom: boolean
}

/**
 * Splits one mover group into mirror halves by placement. Shared by the pad math and
 * by phase-offset follow, so a mirrored rig phases and aims off the same partition.
 * Groups with no spread on an axis fall back to splitting the list in half.
 */
export function resolveMoverGroupSides(
  fixtures: ReadonlyArray<MoverGroupPlacement>
): Map<string, MoverGroupSide> {
  const orderedFixtures = sortMoverGroupPlacements(fixtures)

  let minX = 1
  let maxX = 0
  let minY = 1
  let maxY = 0

  for (const entry of orderedFixtures) {
    minX = Math.min(minX, entry.x)
    maxX = Math.max(maxX, entry.x)
    minY = Math.min(minY, entry.y)
    maxY = Math.max(maxY, entry.y)
  }

  const hasHorizontalSpread = maxX - minX > 0.0001
  const hasVerticalSpread = maxY - minY > 0.0001
  const sideEpsilon = 0.0001
  const centerX = (minX + maxX) * 0.5
  const centerY = (minY + maxY) * 0.5
  const halfIndex = Math.ceil(orderedFixtures.length / 2)

  const sideByKey = new Map<string, MoverGroupSide>()
  orderedFixtures.forEach((entry, entryIndex) => {
    sideByKey.set(entry.key, {
      isRight: hasHorizontalSpread
        ? entry.x > centerX + sideEpsilon
        : entryIndex >= halfIndex,
      // `y` runs bottom-up here, so the lower half is below center.
      isBottom: hasVerticalSpread
        ? entry.y < centerY - sideEpsilon
        : entryIndex >= halfIndex,
    })
  })
  return sideByKey
}

function sortMoverGroupPlacements<T extends MoverGroupPlacement>(
  fixtures: ReadonlyArray<T>
): T[] {
  return [...fixtures].sort((left, right) => {
    if (left.x !== right.x) return left.x - right.x
    if (left.y !== right.y) return left.y - right.y
    return (left.sortOrder ?? 0) - (right.sortOrder ?? 0)
  })
}

export function resolveMoverPadTargetsForGroup(
  fixtures: ReadonlyArray<MoverPadPlacementEntry>,
  options: {
    baseX: number
    baseY: number
    moverMode: number
    spread: number
    mirrorLeftRight: boolean
    mirrorTopBottom: boolean
    hasPanTarget?: boolean
    hasTiltTarget?: boolean
  }
): MoverPadTarget[] {
  if (fixtures.length === 0) {
    return []
  }

  const hasPanTarget = options.hasPanTarget !== false
  const hasTiltTarget = options.hasTiltTarget !== false
  const baseX = clampNormalized(options.baseX)
  const baseY = clampNormalized(options.baseY)
  const moverMode = normalizeMoverMode(options.moverMode)
  const spread = Math.min(
    MOVER_TANDEM_MAX_SPREAD,
    clampNormalized(options.spread)
  )
  const mirrorLeftRight = options.mirrorLeftRight
  const mirrorTopBottom = options.mirrorTopBottom

  const orderedFixtures = sortMoverGroupPlacements(fixtures)
  const sideByKey = resolveMoverGroupSides(orderedFixtures)

  let minX = 1
  let maxX = 0

  for (const entry of orderedFixtures) {
    minX = Math.min(minX, entry.x)
    maxX = Math.max(maxX, entry.x)
  }

  const spanX = maxX - minX
  const hasHorizontalSpread = spanX > 0.0001

  return orderedFixtures.map((entry, entryIndex) => {
    const relX = hasHorizontalSpread
      ? clampNormalized((entry.x - minX) / spanX)
      : orderedFixtures.length <= 1
        ? 0.5
        : entryIndex / (orderedFixtures.length - 1)

    const side = sideByKey.get(entry.key)
    const isRight = side?.isRight === true
    const isBottom = side?.isBottom === true

    const entryBaseX =
      entry.baseX !== undefined && Number.isFinite(entry.baseX)
        ? clampNormalized(entry.baseX)
        : baseX
    const entryBaseY =
      entry.baseY !== undefined && Number.isFinite(entry.baseY)
        ? clampNormalized(entry.baseY)
        : baseY

    let fixtureX = hasPanTarget ? entryBaseX : 0.5
    let fixtureY = hasTiltTarget ? entryBaseY : 0.5
    let mirrored = false

    if (moverMode === MOVER_MODE_TANDEM && hasPanTarget) {
      fixtureX = entryBaseX + (relX - 0.5) * spread
    }

    // Mirroring is a modifier, not a mode: it folds whatever aim the fixture already
    // has (follow, phase-offset, or tandem spread) around the pad center.
    const applyGroupMirrorX = hasPanTarget && mirrorLeftRight
    const applyGroupMirrorY = hasTiltTarget && mirrorTopBottom

    if (applyGroupMirrorX && isRight) {
      fixtureX = mirrorAroundCenter(fixtureX, 0.5)
      mirrored = true
    }
    if (applyGroupMirrorY && isBottom) {
      fixtureY = mirrorAroundCenter(fixtureY, 0.5)
      mirrored = true
    }

    return {
      key: entry.key,
      x: clampNormalized(hasPanTarget ? fixtureX : entryBaseX),
      y: clampNormalized(hasTiltTarget ? fixtureY : entryBaseY),
      mirrored,
    }
  })
}

export function resolveMoverPadTargetsFromParams(
  fixturesByGroup: Readonly<Record<string, ReadonlyArray<MoverPadPlacementEntry>>>,
  params: Params
): MoverPadTarget[] {
  const baseX = clampNormalized(Number(params.xAxis ?? 0.5))
  const baseY = clampNormalized(Number(params.yAxis ?? 0.5))
  const moverMode = parseMoverModeFromParams(params)
  const spread = clampNormalized(getParam(params, 'moverSpread'))
  const mirrorLeftRight = getParam(params, 'moverMirrorX') > 0.5
  const mirrorTopBottom = getParam(params, 'moverMirrorY') > 0.5

  const targets: MoverPadTarget[] = []
  for (const fixtures of Object.values(fixturesByGroup)) {
    targets.push(
      ...resolveMoverPadTargetsForGroup(fixtures, {
        baseX,
        baseY,
        moverMode,
        spread,
        mirrorLeftRight,
        mirrorTopBottom,
      })
    )
  }
  return targets
}
