import { useEffect } from 'react'
import styled from 'styled-components'
import { useDispatch } from 'react-redux'
import useDragMapped from '../hooks/useDragMapped'
import { setBaseParams } from '../redux/controlSlice'
import XYAxisCursor from './XYAxisCursor'
import Select from '../base/Select'
import { useBaseParam, useDmxSelector, useTypedSelector } from 'renderer/redux/store'
import { isMoverFixtureType } from '../../shared/dmxFixtures'
import MidiOverlay_xy from '../base/MidiOverlay_xy'
import { makeSetBaseParamAction } from '../redux/deviceState'
import {
  MoverMirrorHelpButton,
  MoverPatternHelpButton,
  MoverPhaseOffsetHelpButton,
} from '../pages/moverHelpButtons'
import {
  moverPhaseStepDegrees,
  MOVER_PHASE_MAX_DEGREES,
} from '../../shared/moverPhaseFollow'
import { useOutputParam } from '../redux/realtimeStore'
import { useSplitMoverCount } from '../hooks/useMoverPadFixtureTargets'
import {
  MOVER_MODE_FOLLOW,
  MOVER_MODE_TANDEM,
  normalizeMoverMode,
} from '../../shared/moverPadTargets'

interface Props {
  splitIndex: number
}

type MoverModeOption = 'follow' | 'tandem'

const TANDEM_SPREAD_MAX = 0.65
const XY_CENTER_DETENT_RADIUS = 0.04
const MOVER_MODE_OPTIONS: MoverModeOption[] = ['follow', 'tandem']

