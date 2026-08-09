declare module 'midi' {
  export type Message = [status: number, data1: number, data2: number]

  export class Input {
    getPortCount: () => number
    getPortName: (portIndex: number) => string
    on: (
      channel: 'message',
      callback: (deltaTime: number, message: Message) => void
    ) => void
    openPort: (portIndex: number) => void
    closePort: () => void
    isPortOpen: () => boolean
    /**
     * Sysex, timing, and active sensing are ignored by default. Pass false to
     * receive that type — e.g. ignoreTypes(true, false, true) for MIDI clock.
     */
    ignoreTypes: (
      sysex: boolean,
      timing: boolean,
      activeSensing: boolean
    ) => void
    constructor()
  }
}
