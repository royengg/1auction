"use client";

import { useCallback, useEffect, useRef } from "react";

let globalAudioContext: AudioContext | null = null;
let audioUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!globalAudioContext) {
    globalAudioContext = new AudioContext();
  }
  if (globalAudioContext.state === "suspended") {
    globalAudioContext.resume().catch(() => {});
  }
  return globalAudioContext;
}

function unlockAudio() {
  if (audioUnlocked) return;
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  audioUnlocked = true;
}

function playMechanicalTick(intensity: number) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Mechanical tick: two quick impulses for a "tick-tock" feel
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();

  osc1.type = "square";
  osc1.frequency.setValueAtTime(300 + intensity * 80, now);
  gain1.gain.setValueAtTime(0.15, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.03);

  // Second lighter tick for mechanical feel
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();

  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(220 + intensity * 60, now + 0.015);
  gain2.gain.setValueAtTime(0.08, now + 0.015);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.015);
  osc2.stop(now + 0.05);
}

function playGavel() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Strike: high-frequency impact
  const strikeOsc = ctx.createOscillator();
  const strikeGain = ctx.createGain();
  const strikeFilter = ctx.createBiquadFilter();

  strikeOsc.type = "sawtooth";
  strikeOsc.frequency.setValueAtTime(900, now);
  strikeOsc.frequency.exponentialRampToValueAtTime(200, now + 0.08);

  strikeFilter.type = "lowpass";
  strikeFilter.frequency.setValueAtTime(3000, now);
  strikeFilter.frequency.exponentialRampToValueAtTime(500, now + 0.1);

  strikeGain.gain.setValueAtTime(0.2, now);
  strikeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  strikeOsc.connect(strikeFilter);
  strikeFilter.connect(strikeGain);
  strikeGain.connect(ctx.destination);
  strikeOsc.start(now);
  strikeOsc.stop(now + 0.15);

  // Thud: low-frequency body
  const thudOsc = ctx.createOscillator();
  const thudGain = ctx.createGain();

  thudOsc.type = "sine";
  thudOsc.frequency.setValueAtTime(150, now);
  thudOsc.frequency.exponentialRampToValueAtTime(60, now + 0.4);

  thudGain.gain.setValueAtTime(0.3, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  thudOsc.connect(thudGain);
  thudGain.connect(ctx.destination);
  thudOsc.start(now);
  thudOsc.stop(now + 0.5);

  // Wood rattle: noise burst
  const bufferSize = ctx.sampleRate * 0.05;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.1;
  }

  const noise = ctx.createBufferSource();
  const noiseGain = ctx.createGain();
  const noiseFilter = ctx.createBiquadFilter();

  noise.buffer = buffer;
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(2000, now);
  noiseFilter.Q.setValueAtTime(0.5, now);

  noiseGain.gain.setValueAtTime(0.1, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.06);
}

export function useAuctionAudio() {
  const lastTickSecond = useRef<number>(-1);
  const hasGaveled = useRef(false);

  // Unlock audio on first user interaction
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  const tick = useCallback((secondsLeft: number) => {
    if (secondsLeft < 1 || secondsLeft > 5) return;
    if (lastTickSecond.current === secondsLeft) return;
    lastTickSecond.current = secondsLeft;

    const intensity = 5 - secondsLeft; // 0 to 4, higher = more intense
    playMechanicalTick(intensity);
  }, []);

  const gavel = useCallback(() => {
    if (hasGaveled.current) return;
    hasGaveled.current = true;
    playGavel();
  }, []);

  const reset = useCallback(() => {
    lastTickSecond.current = -1;
    hasGaveled.current = false;
  }, []);

  return { tick, gavel, reset };
}
