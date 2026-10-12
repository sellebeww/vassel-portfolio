/** Chill jazz, played live: a lo-fi quartet (electric piano, walking bass, brushed drums, a quiet melody over
 * vinyl crackle) generated with Web Audio. No audio files are downloaded, so nothing needs a licence and the
 * page stays light. Nothing starts until the visitor asks, which respects autoplay rules and data budgets.
 *
 * Structure: an 8-bar loop in C (Dm9 · G13 · Cmaj9 · Am9, two bars each) at 72 BPM with a lazy swing. The
 * piano and bass follow the chords; the drums and melody add small random variations, so each pass differs. */
const FADE = .6, BPM = 72, BEAT = 60 / BPM, SWING = .6, LOOKAHEAD = .45, TICK_MS = 90;
const midi = (note: number) => 440 * Math.pow(2, (note - 69) / 12);

type Chord = { voicing: number[]; bass: number[] };
// Each chord: a rootless voicing (the bass supplies the root) and its bass notes for a four-beat walk.
const CHORDS: Chord[] = [
  { voicing: [53, 57, 60, 64], bass: [38, 45, 41, 43] },   // Dm9  (F A C E) walking D A F G→
  { voicing: [53, 59, 62, 64], bass: [43, 50, 47, 48] },   // G13  (F B D E) walking G D B C→
  { voicing: [52, 55, 59, 62], bass: [48, 55, 52, 50] },   // Cmaj9 (E G B D) walking C G E D→
  { voicing: [55, 59, 60, 64], bass: [45, 52, 48, 46] },   // Am9  (G B C E) walking A E C Bb→
];
// C major pentatonic across two octaves: it sits over all four chords, so any random pick sounds intended.
const MELODY = [72, 74, 76, 79, 81, 84, 79, 76];

