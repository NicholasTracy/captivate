import { useMemo } from 'react'
import { isMoverFixtureType, type FixtureType } from '../../shared/dmxFixtures'
import {
  parseMoverModeFromParams,
  resolveMoverPadTargetsFromParams,
  type MoverPadPlacementEntry,
  type MoverPadTarget,
} from '../../shared/moverPadTargets'
import {
  moverPhaseOffsetCycles,
  moverPhaseStepCycles,
  moverPhaseStepIsActive,
  resolveMoverPhaseRungs,
} from '../../shared/moverPhaseFollow'
import { getOutputParamsAtPhaseOffset } from '../../shared/modulation'
import { evaluateSceneGroups } from '../../shared/sceneGroups'
import { defaultOutputParams, getParam, type Params } from '../../shared/params'
import { useActiveLightScene, useDmxSelector, useTypedSelector } from '../redux/store'
import { useOutputParams } from '../redux/realtimeStore'
import { useLfoAudioMetrics, useLfoBeats } from '../redux/realtimeSelectors'

type PreviewUniverseFixture = {
  id?: string
  type: string
  groups: string[]
  universe?: number
  ch?: number
  window?: { x?: { pos?: number }; y?: { pos?: number } }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function fixtureMatchesSplitGroups(
  fixtureGroups: string[],
  isMoverFixture: boolean,
  splitGroups: Record<string, boolean | undefined>
): boolean {
  const groupedFixture = new Set(
    fixtureGroups.map((group) => group.trim()).filter((group) => group.length > 0)
  )

  return evaluateSceneGroups(splitGroups, (group) => {
    const normalized = group.trim()
    if (normalized.length <= 0) return false
    if (normalized === 'Movers') return isMoverFixture
    return groupedFixture.has(normalized)
  })
}

type SplitMoverFixture = {
  key: string
  groupName: string
  x: number
  y: number
  sortOrder: number
  universe: number
  channel: number
  order?: number
}

/** Movers this split drives, with everything the pad preview needs to place them. */
function collectSplitMovers(
  splitGroups: Record<string, boolean | undefined>,
  moverGroupByFixtureId: Record<string, string>,
  moverPhaseOrderByFixtureId: Record<string, number>,
  universe: PreviewUniverseFixture[],
  fixtureTypesByID: Record<string, FixtureType>
): SplitMoverFixture[] {
  const movers: SplitMoverFixture[] = []

  universe.forEach((fixture, fixtureIndex) => {
    const fixtureType = fixtureTypesByID[fixture.type]
    if (fixtureType === undefined || !isMoverFixtureType(fixtureType)) {
      return
    }

    if (!fixtureMatchesSplitGroups(fixture.groups, true, splitGroups)) {
      return
    }

    const fixtureId =
      typeof fixture.id === 'string' && fixture.id.trim().length > 0
        ? fixture.id.trim()
        : `legacy-${fixtureIndex}-${fixture.type}`

    movers.push({
      key: fixtureId,
      groupName:
        moverGroupByFixtureId[fixtureId]?.trim() ||
        fixtureType.name.trim() ||
        'Fixture Group',
      x: clamp01(fixture.window?.x?.pos ?? 0.5),
      y: clamp01(fixture.window?.y?.pos ?? 0.5),
      sortOrder: fixtureIndex,
      universe: Math.max(1, Math.round(Number(fixture.universe) || 1)),
      channel: Math.max(0, Math.round(Number(fixture.ch) || 0)),
      order: moverPhaseOrderByFixtureId[fixtureId],
    })
  })

  return movers
}

function groupPlacements(
  movers: SplitMoverFixture[],
  baseAimByKey: Map<string, { x?: number; y?: number }>
): Record<string, MoverPadPlacementEntry[]> {
  const fixturesByGroup: Record<string, MoverPadPlacementEntry[]> = {}

  for (const mover of movers) {
    const aim = baseAimByKey.get(mover.key)
    const groupItems = fixturesByGroup[mover.groupName] ?? []
    groupItems.push({
      key: mover.key,
      x: mover.x,
      y: mover.y,
      sortOrder: mover.sortOrder,
      baseX: aim?.x,
      baseY: aim?.y,
    })
    fixturesByGroup[mover.groupName] = groupItems
  }

  return fixturesByGroup
}

/** Number of movers the split drives — the divisor for an even phase spread. */
export function useSplitMoverCount(splitIndex: number): number {
  const splitGroups = useActiveLightScene(
    (scene) => scene.splitScenes[splitIndex]?.groups ?? {}
  )
  const universe = useDmxSelector((state) => state.universe)
  const fixtureTypesByID = useDmxSelector((state) => state.fixtureTypesByID)

  return useMemo(() => {
    let count = 0
    for (const fixture of universe) {
      const fixtureType = fixtureTypesByID[fixture.type]
      if (fixtureType === undefined || !isMoverFixtureType(fixtureType)) continue
      if (!fixtureMatchesSplitGroups(fixture.groups, true, splitGroups)) continue
      count += 1
    }
    return count
  }, [fixtureTypesByID, splitGroups, universe])
}

export function useMoverPadFixtureTargets(
  splitIndex: number,
  params: Params
): MoverPadTarget[] | null {
  const moverAdvancedControlEnabled = useTypedSelector(
    (state) => state.gui.moverAdvancedControlEnabled
  )
  const splitGroups = useActiveLightScene(
    (scene) => scene.splitScenes[splitIndex]?.groups ?? {}
  )
  const lightScene = useActiveLightScene((scene) => scene)
  const dmx = useDmxSelector((state) => state)
  const beats = useLfoBeats()
  const audio = useLfoAudioMetrics()

  return useMemo(() => {
    if (!moverAdvancedControlEnabled) {
      return null
    }

    const moverMode = parseMoverModeFromParams(params)
    const stepX = moverPhaseStepCycles(params.moverPhaseX)
    const stepY = moverPhaseStepCycles(params.moverPhaseY)
    const phasePan = moverPhaseStepIsActive(stepX) && Number.isFinite(params.xAxis)
    const phaseTilt = moverPhaseStepIsActive(stepY) && Number.isFinite(params.yAxis)
    if (moverMode === 0 && !phasePan && !phaseTilt) {
      return null
    }

    const movers = collectSplitMovers(
      splitGroups,
      dmx.moverGroupByFixtureId,
      dmx.moverPhaseOrderByFixtureId,
      dmx.universe,
      dmx.fixtureTypesByID
    )

    const baseAimByKey = new Map<string, { x?: number; y?: number }>()
    if (phasePan || phaseTilt) {
      const orderIndexByKey = resolveMoverPhaseRungs(
        movers.map((mover) => ({ ...mover, groupKey: mover.groupName })),
        {
          mirrorLeftRight: getParam(params, 'moverMirrorX') > 0.5,
          mirrorTopBottom: getParam(params, 'moverMirrorY') > 0.5,
        }
      )
      for (const [key, orderIndex] of orderIndexByKey) {
        if (orderIndex === 0) continue
        const aim: { x?: number; y?: number } = {}
        if (phasePan) {
          aim.x = getOutputParamsAtPhaseOffset(
            beats,
            lightScene,
            splitIndex,
            ['xAxis'],
            moverPhaseOffsetCycles(orderIndex, stepX),
            audio
          ).xAxis
        }
        if (phaseTilt) {
          aim.y = getOutputParamsAtPhaseOffset(
            beats,
            lightScene,
            splitIndex,
            ['yAxis'],
            moverPhaseOffsetCycles(orderIndex, stepY),
            audio
          ).yAxis
        }
        baseAimByKey.set(key, aim)
      }
    }

    const targets = resolveMoverPadTargetsFromParams(
      groupPlacements(movers, baseAimByKey),
      params
    )
    return targets.length > 0 ? targets : null
  }, [
    audio,
    beats,
    dmx.fixtureTypesByID,
    dmx.moverGroupByFixtureId,
    dmx.moverPhaseOrderByFixtureId,
    dmx.universe,
    lightScene,
    moverAdvancedControlEnabled,
    params,
    splitGroups,
    splitIndex,
  ])
}

export function useMergedSplitAxisParams(splitIndex: number): Params {
  const baseParams = useActiveLightScene(
    (scene) => scene.splitScenes[splitIndex]?.baseParams ?? defaultOutputParams()
  )
  const outputParams = useOutputParams(splitIndex)

  return useMemo(
    () => ({
      ...baseParams,
      ...outputParams,
    }),
    [baseParams, outputParams]
  )
}