function applyCenterDetent(value: number): number {
  return Math.abs(value - 0.5) <= XY_CENTER_DETENT_RADIUS ? 0.5 : value
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function formatPhaseDegrees(value: number | undefined): string {
  return `${Math.round(moverPhaseStepDegrees(value))}°`
}

function moverModeToOption(mode: number): MoverModeOption {
  return mode === MOVER_MODE_TANDEM ? 'tandem' : 'follow'
}

function moverModeFromOption(option: MoverModeOption): number {
  return option === 'tandem' ? MOVER_MODE_TANDEM : MOVER_MODE_FOLLOW
}

function moverModeOptionLabel(option: MoverModeOption) {
  return option === 'tandem' ? 'Tandem' : 'Follow'
}

export default function XYAxispad({ splitIndex }: Props) {
  const dispatch = useDispatch()
  const moverAdvancedControlEnabled = useTypedSelector(
    (state) => state.gui.moverAdvancedControlEnabled
  )
  const hasAnyMover = useDmxSelector((state) => {
    return state.universe.some((fixture) => {
      const fixtureType = state.fixtureTypesByID[fixture.type]
      return fixtureType !== undefined && isMoverFixtureType(fixtureType)
    })
  })

  const [dragContainer, onPointerDown] = useDragMapped(({ x, y }) => {
    dispatch(
      setBaseParams({
        splitIndex,
        params: {
          xAxis: applyCenterDetent(x),
          yAxis: applyCenterDetent(y),
        },
      })
    )
  })

  const xAxis = useBaseParam('xAxis', splitIndex)
  const yAxis = useBaseParam('yAxis', splitIndex)
  const moverSpread = useBaseParam('moverSpread', splitIndex)
  const moverMirrorX = useBaseParam('moverMirrorX', splitIndex)
  const moverMirrorY = useBaseParam('moverMirrorY', splitIndex)
  const moverPhaseX = useBaseParam('moverPhaseX', splitIndex)
  const moverPhaseY = useBaseParam('moverPhaseY', splitIndex)
  const moverModeRaw = useBaseParam('moverMode', splitIndex)
  const livePhaseX = useOutputParam('moverPhaseX', splitIndex)
  const livePhaseY = useOutputParam('moverPhaseY', splitIndex)
  const moverCount = useSplitMoverCount(splitIndex)

  useEffect(() => {
    if (xAxis === undefined || yAxis === undefined) {
      return
    }

    const nextParams: { [key: string]: number } = {}
    if (moverSpread === undefined) nextParams.moverSpread = 0
    if (moverMirrorX === undefined) nextParams.moverMirrorX = 0
    if (moverMirrorY === undefined) nextParams.moverMirrorY = 0
    if (moverPhaseX === undefined) nextParams.moverPhaseX = 0
    if (moverPhaseY === undefined) nextParams.moverPhaseY = 0
    if (moverModeRaw === undefined) nextParams.moverMode = MOVER_MODE_FOLLOW

    if (Object.keys(nextParams).length > 0) {
      dispatch(
        setBaseParams({
          splitIndex,
          params: nextParams,
        })
      )
    }
  }, [
    dispatch,
    moverMirrorX,
    moverMirrorY,
    moverModeRaw,
    moverPhaseX,
    moverPhaseY,
    moverSpread,
    splitIndex,
    xAxis,
    yAxis,
  ])

  if (
    xAxis === undefined ||
    yAxis === undefined ||
    moverSpread === undefined ||
    moverMirrorX === undefined ||
    moverMirrorY === undefined ||
    moverModeRaw === undefined
  ) {
    return null
  }

  const moverMode = normalizeMoverMode(moverModeRaw)
  const moverModeOption = moverModeToOption(moverMode)
  const mirrorXEnabled = moverMirrorX > 0.5
  const mirrorYEnabled = moverMirrorY > 0.5
  const evenSpreadDegrees =
    moverCount > 1 ? Math.round(MOVER_PHASE_MAX_DEGREES / moverCount) : null

  return (
    <Root>
      <MidiOverlay_xy
        splitIndex={splitIndex}
        labels={['Pan', 'Tilt']}
        style={{ width: '200px', minWidth: '200px', height: '180px', flexShrink: 0 }}
        actions={[
          makeSetBaseParamAction(splitIndex, 'xAxis'),
          makeSetBaseParamAction(splitIndex, 'yAxis'),
        ]}
      >
        <PadSurface ref={dragContainer} onPointerDown={onPointerDown}>
          <CenterMarker aria-hidden />
          <XYAxisCursor splitIndex={splitIndex} />
        </PadSurface>
      </MidiOverlay_xy>

      <MoverControls
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {moverAdvancedControlEnabled ? (
          <>
        <ControlLabelRow>
          <ControlLabel>Mover Pattern</ControlLabel>
          <MoverPatternHelpButton />
        </ControlLabelRow>
        <SelectRow>
          <Select
            label="Mover Pattern"
            val={moverModeOption}
            items={MOVER_MODE_OPTIONS}
            labelForItem={moverModeOptionLabel}
            onChange={(newMode) => {
              dispatch(
                setBaseParams({
                  splitIndex,
                  params: { moverMode: moverModeFromOption(newMode) },
                })
              )
            }}
            style={{ width: '100%' }}
          />
        </SelectRow>

        {!hasAnyMover && (
          <DisabledHint>
            Add movers to enable pan/tilt follow patterns.
          </DisabledHint>
        )}

        {moverMode === MOVER_MODE_TANDEM && (
          <>
            <ControlLabel>Tandem Distance</ControlLabel>
            <SpreadInput
              type="range"
              title="Spacing between movers in tandem mode"
              min={0}
              max={TANDEM_SPREAD_MAX}
              step={0.01}
              value={moverSpread}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onChange={(event) => {
                dispatch(
                  setBaseParams({
                    splitIndex,
                    params: {
                      moverSpread: Math.max(
                        0,
                        Math.min(TANDEM_SPREAD_MAX, Number(event.target.value) || 0)
                      ),
                    },
                  })
                )
              }}
            />
          </>
        )}

        <ControlLabelRow>
          <ControlLabel>Mirror</ControlLabel>
          <MoverMirrorHelpButton />
        </ControlLabelRow>
        <RadioGroup>
          <RadioButton
            type="button"
            $active={mirrorXEnabled}
            title="Mirror the right-hand movers left/right"
            onClick={() =>
              dispatch(
                setBaseParams({
                  splitIndex,
                  params: { moverMirrorX: mirrorXEnabled ? 0 : 1 },
                })
              )
            }
          >
            <RadioDot $active={mirrorXEnabled} aria-hidden />
            <span>L/R</span>
          </RadioButton>
          <RadioButton
            type="button"
            $active={mirrorYEnabled}
            title="Mirror the lower movers top/bottom"
            onClick={() =>
              dispatch(
                setBaseParams({
                  splitIndex,
                  params: { moverMirrorY: mirrorYEnabled ? 0 : 1 },
                })
              )
            }
          >
            <RadioDot $active={mirrorYEnabled} aria-hidden />
            <span>T/B</span>
          </RadioButton>
        </RadioGroup>

        <ControlLabelRow>
          <ControlLabel>Phase Offset Follow</ControlLabel>
          <MoverPhaseOffsetHelpButton />
        </ControlLabelRow>
        <PhaseRow>
          <PhaseLabel>Pan</PhaseLabel>
          <SpreadInput
            type="range"
            title="Pan phase offset per mover, in Movers-tab order"
            min={0}
            max={1}
            step={0.005}
            value={moverPhaseX ?? 0}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onChange={(event) => {
              dispatch(
                setBaseParams({
                  splitIndex,
                  params: {
                    moverPhaseX: clamp01(Number(event.target.value)),
                  },
                })
              )
            }}
          />
          <PhaseValue>{formatPhaseDegrees(livePhaseX)}</PhaseValue>
        </PhaseRow>
        <PhaseRow>
          <PhaseLabel>Tilt</PhaseLabel>
          <SpreadInput
            type="range"
            title="Tilt phase offset per mover, in Movers-tab order"
            min={0}
            max={1}
            step={0.005}
            value={moverPhaseY ?? 0}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onChange={(event) => {
              dispatch(
                setBaseParams({
                  splitIndex,
                  params: {
                    moverPhaseY: clamp01(Number(event.target.value)),
                  },
                })
              )
            }}
          />
          <PhaseValue>{formatPhaseDegrees(livePhaseY)}</PhaseValue>
        </PhaseRow>
        {evenSpreadDegrees !== null && (
          <PhaseHint>
            {`${evenSpreadDegrees}° spreads ${moverCount} movers evenly`}
          </PhaseHint>
        )}
          </>
        ) : null}
      </MoverControls>
    </Root>
  )
}

const Root = styled.div`
  display: flex;
  align-items: stretch;
  gap: 0.5rem;
  margin-right: 1rem;
  min-width: max-content;
`

const PadSurface = styled.div`
  position: relative;
  width: 200px;
  min-width: 200px;
  height: 180px;
  background: #000;
  overflow: hidden;
  border: 1px solid ${(props) => props.theme.colors.divider};
`

const CenterMarker = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0.9rem;
  height: 0.9rem;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  border: 1px solid #ffffff6a;
  background: radial-gradient(circle at center, #ffffff55 0 22%, #ffffff05 58%, #0000 100%);
  pointer-events: none;
  z-index: 0;

  &::before,
  &::after {
    content: '';
    position: absolute;
    background: #ffffff5a;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
  }

  &::before {
    width: 0.04rem;
    height: 1.1rem;
  }

  &::after {
    width: 1.1rem;
    height: 0.04rem;
  }
`

const MoverControls = styled.div`
  width: 14rem;
  min-width: 13rem;
  max-width: 16rem;
  height: 180px;
  overflow-y: auto;
  overflow-x: hidden;
  background: #000b;
  border: 1px solid #ffffff22;
  border-radius: 0.35rem;
  padding: 0.35rem 0.45rem;
  scrollbar-width: thin;
  scrollbar-color: #7a7a7a99 #0000;

  &::-webkit-scrollbar {
    width: 9px;
  }

  &::-webkit-scrollbar-track {
    background: #0000;
  }

  &::-webkit-scrollbar-thumb {
    background: #7a7a7a99;
    border-radius: 999px;
  }
`

const ControlLabelRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.15rem;
`

const ControlLabel = styled.div`
  font-size: 0.62rem;
  color: ${(props) => props.theme.colors.text.secondary};
  margin-bottom: 0.16rem;
  margin-top: 0.22rem;
`

const SelectRow = styled.div`
  margin-bottom: 0.14rem;
`

const SpreadInput = styled.input`
  width: 100%;
  margin: 0;
  appearance: none;
  height: 0.72rem;
  background: transparent;
  cursor: pointer;

  &::-webkit-slider-runnable-track {
    height: 0.24rem;
    border-radius: 999px;
    background: linear-gradient(to right, #454f5e, #9fb6d5);
  }

  &::-webkit-slider-thumb {
    appearance: none;
    width: 0.52rem;
    height: 0.52rem;
    margin-top: -0.14rem;
    border-radius: 999px;
    border: 1px solid #000a;
    background: #d8e6ff;
  }
`

const PhaseRow = styled.div`
  display: grid;
  grid-template-columns: 1.6rem minmax(0, 1fr) 2.1rem;
  align-items: center;
  gap: 0.22rem;
`

const PhaseLabel = styled.div`
  font-size: 0.58rem;
  color: ${(props) => props.theme.colors.text.secondary};
`

const PhaseValue = styled.div`
  font-size: 0.58rem;
  color: ${(props) => props.theme.colors.text.secondary};
  text-align: right;
  font-variant-numeric: tabular-nums;
`

const PhaseHint = styled.div`
  font-size: 0.55rem;
  color: #93a4bb;
  margin-top: 0.14rem;
`

const RadioGroup = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.22rem;
`

const RadioButton = styled.button<{ $active: boolean }>`
  border: 1px solid ${(props) => (props.$active ? '#8fb4ffbb' : '#ffffff33')};
  background: ${(props) => (props.$active ? '#1a3f7a' : '#101317')};
  color: ${(props) => (props.$active ? '#eaf2ff' : '#d9e3f2')};
  font-size: 0.64rem;
  border-radius: 0.28rem;
  cursor: pointer;
  padding: 0.18rem 0.28rem;
  display: flex;
  align-items: center;
  gap: 0.24rem;
  justify-content: flex-start;
`

const RadioDot = styled.span<{ $active: boolean }>`
  width: 0.58rem;
  height: 0.58rem;
  border-radius: 999px;
  border: 1px solid ${(props) => (props.$active ? '#dbe7ff' : '#7d8795')};
  background: ${(props) => (props.$active ? '#cfe0ff' : 'transparent')};
  box-shadow: ${(props) => (props.$active ? '0 0 0 2px rgba(16, 19, 23, 0.6) inset' : 'none')};
  flex: 0 0 auto;
`

const DisabledHint = styled.div`
  font-size: 0.58rem;
  color: #e6b7b7;
  margin-top: 0.2rem;
`
