import SectionHelpButton, {
  FieldHelpButton,
  HelpIntro,
  HelpList,
  HelpTitle,
} from '../base/SectionHelpPopover'

export function MoverGroupsHelpButton() {
  return (
    <SectionHelpButton ariaLabel="How movers work">
      <HelpTitle>How movers work</HelpTitle>
      <HelpIntro>
        In basic mode, the pan/tilt pad aims each fixture directly — the center of
        the pad is each mover&apos;s home (up for upright rigs, down for hung rigs).
        Turn on Advanced for floor bounds, calibration, groups, and follow override.
      </HelpIntro>
      <HelpList>
        <li>
          <strong>Advanced</strong> unlocks renaming groups, calibration, corner
          bounds, a live grid, and the dance-floor map.
        </li>
        <li>
          <strong>Upright</strong> / <strong>Hung</strong> should match how the fixture
          is mounted on the truss.
        </li>
      </HelpList>
    </SectionHelpButton>
  )
}

export function FollowOverrideHelpButton() {
  return (
    <SectionHelpButton ariaLabel="How follow override works">
      <HelpTitle>How follow override works</HelpTitle>
      <HelpIntro>
        Makes selected mover groups aim at one spot on the floor instead of following
        scene pan/tilt — handy when you want every head looking the same way during
        a live tweak.
      </HelpIntro>
      <HelpList>
        <li>
          X/Y pick a position on the floor map (0 = one side, 1 = the other). You can
          map the toggle and knobs with MIDI learn from the status bar.
        </li>
        <li>
          <strong>All Groups</strong> applies everywhere; <strong>Selected</strong>{' '}
          only affects checked groups.
        </li>
      </HelpList>
    </SectionHelpButton>
  )
}

export function LivePanTiltGridHelpButton() {
  return (
    <FieldHelpButton ariaLabel="How the live pan/tilt grid works">
      Shows where each mover is pointing right now. The dot is pan/tilt on a 0–1
      scale. Click a card to open calibration for that fixture.
    </FieldHelpButton>
  )
}

export function DanceFloorMapHelpButton() {
  return (
    <SectionHelpButton ariaLabel="How the dance floor map works">
      <HelpTitle>How the dance floor map works</HelpTitle>
      <HelpIntro>
        A top-down view of the stage: small dot = fixture position, large dot =
        where the beam hits the floor (from calibration and bounds).
      </HelpIntro>
      <HelpList>
        <li>
          Back of stage is at the top; audience is at the bottom (same as the fixture
          placement map).
        </li>
        <li>
          Corner bounds make floor spots accurate. Without them, placement position is
          used as a rough guess (fainter lines).
        </li>
        <li>Brighter lines mean a more confident floor estimate.</li>
      </HelpList>
    </SectionHelpButton>
  )
}

export function MoverCalibrationDialogHelpButton() {
  return (
    <FieldHelpButton ariaLabel="How mover calibration works">
      Set pan/tilt channel values and how far the head can physically move. Corner
      bounds tie the scene pad to spots on the floor. Click a field to send that
      value to the selected fixture while you aim it.
    </FieldHelpButton>
  )
}

export function MountOrientationHelpButton() {
  return (
    <FieldHelpButton ariaLabel="How mount orientation works">
      Pick upright or hung to match the rig. Hung fixtures use different tilt labels
      — aim at the ceiling or floor references while you calibrate.
    </FieldHelpButton>
  )
}

export function PanCalibrationHelpButton() {
  return (
    <FieldHelpButton ariaLabel="How pan calibration works">
      Min/Max limit how far pan can travel. Front/Back are aim points on stage. Home
      is where the head rests. Range is total degrees of movement. Reverse swaps
      which way pan increases.
    </FieldHelpButton>
  )
}

export function TiltCalibrationHelpButton() {
  return (
    <FieldHelpButton ariaLabel="How tilt calibration works">
      Same idea as pan, with forward and up/down references. Point the fixture at
      each reference while you enter values.
    </FieldHelpButton>
  )
}

export function BoundCornersHelpButton() {
  return (
    <FieldHelpButton ariaLabel="How bound corners work">
      Per fixture: pan/tilt at each corner of the floor area. When floor bounds are
      locked, the scene pad moves within this rectangle.
    </FieldHelpButton>
  )
}

export function MoverFloorBoundsHelpButton() {
  return (
    <FieldHelpButton ariaLabel="Floor bounds vs free aim">
      Locked: the pad aims within your calibrated floor area (set corners on the
      Movers page). Free aim: the pad maps straight to the fixture&apos;s physical
      limits.
    </FieldHelpButton>
  )
}

export function MoverPatternHelpButton() {
  return (
    <FieldHelpButton ariaLabel="How mover patterns work">
      The base aim every mover starts from. Follow: all movers aim at the same pad
      point. Tandem: they fan out along the aim line by Tandem Distance. Mirror and
      Phase Offset then layer on top of whichever you pick.
    </FieldHelpButton>
  )
}

export function MoverMirrorHelpButton() {
  return (
    <FieldHelpButton ariaLabel="How mirroring works">
      Folds the right-hand (L/R) or lower (T/B) movers around the pad center, so
      symmetric pairs turn towards each other. Stacks on Follow, Tandem, and Phase
      Offset. It also splits the phase wave: a mirrored line of 6 runs its own
      sequence down each side of 3, reflected, instead of one wave across all six.
    </FieldHelpButton>
  )
}

export function MoverPhaseOrderHelpButton() {
  return (
    <SectionHelpButton ariaLabel="How mover order works">
      <HelpTitle>Mover order</HelpTitle>
      <HelpIntro>
        The sequence phase-offset follow walks when it staggers pan/tilt across the
        rig. Leave every Order blank and movers follow DMX address.
      </HelpIntro>
      <HelpList>
        <li>
          Type a number to pin a mover&apos;s place. Lower goes first; anything left
          blank follows the numbered ones, still in DMX-address order.
        </li>
        <li>
          <strong>Number Order</strong> writes 1…N using the current sequence so you
          can swap a couple of movers instead of typing them all.
        </li>
        <li>
          <strong>#</strong> is the mover&apos;s place across the whole rig. Phase walks
          this same sequence but restarts inside each mover group — and inside each
          mirrored half when Mirror is on — so a split does not always start at #1.
          Order is shared by every split; the phase sliders live on the scene&apos;s
          pan/tilt pad.
        </li>
      </HelpList>
    </SectionHelpButton>
  )
}

export function MoverPhaseOffsetHelpButton() {
  return (
    <FieldHelpButton ariaLabel="How phase offset follow works">
      Delays each mover&apos;s pan/tilt modulation by a slice of the LFO cycle, so the
      move rolls across the rig instead of firing in unison. The sequence restarts in
      each mover group, and in each mirrored half when Mirror is on, so the first mover
      of each keeps the pad aim. Set the sequence per fixture in the Movers tab (blank
      follows DMX address). 0° is unison, 360° wraps back to unison. Pan and tilt are
      independent, and both sliders can be driven by an LFO.
    </FieldHelpButton>
  )
}
