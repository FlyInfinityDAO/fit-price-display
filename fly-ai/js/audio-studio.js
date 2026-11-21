(function () {
  'use strict';

  function seededRandom(seedText) {
    let seed = 2166136261;
    for (const ch of String(seedText || 'fly-infinity')) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
    return function () {
      seed += 0x6D2B79F5;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function addTone(ctx, frequency, start, duration, type, peak, pan = 0, detune = 0) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, frequency), start);
    if (detune) osc.detune.setValueAtTime(detune, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + Math.min(0.025, duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    if (panner) { panner.pan.value = pan; gain.connect(panner); panner.connect(ctx.destination); }
    else gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  function addNoise(ctx, start, duration, peak, cutoff = 5000, pan = 0) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    filter.type = 'lowpass'; filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.buffer = buffer;
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    source.connect(filter); filter.connect(gain);
    if (panner) { panner.pan.value = pan; gain.connect(panner); panner.connect(ctx.destination); }
    else gain.connect(ctx.destination);
    source.start(start); source.stop(start + duration + 0.01);
  }

  function encodeWav(buffer) {
    const channels = Math.min(2, buffer.numberOfChannels);
    const frames = buffer.length;
    const bytes = 44 + frames * channels * 2;
    const output = new ArrayBuffer(bytes);
    const view = new DataView(output);
    const write = (offset, value) => {
      for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
    };
    write(0, 'RIFF'); view.setUint32(4, bytes - 8, true); write(8, 'WAVE');
    write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, channels, true); view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, frames * channels * 2, true);
    const channelData = Array.from({ length: channels }, (_, i) => buffer.getChannelData(i));
    let offset = 44;
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < channels; c++) {
        const sample = Math.max(-1, Math.min(1, channelData[c][i]));
        view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
        offset += 2;
      }
    }
    return new Blob([output], { type: 'audio/wav' });
  }

  function getContext(duration) {
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) throw new Error('Offline audio rendering is not supported in this browser.');
    const sampleRate = 22050;
    return new Offline(2, Math.ceil(sampleRate * duration), sampleRate);
  }

  const scales = {
    calm: [0, 2, 4, 7, 9], cinematic: [0, 2, 3, 7, 8], electronic: [0, 3, 5, 7, 10],
    lofi: [0, 2, 3, 7, 9], upbeat: [0, 2, 4, 7, 11]
  };
  const chordSets = {
    calm: [[0, 4, 7], [9, 0, 4], [5, 9, 0], [7, 11, 2]],
    cinematic: [[0, 3, 7], [8, 0, 3], [5, 8, 0], [7, 11, 2]],
    electronic: [[0, 3, 7], [5, 8, 0], [10, 2, 5], [7, 10, 2]],
    lofi: [[0, 3, 7], [8, 0, 3], [5, 8, 0], [10, 2, 5]],
    upbeat: [[0, 4, 7], [7, 11, 2], [9, 0, 4], [5, 9, 0]]
  };

  async function generateMusic({ prompt = '', style = 'cinematic', tempo = 96, duration = 30 } = {}) {
    style = Object.prototype.hasOwnProperty.call(scales, style) ? style : 'cinematic';
    tempo = Math.max(65, Math.min(150, Number(tempo) || 96));
    duration = Math.max(15, Math.min(45, Number(duration) || 30));
    const ctx = getContext(duration), rand = seededRandom(prompt + '|' + style + '|' + tempo);
    const beat = 60 / tempo, beatsPerBar = 4, barDuration = beat * beatsPerBar;
    const root = style === 'upbeat' ? 220 : style === 'electronic' ? 110 : 146.83;
    const scale = scales[style], chords = chordSets[style], bars = Math.ceil(duration / barDuration);
    const padGain = style === 'electronic' ? 0.025 : 0.045;
    for (let bar = 0; bar < bars; bar++) {
      const start = bar * barDuration, chord = chords[bar % chords.length];
      chord.forEach((semi, index) => {
        const frequency = root * Math.pow(2, (semi + (index === 0 ? 0 : 12)) / 12);
        addTone(ctx, frequency, start, Math.min(barDuration * 0.94, duration - start), 'sawtooth', padGain / (index + 1), index * 0.22 - 0.2);
      });
      for (let step = 0; step < 8; step++) {
        if (start + step * beat / 2 >= duration) continue;
        if (rand() > (style === 'calm' ? 0.72 : 0.38)) {
          const semi = scale[Math.floor(rand() * scale.length)];
          const octave = rand() > 0.7 ? 24 : 12;
          const at = start + step * beat / 2;
          addTone(ctx, root * Math.pow(2, (semi + octave) / 12), at, beat * (0.18 + rand() * 0.24), style === 'lofi' ? 'triangle' : 'sine', 0.035 + rand() * 0.025, rand() * 1.5 - 0.75);
        }
      }
      for (let b = 0; b < beatsPerBar; b++) {
        const at = start + b * beat;
        if (at >= duration) continue;
        if (style !== 'calm' || b === 0 || b === 2) {
          addTone(ctx, 78 + rand() * 15, at, 0.22, 'sine', style === 'cinematic' ? 0.22 : 0.13, 0);
          if (style !== 'ambient') addNoise(ctx, at + beat * 0.5, 0.09, 0.025, 8500, rand() * 0.7 - 0.35);
        }
        if (b === 1 || b === 3) addNoise(ctx, at, 0.14, style === 'lofi' ? 0.075 : 0.055, 2400, rand() * 0.6 - 0.3);
      }
    }
    const rendered = await ctx.startRendering();
    return encodeWav(rendered);
  }

  async function generateEffect(type = 'chime', duration = 2.5) {
    const ctx = getContext(duration);
    const rand = seededRandom(type + '|fly-fx');
    if (type === 'whoosh') {
      addNoise(ctx, 0, duration, 0.3, 7000, 0);
      addTone(ctx, 90, 0, duration, 'sine', 0.12);
    } else if (type === 'laser') {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(900, 0); osc.frequency.exponentialRampToValueAtTime(90, duration);
      gain.gain.setValueAtTime(0.0001, 0); gain.gain.exponentialRampToValueAtTime(0.24, 0.015); gain.gain.exponentialRampToValueAtTime(0.0001, duration);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(0); osc.stop(duration);
    } else if (type === 'impact') {
      addNoise(ctx, 0, 0.5, 0.38, 1200, 0); addTone(ctx, 54, 0, 0.65, 'sine', 0.38);
    } else if (type === 'rain') {
      for (let i = 0; i < 130; i++) addNoise(ctx, rand() * duration, 0.07 + rand() * 0.1, 0.025, 5500 + rand() * 4000, rand() * 2 - 1);
    } else {
      const notes = type === 'magic' ? [0, 7, 12, 16, 19, 24] : [0, 4, 7, 12];
      notes.forEach((note, index) => addTone(ctx, 440 * Math.pow(2, note / 12), index * 0.22, 1.65, 'sine', 0.13 / (1 + index * 0.25), rand() * 1.4 - 0.7));
    }
    return encodeWav(await ctx.startRendering());
  }

  window.FlyAudioComposer = { generateMusic, generateEffect, encodeWav };
})();
