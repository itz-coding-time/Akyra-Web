/**
 * Akyra Audio Engine
 * Procedural synthesis using Web Audio API.
 * No audio files required. Everything is generated in real time.
 *
 * Architecture:
 * - Master gain node controls overall volume
 * - Drone layer: sustained low-frequency oscillators (the "ship hum")
 * - Pulse layer: rhythmic low-frequency beats (heartbeat of the mission)
 * - Harmonic layer: higher overtones (squad presence, tension)
 * - Impact: one-shot transient for launch
 */

type AudioState = "idle" | "ambient" | "swell" | "launch" | "silence"

class AkyraAudioEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private droneOscillators: OscillatorNode[] = []
  private droneGains: GainNode[] = []
  private pulseInterval: ReturnType<typeof setInterval> | null = null
  private harmonicOscillators: OscillatorNode[] = []
  private harmonicGains: GainNode[] = []
  private state: AudioState = "idle"
  private squadCount: number = 0
  private swellTimeout: ReturnType<typeof setTimeout> | null = null

  // ── Initialization ───────────────────────────────────────────────────────

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime)
      this.masterGain.connect(this.ctx.destination)
    }
    return this.ctx
  }

  /**
   * Unlock the AudioContext after user interaction.
   * Call this once on first user gesture.
   */
  unlock(): void {
    try {
      const ctx = this.ensureContext()
      if (ctx.state === "suspended") {
        ctx.resume()
      }
    } catch (e) {
      console.warn("[Audio] Could not unlock AudioContext:", e)
    }
  }

  // ── Utility ──────────────────────────────────────────────────────────────

  private fadeGain(
    gain: GainNode,
    targetValue: number,
    durationSeconds: number
  ): void {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(gain.gain.value, now)
    gain.gain.linearRampToValueAtTime(targetValue, now + durationSeconds)
  }

  private createOscillator(
    frequency: number,
    type: OscillatorType,
    gainValue: number
  ): { osc: OscillatorNode; gain: GainNode } {
    const ctx = this.ensureContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(frequency, ctx.currentTime)
    gain.gain.setValueAtTime(0, ctx.currentTime)

    osc.connect(gain)
    gain.connect(this.masterGain!)
    osc.start()

    // Fade in
    this.fadeGain(gain, gainValue, 2)

    return { osc, gain }
  }

  private stopOscillators(
    oscs: OscillatorNode[],
    gains: GainNode[],
    fadeOut: number = 1.5
  ): void {
    const ctx = this.ctx
    if (!ctx) return

    gains.forEach(g => {
      this.fadeGain(g, 0, fadeOut)
    })

    setTimeout(() => {
      oscs.forEach(o => {
        try { o.stop() } catch {}
      })
    }, (fadeOut + 0.1) * 1000)
  }

  // ── Drone Layer (the ship hum) ────────────────────────────────────────────
  // Three detuned low oscillators creating a dark, resonant drone
  // Root: D1 (36.7 Hz), Fifth: A1 (55 Hz), Octave: D2 (73.4 Hz)

  private startDrone(): void {
    if (this.droneOscillators.length > 0) return

    const frequencies = [36.7, 37.1, 55.0, 73.4, 73.9]
    const gains =      [0.15,  0.08, 0.10, 0.08, 0.05]
    const types: OscillatorType[] = ["sine", "sine", "sine", "sine", "sine"]

    frequencies.forEach((freq, i) => {
      const { osc, gain } = this.createOscillator(freq, types[i], gains[i])
      this.droneOscillators.push(osc)
      this.droneGains.push(gain)
    })
  }

  private stopDrone(fadeOut: number = 2): void {
    this.stopOscillators(this.droneOscillators, this.droneGains, fadeOut)
    this.droneOscillators = []
    this.droneGains = []
  }

  // ── Pulse Layer (the heartbeat) ───────────────────────────────────────────
  // A low thud every 2 seconds. Like a distant engine. Or a heartbeat.

  private startPulse(bpm: number = 30): void {
    if (this.pulseInterval) return
    this.ensureContext()

    const intervalMs = (60 / bpm) * 1000

    const createPulse = () => {
      if (!this.ctx || !this.masterGain) return
      const now = this.ctx.currentTime

      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const filter = this.ctx.createBiquadFilter()

      filter.type = "lowpass"
      filter.frequency.setValueAtTime(120, now)

      osc.type = "sine"
      osc.frequency.setValueAtTime(55, now)
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.3)

      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.25, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterGain!)

      osc.start(now)
      osc.stop(now + 0.5)
    }

    createPulse()
    this.pulseInterval = setInterval(createPulse, intervalMs)
  }

  private stopPulse(): void {
    if (this.pulseInterval) {
      clearInterval(this.pulseInterval)
      this.pulseInterval = null
    }
  }

  private setPulseBpm(bpm: number): void {
    this.stopPulse()
    this.startPulse(bpm)
  }

  // ── Harmonic Layer (squad presence) ──────────────────────────────────────
  // Higher overtones that layer in as squadmates arrive.
  // Each squad member adds a harmonic partial above the drone.
  // Creates a subtle chord that builds as the team assembles.

  private updateHarmonics(squadCount: number): void {
    // Clear existing harmonics
    this.stopOscillators(this.harmonicOscillators, this.harmonicGains, 1.5)
    this.harmonicOscillators = []
    this.harmonicGains = []

    if (squadCount === 0) return

    // Harmonic series above D2 (73.4 Hz)
    // Each squad member adds one harmonic
    const harmonics = [
      { freq: 146.8, gain: 0.04 },  // D3 — 1 person
      { freq: 220.0, gain: 0.03 },  // A3 — 2 people
      { freq: 293.7, gain: 0.025 }, // D4 — 3 people
      { freq: 369.9, gain: 0.02 },  // F#4 — 4 people (adds tension)
    ]

    const activeLayers = harmonics.slice(0, Math.min(squadCount, harmonics.length))

    activeLayers.forEach(({ freq, gain }) => {
      const { osc, gain: gainNode } = this.createOscillator(freq, "sine", gain)
      // Add slight vibrato
      if (this.ctx) {
        const lfo = this.ctx.createOscillator()
        const lfoGain = this.ctx.createGain()
        lfo.frequency.setValueAtTime(0.3, this.ctx.currentTime)
        lfoGain.gain.setValueAtTime(0.5, this.ctx.currentTime)
        lfo.connect(lfoGain)
        lfoGain.connect(osc.frequency)
        lfo.start()
        setTimeout(() => { try { lfo.stop() } catch {} }, 60000)
      }
      this.harmonicOscillators.push(osc)
      this.harmonicGains.push(gainNode)
    })
  }

  // ── Swell (T-60 seconds) ─────────────────────────────────────────────────
  // Rising tension. The harmonics shift upward. Pulse quickens.
  // A slow filter sweep opens up the drone, revealing more brightness.

  private triggerSwell(): void {
    if (!this.ctx || !this.masterGain) return
    const ctx = this.ctx
    const now = ctx.currentTime

    // Quicken the pulse
    this.setPulseBpm(60)

    // Lift master gain slightly
    this.masterGain.gain.cancelScheduledValues(now)
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now)
    this.masterGain.gain.linearRampToValueAtTime(1.2, now + 8)

    // Add a rising tone — a "signal" tone that sweeps up
    const signalOsc = ctx.createOscillator()
    const signalGain = ctx.createGain()

    signalOsc.type = "sine"
    signalOsc.frequency.setValueAtTime(146.8, now)
    signalOsc.frequency.exponentialRampToValueAtTime(293.7, now + 55)

    signalGain.gain.setValueAtTime(0, now)
    signalGain.gain.linearRampToValueAtTime(0.06, now + 4)
    signalGain.gain.linearRampToValueAtTime(0.12, now + 50)

    signalOsc.connect(signalGain)
    signalGain.connect(this.masterGain!)
    signalOsc.start(now)

    // Stop signal osc after 60 seconds (will be replaced by launch)
    setTimeout(() => {
      try {
        signalGain.gain.setValueAtTime(signalGain.gain.value, ctx.currentTime)
        signalGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1)
        setTimeout(() => { try { signalOsc.stop() } catch {} }, 1100)
      } catch {}
    }, 60000)
  }

  // ── Launch (READY UP / drop) ──────────────────────────────────────────────
  // A sharp impact followed by a resonant boom, then silence.
  // The Hellpod is away.

  private triggerLaunch(onComplete?: () => void): void {
    if (!this.ctx || !this.masterGain) return
    const ctx = this.ctx
    const now = ctx.currentTime

    // Stop the pulse
    this.stopPulse()

    // Impact — short sharp transient
    const impactOsc = ctx.createOscillator()
    const impactGain = ctx.createGain()
    const impactFilter = ctx.createBiquadFilter()

    impactFilter.type = "bandpass"
    impactFilter.frequency.setValueAtTime(200, now)
    impactFilter.Q.setValueAtTime(0.5, now)

    impactOsc.type = "sawtooth"
    impactOsc.frequency.setValueAtTime(80, now)
    impactOsc.frequency.exponentialRampToValueAtTime(20, now + 0.5)

    impactGain.gain.setValueAtTime(0, now)
    impactGain.gain.linearRampToValueAtTime(0.8, now + 0.005)
    impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6)

    impactOsc.connect(impactFilter)
    impactFilter.connect(impactGain)
    impactGain.connect(this.masterGain!)
    impactOsc.start(now)
    impactOsc.stop(now + 0.7)

    // Resonant boom — the Hellpod launching
    const boomOsc = ctx.createOscillator()
    const boomGain = ctx.createGain()

    boomOsc.type = "sine"
    boomOsc.frequency.setValueAtTime(55, now + 0.05)
    boomOsc.frequency.exponentialRampToValueAtTime(27.5, now + 1.5)

    boomGain.gain.setValueAtTime(0, now + 0.05)
    boomGain.gain.linearRampToValueAtTime(0.6, now + 0.1)
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5)

    boomOsc.connect(boomGain)
    boomGain.connect(this.masterGain!)
    boomOsc.start(now + 0.05)
    boomOsc.stop(now + 2.6)

    // High shimmer — the Hellpod breaking atmosphere
    const shimmerOsc = ctx.createOscillator()
    const shimmerGain = ctx.createGain()

    shimmerOsc.type = "sine"
    shimmerOsc.frequency.setValueAtTime(2200, now + 0.08)
    shimmerOsc.frequency.exponentialRampToValueAtTime(8800, now + 0.4)

    shimmerGain.gain.setValueAtTime(0, now + 0.08)
    shimmerGain.gain.linearRampToValueAtTime(0.12, now + 0.1)
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)

    shimmerOsc.connect(shimmerGain)
    shimmerGain.connect(this.masterGain!)
    shimmerOsc.start(now + 0.08)
    shimmerOsc.stop(now + 0.6)

    // Fade out everything else
    this.masterGain.gain.cancelScheduledValues(now + 0.1)
    this.masterGain.gain.setValueAtTime(1, now + 0.1)
    this.masterGain.gain.linearRampToValueAtTime(0, now + 2.8)

    // Stop drone after fade
    setTimeout(() => {
      this.stopDrone(0.1)
      this.stopOscillators(this.harmonicOscillators, this.harmonicGains, 0.1)
      this.harmonicOscillators = []
      this.harmonicGains = []
    }, 2000)

    // Signal complete — Drop Sequence takes over
    setTimeout(() => {
      onComplete?.()
    }, 1200)
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Start the ambient lobby audio.
   * Call after user interaction unlocks the AudioContext.
   */
  startAmbient(initialSquadCount: number = 0): void {
    if (this.state !== "idle") return
    this.state = "ambient"

    this.ensureContext()
    if (!this.masterGain) return

    // Fade in master
    this.fadeGain(this.masterGain, 1, 3)

    this.startDrone()
    this.startPulse(30)
    this.updateHarmonics(initialSquadCount)
    this.squadCount = initialSquadCount
  }

  /**
   * Update squad count — adds/removes harmonic layers.
   */
  updateSquad(count: number): void {
    if (this.state !== "ambient") return
    if (count === this.squadCount) return
    this.squadCount = count
    this.updateHarmonics(count)
  }

  /**
   * Trigger the swell — call at T-60 seconds.
   */
  triggerSwell60(): void {
    if (this.state !== "ambient") return
    this.state = "swell"
    this.triggerSwell()
  }

  /**
   * Trigger the launch sequence — call on READY UP.
   * onComplete fires ~1.2 seconds after launch (when Drop Sequence should begin).
   */
  launch(onComplete?: () => void): void {
    if (this.state === "launch" || this.state === "silence") return
    this.state = "launch"
    this.triggerLaunch(onComplete)
  }

  /**
   * Fade out everything gracefully — call when leaving the Lobby without dropping.
   */
  fadeOut(): void {
    if (!this.ctx || !this.masterGain) return
    this.stopPulse()
    this.fadeGain(this.masterGain, 0, 1.5)
    setTimeout(() => {
      this.stopDrone(0.1)
      this.stopOscillators(this.harmonicOscillators, this.harmonicGains, 0.1)
      this.harmonicOscillators = []
      this.harmonicGains = []
      this.state = "idle"
    }, 1600)
  }

  /**
   * Full cleanup — call on component unmount.
   */
  destroy(): void {
    this.stopPulse()
    if (this.swellTimeout) clearTimeout(this.swellTimeout)
    try {
      this.ctx?.close()
    } catch {}
    this.ctx = null
    this.masterGain = null
    this.droneOscillators = []
    this.droneGains = []
    this.harmonicOscillators = []
    this.harmonicGains = []
    this.state = "idle"
  }

  getState(): AudioState {
    return this.state
  }
}

// Singleton — one audio engine for the app lifetime
export const audioEngine = new AkyraAudioEngine()