export class Ambience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer = 0;
  private step = 0;
  private nextTime = 0;
  private enabled = false;
  private readonly onVisibility = () => {
    if (!this.ctx) return;
    if (document.hidden) void this.ctx.suspend(); else if (this.enabled) void this.ctx.resume();
  };

  get supported() { return typeof window !== "undefined" && "AudioContext" in window; }
  get active() { return this.enabled; }

  private build() {
    const ctx = new AudioContext(), master = ctx.createGain(), bus = ctx.createGain();
    master.gain.value = 0;
    // Warmth: roll the top off like tape, then a gentle compressor so the loudest note never jumps out.
    const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 4200; tone.Q.value = .4;
    const glue = ctx.createDynamicsCompressor(); glue.threshold.value = -20; glue.ratio.value = 3; glue.attack.value = .02; glue.release.value = .25;
    // Room: one convolution reverb built from decaying noise, mixed in underneath.
    const length = Math.floor(ctx.sampleRate * 1.8), impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.4);
    }
    const reverb = ctx.createConvolver(); reverb.buffer = impulse;
    const wet = ctx.createGain(); wet.gain.value = .32;
    bus.connect(tone); tone.connect(glue); bus.connect(reverb); reverb.connect(wet); wet.connect(tone);
    glue.connect(master); master.connect(ctx.destination);

    // One second of white noise serves the hats, brushes and crackle.
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), noiseData = noise.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;
    // Vinyl: sparse pops (not a hiss), looped quietly under everything.
    const vinyl = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), pops = vinyl.getChannelData(0);
    for (let i = 0; i < pops.length; i++) pops[i] = Math.random() < .0005 ? (Math.random() * 2 - 1) * (.25 + Math.random() * .75) : 0;
    const crackle = ctx.createBufferSource(); crackle.buffer = vinyl; crackle.loop = true;
    const crackleFilter = ctx.createBiquadFilter(); crackleFilter.type = "highpass"; crackleFilter.frequency.value = 1400;
    const crackleGain = ctx.createGain(); crackleGain.gain.value = .05;
    crackle.connect(crackleFilter).connect(crackleGain).connect(master); crackle.start();

    this.ctx = ctx; this.master = master; this.bus = bus; this.noise = noise;
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  /** Electric piano: two-operator FM. The modulator's depth decays fast, so each note starts with a bell-like
   * tine and settles to a soft sine, which is what a Rhodes does. */
  private piano(frequency: number, when: number, length: number, level: number) {
    const ctx = this.ctx!, carrier = ctx.createOscillator(), modulator = ctx.createOscillator();
    const depth = ctx.createGain(), amp = ctx.createGain();
    carrier.frequency.value = frequency; modulator.frequency.value = frequency;
    depth.gain.setValueAtTime(frequency * 2.2, when); depth.gain.exponentialRampToValueAtTime(frequency * .12, when + .5);
    amp.gain.setValueAtTime(0, when); amp.gain.linearRampToValueAtTime(level, when + .008);
    amp.gain.exponentialRampToValueAtTime(.0001, when + length);
    modulator.connect(depth).connect(carrier.frequency); carrier.connect(amp).connect(this.bus!);
    carrier.start(when); modulator.start(when); carrier.stop(when + length + .05); modulator.stop(when + length + .05);
  }

  private bass(note: number, when: number, level: number) {
    const ctx = this.ctx!, osc = ctx.createOscillator(), amp = ctx.createGain(), filter = ctx.createBiquadFilter();
    osc.type = "triangle"; osc.frequency.value = midi(note);
    filter.type = "lowpass"; filter.frequency.value = 420;
    amp.gain.setValueAtTime(0, when); amp.gain.linearRampToValueAtTime(level, when + .015);
    amp.gain.exponentialRampToValueAtTime(.0001, when + BEAT * .9);
    osc.connect(filter).connect(amp).connect(this.bus!); osc.start(when); osc.stop(when + BEAT);
  }

  /** Brushed kit: a soft sine thump, a papery snare and a quiet hat, all from the one noise buffer. */
  private drum(kind: "kick" | "snare" | "hat", when: number, level: number) {
    const ctx = this.ctx!, amp = ctx.createGain();
    if (kind === "kick") {
      const osc = ctx.createOscillator(); osc.frequency.setValueAtTime(110, when); osc.frequency.exponentialRampToValueAtTime(48, when + .12);
      amp.gain.setValueAtTime(level, when); amp.gain.exponentialRampToValueAtTime(.0001, when + .22);
      osc.connect(amp).connect(this.bus!); osc.start(when); osc.stop(when + .25); return;
    }
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), length = kind === "snare" ? .16 : .05;
    source.buffer = this.noise; source.loop = true;
    filter.type = kind === "snare" ? "bandpass" : "highpass"; filter.frequency.value = kind === "snare" ? 2200 : 7000;
    amp.gain.setValueAtTime(level, when); amp.gain.exponentialRampToValueAtTime(.0001, when + length);
    source.connect(filter).connect(amp).connect(this.bus!); source.start(when, Math.random() * .8); source.stop(when + length + .02);
  }

  /** Schedules one eighth note. Called ahead of the audio clock, so timing stays exact even if the page stutters. */
  private play(index: number, when: number) {
    const bar = Math.floor(index / 8) % 8, chord = CHORDS[Math.floor(bar / 2)], slot = index % 8;
    // Comping: the chord on beat 1, and "ands" that come and go.
    if (slot === 0 || (slot === 3 && Math.random() < .7) || (slot === 6 && Math.random() < .4)) {
      chord.voicing.forEach((note, i) => this.piano(midi(note), when + i * .012, slot === 0 ? 2.4 : 1.2, .05));
    }
    if (slot % 2 === 0) this.bass(chord.bass[slot / 2], when, .3);
    if (slot === 0 || (slot === 4 && Math.random() < .8)) this.drum("kick", when, .22);
    if (slot === 2 || slot === 6) this.drum("snare", when, .06);
    if (Math.random() < .85) this.drum("hat", when, slot % 2 ? .035 : .05);
    // A quiet melody: mostly rests, never on the first beat of the loop's first bar so it breathes in.
    if (slot !== 0 && Math.random() < (bar % 2 ? .3 : .16)) this.piano(midi(MELODY[Math.floor(Math.random() * MELODY.length)]), when, 1.6, .045);
  }

  private tick = () => {
    const ctx = this.ctx; if (!ctx || !this.enabled) return;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      this.play(this.step, this.nextTime);
      // Swing: the second eighth of each beat lands late, the first stretches to match.
      this.nextTime += this.step % 2 === 0 ? BEAT * SWING : BEAT * (1 - SWING);
      this.step++;
    }
  };

  async enable() {
    if (!this.supported) return false;
    if (!this.ctx) this.build();
    const ctx = this.ctx!;
    if (ctx.state !== "running") await ctx.resume();
    this.enabled = true;
    this.master!.gain.setTargetAtTime(.6, ctx.currentTime, FADE);
    if (!this.timer) { this.nextTime = ctx.currentTime + .1; this.timer = window.setInterval(this.tick, TICK_MS); }
    return true;
  }

  disable() {
    this.enabled = false;
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    this.master.gain.setTargetAtTime(0, ctx.currentTime, FADE / 2);
    // Stop scheduling and free the audio hardware once the fade has finished, unless music was re-enabled meanwhile.
    window.setTimeout(() => {
      if (this.enabled) return;
      window.clearInterval(this.timer); this.timer = 0;
      if (ctx.state === "running") void ctx.suspend();
    }, 1200);
  }

  dispose() {
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.enabled = false; window.clearInterval(this.timer); this.timer = 0;
    if (this.ctx) void this.ctx.close();
    this.ctx = this.master = this.bus = this.noise = null;
  }
}
