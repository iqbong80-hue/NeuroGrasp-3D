/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  RotateCcw,
  Play,
  Activity,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  Camera,
  ShieldAlert,
  CheckCircle2,
  ArrowDownCircle,
  Hand,
  PenTool,
  Egg,
  Trophy,
  Zap,
  Crosshair,
  Focus,
} from 'lucide-react';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export type TaskMode = 'egg' | 'pen' | 'jegi' | 'needle';

export type SimStatus =
  | 'Ready'
  | 'Grasping...'
  | 'Successfully Lifted!'
  | 'Egg Broken!'
  | 'Egg Dropped!'
  | 'Pen Acquired'
  | "Drawing 'Y'"
  | "Drawing 'E'"
  | "Drawing 'S'"
  | 'Writing Completed!'
  | '제기차기 대기 중'
  | '제기 차올림! (Kick!)'
  | '공중 체공 중...'
  | '제기 바닥에 떨어짐!'
  | '바늘귀 조준 대기'
  | 'BCI 손떨림 보정 중...'
  | '바늘귀 정밀 관통 중...'
  | 'Threading Success! (정밀도 99.8%)';

export type BciPreset = 'optimal' | 'weak' | 'overgrip' | 'oscillating';

export type CameraView = 'studio' | 'closeup' | 'topdown' | 'macro';

interface ShardData {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  baseOffset: THREE.Vector3;
  baseRotation: THREE.Euler;
}

interface WritingSegment {
  letter: 'Y' | 'E' | 'S';
  penDown: boolean;
  duration: number;
  points: Array<{ x: number; z: number }>;
}

interface TelemetryState {
  gripStrength: number; // 0 to 100 %
  appliedForceN: number; // 0 to 12.0 N
  structuralIntegrity: number; // 0 to 100 %
  status: SimStatus;
  phaseNote: string;
  alphaPower: number; // μV
  betaPower: number; // μV
  writingProgress: number; // 0 to 100 %
  jegiCombo: number;
  jegiBestCombo: number;
  jegiHeightM: number;
  jegiTimingGrade: 'PERFECT' | 'GOOD' | 'READY' | 'MISS';
  needlePrecisionPct: number; // e.g., 99.8
  needleTremorUm: number; // Residual hand tremor in micrometers (μm)
  needleProgressPct: number; // 0 to 100 %
}

const MAX_FORCE_NEWTONS = 12.0;
const TABLE_Y = 0;
const EGG_REST_Y = 0.72;
const PAPER_SURFACE_Y = 0.148;
const JEGI_FLOOR_Y = 0.12;
const NEEDLE_EYE_Y = 1.18; // Elevated vertical needle eye height atop the precision floor stand (바닥 거치대)

// Stroke-by-stroke vector definition for "Y - E - S" on the paper pad
const YES_WRITING_SEGMENTS: WritingSegment[] = [
  // --- LETTER 'Y' ---
  {
    letter: 'Y',
    penDown: false,
    duration: 0.45,
    points: [
      { x: 0.0, z: 0.0 },
      { x: -0.78, z: -0.32 },
    ],
  },
  {
    letter: 'Y',
    penDown: true,
    duration: 0.65,
    points: [
      { x: -0.78, z: -0.32 },
      { x: -0.56, z: 0.02 },
    ],
  },
  {
    letter: 'Y',
    penDown: false,
    duration: 0.28,
    points: [
      { x: -0.56, z: 0.02 },
      { x: -0.34, z: -0.32 },
    ],
  },
  {
    letter: 'Y',
    penDown: true,
    duration: 0.65,
    points: [
      { x: -0.34, z: -0.32 },
      { x: -0.56, z: 0.02 },
    ],
  },
  {
    letter: 'Y',
    penDown: true,
    duration: 0.7,
    points: [
      { x: -0.56, z: 0.02 },
      { x: -0.56, z: 0.38 },
    ],
  },

  // --- LETTER 'E' ---
  {
    letter: 'E',
    penDown: false,
    duration: 0.35,
    points: [
      { x: -0.56, z: 0.38 },
      { x: -0.14, z: -0.32 },
    ],
  },
  {
    letter: 'E',
    penDown: true,
    duration: 0.75,
    points: [
      { x: -0.14, z: -0.32 },
      { x: -0.14, z: 0.38 },
    ],
  },
  {
    letter: 'E',
    penDown: false,
    duration: 0.25,
    points: [
      { x: -0.14, z: 0.38 },
      { x: -0.14, z: -0.32 },
    ],
  },
  {
    letter: 'E',
    penDown: true,
    duration: 0.55,
    points: [
      { x: -0.14, z: -0.32 },
      { x: 0.2, z: -0.32 },
    ],
  },
  {
    letter: 'E',
    penDown: false,
    duration: 0.25,
    points: [
      { x: 0.2, z: -0.32 },
      { x: -0.14, z: 0.03 },
    ],
  },
  {
    letter: 'E',
    penDown: true,
    duration: 0.5,
    points: [
      { x: -0.14, z: 0.03 },
      { x: 0.15, z: 0.03 },
    ],
  },
  {
    letter: 'E',
    penDown: false,
    duration: 0.25,
    points: [
      { x: 0.15, z: 0.03 },
      { x: -0.14, z: 0.38 },
    ],
  },
  {
    letter: 'E',
    penDown: true,
    duration: 0.55,
    points: [
      { x: -0.14, z: 0.38 },
      { x: 0.22, z: 0.38 },
    ],
  },

  // --- LETTER 'S' ---
  {
    letter: 'S',
    penDown: false,
    duration: 0.38,
    points: [
      { x: 0.22, z: 0.38 },
      { x: 0.76, z: -0.22 },
    ],
  },
  {
    letter: 'S',
    penDown: true,
    duration: 1.65,
    points: [
      { x: 0.76, z: -0.22 },
      { x: 0.66, z: -0.33 },
      { x: 0.48, z: -0.32 },
      { x: 0.38, z: -0.2 },
      { x: 0.41, z: -0.06 },
      { x: 0.58, z: 0.03 },
      { x: 0.75, z: 0.12 },
      { x: 0.78, z: 0.27 },
      { x: 0.66, z: 0.38 },
      { x: 0.46, z: 0.38 },
      { x: 0.36, z: 0.26 },
    ],
  },
];

// Pre-allocated reusable Three.js math objects to avoid GC in animation loop
const _camTargetPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();

function evaluatePolyline(
  points: Array<{ x: number; z: number }>,
  t: number
): { x: number; z: number } {
  if (points.length === 0) return { x: 0, z: 0 };
  if (points.length === 1 || t <= 0) return points[0];
  if (t >= 1) return points[points.length - 1];

  const totalSegments = points.length - 1;
  const scaled = t * totalSegments;
  const idx = Math.min(Math.floor(scaled), totalSegments - 1);
  const localT = scaled - idx;
  const p0 = points[idx];
  const p1 = points[idx + 1];
  return {
    x: THREE.MathUtils.lerp(p0.x, p1.x, localT),
    z: THREE.MathUtils.lerp(p0.z, p1.z, localT),
  };
}

// ============================================================================
// PROCEDURAL TEXTURE GENERATORS (ZERO EXTERNAL 404 ASSETS)
// ============================================================================

function createEggshellTexture(maxAnisotropy: number): {
  albedo: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#F7EFE4');
  grad.addColorStop(0.5, '#EFE2D1');
  grad.addColorStop(1, '#E5D3BC');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = Math.random() * 1.6 + 0.3;
    const alpha = Math.random() * 0.08;
    ctx.fillStyle = `rgba(130, 95, 65, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const albedo = new THREE.CanvasTexture(canvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.anisotropy = maxAnisotropy;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = 115 + Math.floor(Math.random() * 25);
    bCtx.fillStyle = `rgb(${v},${v},${v})`;
    bCtx.fillRect(x, y, 1.5, 1.5);
  }
  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.anisotropy = maxAnisotropy;

  return { albedo, bump };
}

function createCalibrationGridTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#111826';
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
  ctx.lineWidth = 1;
  const stepSmall = 32;
  for (let i = 0; i <= 1024; i += stepSmall) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
  ctx.lineWidth = 1.5;
  const stepLarge = 128;
  for (let i = 0; i <= 1024; i += stepLarge) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
  ctx.lineWidth = 2;
  [90, 140, 200].forEach((radius) => {
    ctx.beginPath();
    ctx.arc(512, 512, radius, 0, Math.PI * 2);
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createPaperPadTexture(maxAnisotropy: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  resetPaper: () => void;
  drawInkStroke: (x0: number, z0: number, x1: number, z1: number) => void;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 768;
  const ctx = canvas.getContext('2d')!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;

  const resetPaper = () => {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.lineWidth = 2;
    for (let y = 110; y < canvas.height - 40; y += 64) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(canvas.width - 40, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(244, 63, 94, 0.32)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(40, 92);
    ctx.lineTo(canvas.width - 40, 92);
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.font = '600 20px "JetBrains Mono", monospace';
    ctx.fillText('BCI MOTOR CORTEX CALLIGRAPHY SHEET // TARGET: "YES"', 54, 64);

    texture.needsUpdate = true;
  };

  const toCanvasCoords = (x: number, z: number) => {
    const u = (x + 1.15) / 2.3;
    const v = (z + 0.82) / 1.64;
    return {
      px: u * canvas.width,
      py: v * canvas.height,
    };
  };

  const drawInkStroke = (x0: number, z0: number, x1: number, z1: number) => {
    const p0 = toCanvasCoords(x0, z0);
    const p1 = toCanvasCoords(x1, z1);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.strokeStyle = 'rgba(29, 78, 216, 0.35)';
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(p0.px, p0.py);
    ctx.lineTo(p1.px, p1.py);
    ctx.stroke();

    ctx.strokeStyle = '#1E3A8A';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(p0.px, p0.py);
    ctx.lineTo(p1.px, p1.py);
    ctx.stroke();

    ctx.restore();
    texture.needsUpdate = true;
  };

  resetPaper();

  return { canvas, ctx, texture, resetPaper, drawInkStroke };
}

function createHanjiTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#F7F3E8';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 950; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = 14 + Math.random() * 34;
    const angle = Math.random() * Math.PI * 2;
    ctx.strokeStyle =
      i % 3 === 0
        ? 'rgba(214, 198, 172, 0.32)'
        : 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 0.8 + Math.random() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createTraditionalMatTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1E293B';
  ctx.fillRect(0, 0, 512, 512);

  const cx = 256;
  const cy = 256;
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, 220, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.32)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 145, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(244, 63, 94, 0.35)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 70, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

// ============================================================================
// PROCEDURAL WEB AUDIO SYNTHESIZER
// ============================================================================

class SoundEffects {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private ensureContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  playServoEngage() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.18);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  playPenStrokeTick() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.08);

    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  playJegiKick(comboCount: number) {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    const kickOsc = this.ctx.createOscillator();
    const kickGain = this.ctx.createGain();
    kickOsc.type = 'sine';
    kickOsc.frequency.setValueAtTime(165, now);
    kickOsc.frequency.exponentialRampToValueAtTime(58, now + 0.11);
    kickGain.gain.setValueAtTime(0.14, now);
    kickGain.gain.exponentialRampToValueAtTime(0.002, now + 0.12);
    kickOsc.connect(kickGain);
    kickGain.connect(this.ctx.destination);
    kickOsc.start(now);
    kickOsc.stop(now + 0.13);

    const pitchBoost = Math.min(350, comboCount * 18);
    const coinOsc = this.ctx.createOscillator();
    const coinGain = this.ctx.createGain();
    coinOsc.type = 'triangle';
    coinOsc.frequency.setValueAtTime(1180 + pitchBoost, now);
    coinOsc.frequency.exponentialRampToValueAtTime(
      1640 + pitchBoost,
      now + 0.14
    );
    coinGain.gain.setValueAtTime(0.045, now);
    coinGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    coinOsc.connect(coinGain);
    coinGain.connect(this.ctx.destination);
    coinOsc.start(now);
    coinOsc.stop(now + 0.16);

    const bufferSize = Math.floor(this.ctx.sampleRate * 0.12);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] =
        (Math.random() * 2 - 1) *
        Math.exp(-i / (this.ctx.sampleRate * 0.035));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2800, now);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.08, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.002, now + 0.12);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(now);
  }

  playSuccessChime() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.065);
      gain.gain.setValueAtTime(0.05, now + idx * 0.065);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.065 + 0.38);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.065);
      osc.stop(now + idx * 0.065 + 0.39);
    });
  }

  playEggCrack() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.22;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] =
        (Math.random() * 2 - 1) *
        Math.exp(-i / (this.ctx.sampleRate * 0.045));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, now);
    filter.Q.setValueAtTime(1.5, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.22);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }
}

const sfx = new SoundEffects();

// ============================================================================
// MAIN APPLICATION COMPONENT
// ============================================================================

export default function App() {
  // UI State — Opens directly in Needle Threading Mode framed cleanly on the floor-stand needle & robotic tweezers
  const [taskMode, setTaskMode] = useState<TaskMode>('needle');
  const [gripStrength, setGripStrength] = useState<number>(48);
  const [bciMode, setBciMode] = useState<boolean>(false);
  const [bciPreset, setBciPreset] = useState<BciPreset>('optimal');
  const [jegiAutoMode, setJegiAutoMode] = useState<boolean>(true);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [cameraView, setCameraView] = useState<CameraView>('studio');

  const [telemetry, setTelemetry] = useState<TelemetryState>({
    gripStrength: 72,
    appliedForceN: 3.8,
    structuralIntegrity: 100,
    status: '바늘귀 조준 대기',
    phaseNote:
      '바닥 거치대에 고정된 바늘귀 앞에 로봇 핀셋·손가락이 구리빛 에나멜 코일 선을 쥐고 대기 중입니다.',
    alphaPower: 18.4,
    betaPower: 42.6,
    writingProgress: 0,
    jegiCombo: 0,
    jegiBestCombo: 0,
    jegiHeightM: 0,
    jegiTimingGrade: 'READY',
    needlePrecisionPct: 91.2,
    needleTremorUm: 118.4,
    needleProgressPct: 0,
  });

  // Refs for WebGL canvas & EEG oscilloscope canvas
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const eegCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mutable simulation state shared with the 60fps Three.js loop
  const simRef = useRef({
    taskMode: 'needle' as TaskMode,
    targetGripStrength: 48,
    currentGripClosure: 72,
    appliedForceN: 3.8,
    structuralIntegrity: 100,
    status: '바늘귀 조준 대기' as SimStatus,
    phase: 'needle_idle' as
      | 'idle'
      | 'descending'
      | 'closing'
      | 'lifting'
      | 'holding'
      | 'slipping'
      | 'dropped'
      | 'shattered'
      | 'pen_acquiring'
      | 'pen_ready'
      | 'pen_writing'
      | 'pen_completed'
      | 'jegi_idle'
      | 'jegi_rally'
      | 'jegi_dropped'
      | 'needle_idle'
      | 'needle_stabilizing'
      | 'needle_threading'
      | 'needle_success',
    phaseTimer: 0,
    handX: 0,
    handY: 3.15,
    handZ: 0,
    handRotX: 0,
    handRotZ: 0,
    eggY: EGG_REST_Y,
    eggVy: 0,
    eggRotZ: 0,
    eggRotX: 0,
    // Pen state
    penHeldByHand: false,
    writingSegmentIdx: 0,
    writingSegmentTime: 0,
    writingProgress: 0,
    lastInkX: 0,
    lastInkZ: 0,
    hasLastInkPoint: false,
    // Jegichagi state
    jegiX: 0,
    jegiY: JEGI_FLOOR_Y,
    jegiZ: 0,
    jegiVx: 0,
    jegiVy: 0,
    jegiVz: 0,
    jegiRotX: 0,
    jegiRotZ: 0,
    jegiSpinY: 0,
    jegiCombo: 0,
    jegiBestCombo: 0,
    jegiAutoRally: true,
    jegiKickAnimTimer: 0,
    jegiFootTargetX: 0,
    jegiFootTargetZ: 0,
    jegiTimingGrade: 'READY' as 'PERFECT' | 'GOOD' | 'READY' | 'MISS',
    triggerJegiStartRequested: false,
    triggerJegiManualKickRequested: false,
    // Thread Needle state (오른쪽 -> 왼쪽 바늘귀 정밀 관통 + 엄지/검지 핀치 그립)
    needleTremorAmplitude: 1.0,
    needlePrecisionPct: 91.2,
    needleTremorUm: 118.4,
    needleProgressPct: 0,
    needleWireTipX: 0.19, // Starts at +0.19 (just to the right of the needle eye at x=0) and moves left to -0.26
    needleWireTipY: NEEDLE_EYE_Y,
    needleWireTipZ: 0,
    needlePinchTightness: 0.35, // 0..1 controls articulated thumb & index phalanx pinch & push
    needlePulseTimer: 0,
    triggerNeedleStartRequested: false,
    // BCI & Camera state
    bciActive: false,
    bciPreset: 'optimal' as BciPreset,
    bciAutoSequenceTime: 0,
    cameraPreset: 'studio' as CameraView,
    cameraTransitionTimer: 0,
    resetRequested: false,
    triggerGraspRequested: false,
    triggerWriteRequested: false,
  });

  // Sync React controls to mutable simulation ref
  useEffect(() => {
    simRef.current.targetGripStrength = gripStrength;
  }, [gripStrength]);

  useEffect(() => {
    simRef.current.bciPreset = bciPreset;
  }, [bciPreset]);

  useEffect(() => {
    simRef.current.jegiAutoRally = jegiAutoMode;
  }, [jegiAutoMode]);

  useEffect(() => {
    sfx.enabled = soundEnabled;
  }, [soundEnabled]);

  const handleCameraPresetChange = useCallback((view: CameraView) => {
    if (view === 'macro' && simRef.current.taskMode !== 'needle') {
      setTaskMode('needle');
      simRef.current.taskMode = 'needle';
      simRef.current.bciActive = false;
      setBciMode(false);
      simRef.current.resetRequested = true;
    }
    setCameraView(view);
    simRef.current.cameraPreset = view;
    simRef.current.cameraTransitionTimer = 1.15;
  }, []);

  const handleReset = useCallback(() => {
    simRef.current.bciActive = false;
    setBciMode(false);
    simRef.current.resetRequested = true;
    simRef.current.cameraTransitionTimer = 0.9;
    sfx.playServoEngage();
  }, []);

  // Switch between [Mode: Egg Grasp], [Mode: Pen & Write], [Mode: 제기차기], and [Mode: 바늘귀 꿰기]
  const handleSelectTaskMode = useCallback((nextMode: TaskMode) => {
    setTaskMode(nextMode);
    simRef.current.taskMode = nextMode;
    simRef.current.bciActive = nextMode === 'jegi';
    setBciMode(nextMode === 'jegi');
    simRef.current.resetRequested = true;
    setCameraView('studio');
    simRef.current.cameraPreset = 'studio';
    simRef.current.cameraTransitionTimer = 1.1;
    sfx.playServoEngage();
  }, []);

  const handleExecuteManualGrasp = useCallback(() => {
    if (
      simRef.current.phase === 'dropped' ||
      simRef.current.phase === 'shattered'
    ) {
      simRef.current.resetRequested = true;
    }
    simRef.current.bciActive = false;
    setBciMode(false);
    simRef.current.triggerGraspRequested = true;
    sfx.playServoEngage();
  }, []);

  const handleStartWritingYes = useCallback(() => {
    if (simRef.current.taskMode !== 'pen') {
      setTaskMode('pen');
      simRef.current.taskMode = 'pen';
    }
    setBciMode(true);
    simRef.current.bciActive = true;
    simRef.current.triggerWriteRequested = true;
    sfx.playServoEngage();
  }, []);

  const handleStartJegichagi = useCallback(() => {
    if (simRef.current.taskMode !== 'jegi') {
      setTaskMode('jegi');
      simRef.current.taskMode = 'jegi';
    }
    setBciMode(true);
    simRef.current.bciActive = true;
    simRef.current.triggerJegiStartRequested = true;
  }, []);

  const handleManualJegiKick = useCallback(() => {
    if (simRef.current.taskMode !== 'jegi') return;
    if (simRef.current.phase !== 'jegi_rally') {
      simRef.current.triggerJegiStartRequested = true;
    } else {
      simRef.current.triggerJegiManualKickRequested = true;
    }
  }, []);

  const handleStartNeedleThreading = useCallback(() => {
    if (simRef.current.taskMode !== 'needle') {
      setTaskMode('needle');
      simRef.current.taskMode = 'needle';
    }
    setBciMode(true);
    simRef.current.bciActive = true;
    simRef.current.triggerNeedleStartRequested = true;
    sfx.playServoEngage();
  }, []);

  const handleAutoGraspBci = useCallback(() => {
    if (simRef.current.taskMode === 'pen') {
      handleStartWritingYes();
      return;
    }
    if (simRef.current.taskMode === 'jegi') {
      handleStartJegichagi();
      return;
    }
    if (simRef.current.taskMode === 'needle') {
      handleStartNeedleThreading();
      return;
    }
    if (
      simRef.current.phase === 'dropped' ||
      simRef.current.phase === 'shattered'
    ) {
      simRef.current.resetRequested = true;
    }
    const nextBci = !bciMode;
    setBciMode(nextBci);
    simRef.current.bciActive = nextBci;
    simRef.current.bciAutoSequenceTime = 0;
    if (nextBci) {
      simRef.current.triggerGraspRequested = true;
      sfx.playServoEngage();
    }
  }, [
    bciMode,
    handleStartWritingYes,
    handleStartJegichagi,
    handleStartNeedleThreading,
  ]);

  // Keyboard shortcuts ('H' toggle HUD, 'R' reset, 'Space' kick Jegi)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'r' || e.key === 'R') {
        handleReset();
      } else if (e.code === 'Space' && simRef.current.taskMode === 'jegi') {
        e.preventDefault();
        handleManualJegiKick();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleReset, handleManualJegiKick]);

  // ============================================================================
  // THREE.JS SCENE & PHYSICS LIFECYCLE
  // ============================================================================
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f17);
    scene.fog = new THREE.FogExp2(0x0b0f17, 0.038);

    // 2. Camera — Framed cleanly on the grounded floor-stand needle, open needle eye & robotic tweezers/fingers
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.04, 100);
    camera.position.set(0.32, NEEDLE_EYE_Y + 0.24, 1.72);
    camera.lookAt(0.14, NEEDLE_EYE_Y - 0.14, 0);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(
      isHeadless ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = !isHeadless;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    const handleContextRestored = () => {
      renderer.setSize(
        container.clientWidth || window.innerWidth,
        container.clientHeight || window.innerHeight
      );
    };
    renderer.domElement.addEventListener(
      'webglcontextlost',
      handleContextLost,
      false
    );
    renderer.domElement.addEventListener(
      'webglcontextrestored',
      handleContextRestored,
      false
    );

    container.appendChild(renderer.domElement);

    // 4. Studio Environment Map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    // 5. OrbitControls — Focused cleanly on the Needle Eye & Robotic Tweezers workspace
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 0.24; // Allows ultra-close Needle Eye Macro View
    controls.maxDistance = 12.0;
    controls.target.set(0.14, NEEDLE_EYE_Y - 0.14, 0);
    controls.update();

    const stopCamTransition = () => {
      simRef.current.cameraTransitionTimer = 0;
    };
    controls.addEventListener('start', stopCamTransition);

    // 6. Balanced 3-Point Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.65);
    hemiLight.position.set(0, 10, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
    keyLight.position.set(4.5, 7.5, 4.0);
    keyLight.castShadow = !isHeadless;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 1.0;
    keyLight.shadow.camera.far = 18.0;
    const d = 4.5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.15);
    rimLight.position.set(-5.0, 4.5, -4.5);
    scene.add(rimLight);

    // 7. Procedural Textures & PBR Materials
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const { albedo: eggAlbedo, bump: eggBump } =
      createEggshellTexture(maxAnisotropy);
    const gridTexture = createCalibrationGridTexture(maxAnisotropy);
    const paperPadSystem = createPaperPadTexture(maxAnisotropy);
    const hanjiTexture = createHanjiTexture(maxAnisotropy);
    const traditionalMatTex = createTraditionalMatTexture(maxAnisotropy);

    const tableMat = new THREE.MeshStandardMaterial({
      map: gridTexture,
      roughness: 0.45,
      metalness: 0.25,
    });

    const brushedTitaniumMat = new THREE.MeshPhysicalMaterial({
      color: 0xcbd5e1,
      metalness: 0.88,
      roughness: 0.22,
      anisotropy: 0.7,
      clearcoat: 0.2,
    });

    const chromeNeedleMat = new THREE.MeshPhysicalMaterial({
      color: 0xf1f5f9,
      metalness: 0.96,
      roughness: 0.08,
      clearcoat: 0.5,
      anisotropy: 0.85,
    });

    const copperEnamelMat = new THREE.MeshPhysicalMaterial({
      color: 0xea580c,
      emissive: new THREE.Color(0x9a3412),
      emissiveIntensity: 0.18,
      metalness: 0.88,
      roughness: 0.14,
      clearcoat: 0.95,
      clearcoatRoughness: 0.06,
    });

    const darkAlloyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.75,
      roughness: 0.48,
    });

    const goldPinMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.92,
      roughness: 0.18,
    });

    const yeopjeonBrassMat = new THREE.MeshPhysicalMaterial({
      color: 0xd97706,
      metalness: 0.88,
      roughness: 0.26,
      clearcoat: 0.35,
    });

    const hanjiPaperMat = new THREE.MeshPhysicalMaterial({
      map: hanjiTexture,
      color: 0xfefce8,
      roughness: 0.78,
      metalness: 0.0,
      sheen: 0.35,
      sheenColor: new THREE.Color(0xffffff),
      side: THREE.DoubleSide,
    });

    const tactilePadMat = new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      metalness: 0.05,
      roughness: 0.65,
      clearcoat: 0.15,
      emissive: new THREE.Color(0x0284c7),
      emissiveIntensity: 0.15,
    });

    // Dedicated glowing fingertip tactile sensor material for the thumb & index finger pinch
    const fingertipSensorMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      metalness: 0.1,
      roughness: 0.35,
      clearcoat: 0.6,
      emissive: new THREE.Color(0x0284c7),
      emissiveIntensity: 0.45,
    });

    const sensorRingMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: new THREE.Color(0x10b981),
      emissiveIntensity: 0.7,
      roughness: 0.2,
    });

    const eggMaterial = new THREE.MeshPhysicalMaterial({
      map: eggAlbedo,
      bumpMap: eggBump,
      bumpScale: 0.006,
      roughness: 0.34,
      metalness: 0.0,
      clearcoat: 0.18,
      clearcoatRoughness: 0.35,
      sheen: 0.25,
      sheenColor: new THREE.Color(0xfffbeb),
    });

    // 8. Build Laboratory Table
    const environmentGroup = new THREE.Group();
    scene.add(environmentGroup);

    const tableGeo = new THREE.CylinderGeometry(5.5, 5.8, 0.36, 64);
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    tableMesh.position.y = TABLE_Y - 0.18;
    tableMesh.receiveShadow = true;
    environmentGroup.add(tableMesh);

    const rimGeo = new THREE.TorusGeometry(5.52, 0.06, 16, 96);
    rimGeo.rotateX(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimGeo, darkAlloyMat);
    rimMesh.position.y = TABLE_Y - 0.02;
    environmentGroup.add(rimMesh);

    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d')!;
    const radGrad = sCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
    radGrad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
    radGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.22)');
    radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sCtx.fillStyle = radGrad;
    sCtx.fillRect(0, 0, 128, 128);
    const contactShadowTex = new THREE.CanvasTexture(shadowCanvas);

    // ========================================================================
    // EGG MODE WORKSPACE GROUP
    // ========================================================================
    const eggWorkspaceGroup = new THREE.Group();
    scene.add(eggWorkspaceGroup);

    const pedestalGroup = new THREE.Group();
    pedestalGroup.position.set(0, TABLE_Y, 0);
    eggWorkspaceGroup.add(pedestalGroup);

    const pedBaseGeo = new THREE.CylinderGeometry(0.75, 0.88, 0.14, 48);
    const pedBaseMesh = new THREE.Mesh(pedBaseGeo, darkAlloyMat);
    pedBaseMesh.position.y = 0.07;
    pedBaseMesh.castShadow = true;
    pedBaseMesh.receiveShadow = true;
    pedestalGroup.add(pedBaseMesh);

    const pedCushionGeo = new THREE.TorusGeometry(0.34, 0.065, 20, 48);
    pedCushionGeo.rotateX(Math.PI / 2);
    const pedCushionMesh = new THREE.Mesh(
      pedCushionGeo,
      new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.85,
        metalness: 0.1,
      })
    );
    pedCushionMesh.position.y = 0.15;
    pedCushionMesh.receiveShadow = true;
    pedestalGroup.add(pedCushionMesh);

    const contactShadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 1.7),
      new THREE.MeshBasicMaterial({
        map: contactShadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.75,
      })
    );
    contactShadowMesh.rotation.x = -Math.PI / 2;
    contactShadowMesh.position.y = 0.145;
    eggWorkspaceGroup.add(contactShadowMesh);

    const eggGroup = new THREE.Group();
    eggGroup.position.set(0, EGG_REST_Y, 0);
    eggWorkspaceGroup.add(eggGroup);

    const lathePoints: THREE.Vector2[] = [];
    const numLatheSteps = 40;
    for (let i = 0; i <= numLatheSteps; i++) {
      const t = (i / numLatheSteps) * Math.PI;
      const y = Math.cos(t) * 0.56;
      const asymmetry = 1.0 - 0.18 * Math.cos(t);
      const r = Math.max(0.001, Math.sin(t) * 0.41 * asymmetry);
      lathePoints.push(new THREE.Vector2(r, y));
    }
    const eggGeo = new THREE.LatheGeometry(lathePoints, 48);
    eggGeo.computeVertexNormals();

    const intactEggMesh = new THREE.Mesh(eggGeo, eggMaterial);
    intactEggMesh.castShadow = true;
    intactEggMesh.receiveShadow = true;
    eggGroup.add(intactEggMesh);

    const crackLinesGroup = new THREE.Group();
    crackLinesGroup.visible = false;
    eggGroup.add(crackLinesGroup);

    const crackLineMat = new THREE.LineBasicMaterial({
      color: 0x3f2e21,
      transparent: true,
      opacity: 0.85,
    });

    for (let c = 0; c < 6; c++) {
      const baseAngle = (c / 6) * Math.PI * 2;
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= 8; s++) {
        const frac = (s / 8 - 0.5) * 0.65;
        const ang = baseAngle + Math.sin(s * 2.7 + c) * 0.18;
        const y = frac;
        const t = Math.acos(THREE.MathUtils.clamp(y / 0.56, -1, 1));
        const r = Math.sin(t) * 0.41 * (1.0 - 0.18 * Math.cos(t)) + 0.006;
        pts.push(new THREE.Vector3(Math.cos(ang) * r, y, Math.sin(ang) * r));
      }
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      crackLinesGroup.add(new THREE.Line(lineGeo, crackLineMat));
    }

    const shatterGroup = new THREE.Group();
    shatterGroup.visible = false;
    eggWorkspaceGroup.add(shatterGroup);

    const shardMat = new THREE.MeshPhysicalMaterial({
      map: eggAlbedo,
      roughness: 0.36,
      clearcoat: 0.15,
      side: THREE.DoubleSide,
    });

    const shards: ShardData[] = [];
    const shardCount = 28;
    for (let i = 0; i < shardCount; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / shardCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;

      const shardGeo = new THREE.SphereGeometry(
        0.18 + (i % 3) * 0.03,
        6,
        5,
        0,
        0.95,
        0,
        0.85
      );
      const shardMesh = new THREE.Mesh(shardGeo, shardMat);
      shardMesh.castShadow = true;
      shardMesh.receiveShadow = true;

      const baseOffset = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * 0.32,
        Math.cos(phi) * 0.45,
        Math.sin(phi) * Math.sin(theta) * 0.32
      );
      const baseRotation = new THREE.Euler(phi, theta, (i % 5) * 0.4);

      shatterGroup.add(shardMesh);
      shards.push({
        mesh: shardMesh,
        velocity: new THREE.Vector3(),
        angularVelocity: new THREE.Vector3(),
        baseOffset,
        baseRotation,
      });
    }

    const yolkSplashGroup = new THREE.Group();
    yolkSplashGroup.position.set(0, 0.15, 0);
    yolkSplashGroup.visible = false;
    eggWorkspaceGroup.add(yolkSplashGroup);

    const albumenMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.68, 0.025, 36),
      new THREE.MeshPhysicalMaterial({
        color: 0xfefce8,
        transmission: 0.78,
        opacity: 0.88,
        transparent: true,
        roughness: 0.12,
        ior: 1.36,
      })
    );
    albumenMesh.position.y = 0.015;
    yolkSplashGroup.add(albumenMesh);

    const yolkMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 32, 24),
      new THREE.MeshPhysicalMaterial({
        color: 0xf59e0b,
        roughness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
      })
    );
    yolkMesh.scale.set(1.15, 0.48, 1.15);
    yolkMesh.position.set(0.04, 0.06, -0.03);
    yolkSplashGroup.add(yolkMesh);

    // ========================================================================
    // PEN & WRITE WORKSPACE GROUP
    // ========================================================================
    const penWorkspaceGroup = new THREE.Group();
    penWorkspaceGroup.visible = false;
    scene.add(penWorkspaceGroup);

    const clipboardMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.56, 0.06, 1.92),
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.55,
        metalness: 0.35,
      })
    );
    clipboardMesh.position.set(0, 0.03, 0);
    clipboardMesh.castShadow = true;
    clipboardMesh.receiveShadow = true;
    penWorkspaceGroup.add(clipboardMesh);

    const paperStackSideMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.8,
    });
    const paperTopMat = new THREE.MeshStandardMaterial({
      map: paperPadSystem.texture,
      roughness: 0.72,
      metalness: 0.02,
    });

    const paperPadMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.085, 1.64),
      [
        paperStackSideMat,
        paperStackSideMat,
        paperTopMat,
        paperStackSideMat,
        paperStackSideMat,
        paperStackSideMat,
      ]
    );
    paperPadMesh.position.set(0, 0.102, 0);
    paperPadMesh.castShadow = true;
    paperPadMesh.receiveShadow = true;
    penWorkspaceGroup.add(paperPadMesh);

    const padClipMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.055, 0.16),
      brushedTitaniumMat
    );
    padClipMesh.position.set(0, 0.155, -0.82);
    padClipMesh.castShadow = true;
    penWorkspaceGroup.add(padClipMesh);

    const penStandGroup = new THREE.Group();
    penStandGroup.position.set(-1.55, 0, -0.25);
    penWorkspaceGroup.add(penStandGroup);

    const standBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.34, 0.1, 32),
      darkAlloyMat
    );
    standBase.position.y = 0.05;
    standBase.castShadow = true;
    penStandGroup.add(standBase);

    const standCradle = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.03, 16, 32, Math.PI),
      goldPinMat
    );
    standCradle.rotation.z = Math.PI;
    standCradle.position.y = 0.22;
    penStandGroup.add(standCradle);

    const inkRibbonGroup = new THREE.Group();
    inkRibbonGroup.position.y = PAPER_SURFACE_Y + 0.004;
    penWorkspaceGroup.add(inkRibbonGroup);

    const inkBeadGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.006, 12);
    const inkRibbonMat = new THREE.MeshPhysicalMaterial({
      color: 0x1d4ed8,
      roughness: 0.18,
      clearcoat: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    const clearInkRibbons = () => {
      while (inkRibbonGroup.children.length > 0) {
        const child = inkRibbonGroup.children[0] as THREE.Mesh;
        inkRibbonGroup.remove(child);
      }
    };

    const add3DInkSegment = (
      x0: number,
      z0: number,
      x1: number,
      z1: number
    ) => {
      const dx = x1 - x0;
      const dz = z1 - z0;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.002) return;

      const stripGeo = new THREE.PlaneGeometry(0.048, dist + 0.015);
      stripGeo.rotateX(-Math.PI / 2);
      const stripMesh = new THREE.Mesh(stripGeo, inkRibbonMat);
      stripMesh.position.set((x0 + x1) * 0.5, 0, (z0 + z1) * 0.5);
      stripMesh.rotation.y = Math.atan2(dx, dz);
      inkRibbonGroup.add(stripMesh);

      const beadMesh = new THREE.Mesh(inkBeadGeo, inkRibbonMat);
      beadMesh.position.set(x1, 0, z1);
      inkRibbonGroup.add(beadMesh);
    };

    // Composite Multi-Part Ballpoint Pen Model
    const penAssembly = new THREE.Group();
    penAssembly.visible = false;
    scene.add(penAssembly);

    const penBarrelMat = new THREE.MeshPhysicalMaterial({
      color: 0x2563eb,
      metalness: 0.72,
      roughness: 0.24,
      clearcoat: 0.85,
      clearcoatRoughness: 0.15,
    });

    const penGripRubberMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.88,
      metalness: 0.08,
    });

    const nibBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0x1d4ed8,
        roughness: 0.2,
        metalness: 0.5,
      })
    );
    nibBall.position.y = 0.015;
    penAssembly.add(nibBall);

    const noseCone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.018, 0.24, 24),
      brushedTitaniumMat
    );
    noseCone.position.y = 0.13;
    noseCone.castShadow = true;
    penAssembly.add(noseCone);

    const rubberGrip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.074, 0.068, 0.42, 24),
      penGripRubberMat
    );
    rubberGrip.position.y = 0.46;
    rubberGrip.castShadow = true;
    penAssembly.add(rubberGrip);

    const trimRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.076, 0.076, 0.035, 24),
      goldPinMat
    );
    trimRing.position.y = 0.685;
    penAssembly.add(trimRing);

    const upperBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.072, 0.074, 0.78, 24),
      penBarrelMat
    );
    upperBarrel.position.y = 1.09;
    upperBarrel.castShadow = true;
    penAssembly.add(upperBarrel);

    const pocketClip = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.44, 0.045),
      goldPinMat
    );
    pocketClip.position.set(0, 1.22, 0.082);
    pocketClip.castShadow = true;
    penAssembly.add(pocketClip);

    const clickerCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.052, 0.14, 20),
      brushedTitaniumMat
    );
    clickerCap.position.y = 1.54;
    penAssembly.add(clickerCap);

    // ========================================================================
    // JEGICHAGI (한국 전통놀이 제기차기) WORKSPACE GROUP
    // ========================================================================
    const jegiWorkspaceGroup = new THREE.Group();
    jegiWorkspaceGroup.visible = false;
    scene.add(jegiWorkspaceGroup);

    const jegiArenaMatPad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.75, 1.85, 0.06, 64),
      new THREE.MeshStandardMaterial({
        map: traditionalMatTex,
        roughness: 0.6,
        metalness: 0.15,
      })
    );
    jegiArenaMatPad.position.set(0, 0.03, 0);
    jegiArenaMatPad.receiveShadow = true;
    jegiWorkspaceGroup.add(jegiArenaMatPad);

    const strikeZoneRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const strikeZoneRing = new THREE.Mesh(
      new THREE.RingGeometry(0.52, 0.58, 48),
      strikeZoneRingMat
    );
    strikeZoneRing.rotation.x = -Math.PI / 2;
    strikeZoneRing.position.set(0, 0.065, 0);
    jegiWorkspaceGroup.add(strikeZoneRing);

    const jegiShadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.4),
      new THREE.MeshBasicMaterial({
        map: contactShadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.7,
      })
    );
    jegiShadowMesh.rotation.x = -Math.PI / 2;
    jegiShadowMesh.position.y = 0.066;
    jegiWorkspaceGroup.add(jegiShadowMesh);

    const jegiModelGroup = new THREE.Group();
    jegiModelGroup.position.set(0, JEGI_FLOOR_Y, 0);
    jegiWorkspaceGroup.add(jegiModelGroup);

    const coinShape = new THREE.Shape();
    coinShape.absarc(0, 0, 0.25, 0, Math.PI * 2, false);
    const squareHole = new THREE.Path();
    const hs = 0.075;
    squareHole.moveTo(-hs, -hs);
    squareHole.lineTo(hs, -hs);
    squareHole.lineTo(hs, hs);
    squareHole.lineTo(-hs, hs);
    squareHole.lineTo(-hs, -hs);
    coinShape.holes.push(squareHole);

    const yeopjeonGeo = new THREE.ExtrudeGeometry(coinShape, {
      depth: 0.045,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 3,
      curveSegments: 36,
    });
    yeopjeonGeo.rotateX(Math.PI / 2);
    const yeopjeonMesh = new THREE.Mesh(yeopjeonGeo, yeopjeonBrassMat);
    yeopjeonMesh.position.y = 0.035;
    yeopjeonMesh.castShadow = true;
    yeopjeonMesh.receiveShadow = true;
    jegiModelGroup.add(yeopjeonMesh);

    const hanjiWrapHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.16, 0.14, 24),
      hanjiPaperMat
    );
    hanjiWrapHub.position.y = 0.085;
    hanjiWrapHub.castShadow = true;
    jegiModelGroup.add(hanjiWrapHub);

    const redBandMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.125, 0.024, 14, 32),
      new THREE.MeshStandardMaterial({
        color: 0xe11d48,
        roughness: 0.45,
      })
    );
    redBandMesh.rotation.x = Math.PI / 2;
    redBandMesh.position.y = 0.145;
    jegiModelGroup.add(redBandMesh);

    const blueBandMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.122, 0.02, 14, 32),
      new THREE.MeshStandardMaterial({
        color: 0x2563eb,
        roughness: 0.45,
      })
    );
    blueBandMesh.rotation.x = Math.PI / 2;
    blueBandMesh.position.y = 0.172;
    jegiModelGroup.add(blueBandMesh);

    interface HanjiStripRig {
      pivot: THREE.Group;
      baseFlareAngle: number;
      azimuth: number;
      phaseOffset: number;
    }
    const hanjiStrips: HanjiStripRig[] = [];
    const totalStrips = 24;

    const stripAccentRedMat = new THREE.MeshPhysicalMaterial({
      map: hanjiTexture,
      color: 0xfda4af,
      roughness: 0.78,
      side: THREE.DoubleSide,
    });
    const stripAccentBlueMat = new THREE.MeshPhysicalMaterial({
      map: hanjiTexture,
      color: 0x93c5fd,
      roughness: 0.78,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < totalStrips; i++) {
      const ringLayer = i < 14 ? 0 : 1;
      const azimuth =
        (i / (ringLayer === 0 ? 14 : 10)) * Math.PI * 2 + ringLayer * 0.25;

      const stripRoot = new THREE.Group();
      stripRoot.position.y = 0.17;
      stripRoot.rotation.y = azimuth;
      jegiModelGroup.add(stripRoot);

      const flarePivot = new THREE.Group();
      const baseFlareAngle = ringLayer === 0 ? 0.42 : 0.24;
      flarePivot.rotation.x = baseFlareAngle;
      stripRoot.add(flarePivot);

      const stripLen = 0.62 + (i % 3) * 0.06;
      const chosenMat =
        i % 6 === 0
          ? stripAccentRedMat
          : i % 6 === 3
          ? stripAccentBlueMat
          : hanjiPaperMat;

      const stripGeo = new THREE.BoxGeometry(0.052, stripLen, 0.006, 1, 6, 1);
      const posAttr = stripGeo.attributes.position;
      for (let v = 0; v < posAttr.count; v++) {
        const py = posAttr.getY(v);
        const normY = (py + stripLen * 0.5) / stripLen;
        const curveZ = normY * normY * 0.14;
        posAttr.setZ(v, posAttr.getZ(v) + curveZ);
      }
      stripGeo.computeVertexNormals();

      const stripMesh = new THREE.Mesh(stripGeo, chosenMat);
      stripMesh.position.y = stripLen * 0.5;
      stripMesh.castShadow = true;
      flarePivot.add(stripMesh);

      hanjiStrips.push({
        pivot: flarePivot,
        baseFlareAngle,
        azimuth,
        phaseOffset: i * 0.7,
      });
    }

    const roboticLegRoot = new THREE.Group();
    roboticLegRoot.position.set(1.22, 0.0, 0.0);
    jegiWorkspaceGroup.add(roboticLegRoot);

    const legStanchionBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.5, 0.16, 32),
      darkAlloyMat
    );
    legStanchionBase.position.set(0.35, 0.08, 0);
    legStanchionBase.castShadow = true;
    legStanchionBase.receiveShadow = true;
    roboticLegRoot.add(legStanchionBase);

    const hipPillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 2.25, 0.32),
      darkAlloyMat
    );
    hipPillar.position.set(0.38, 1.2, 0);
    hipPillar.castShadow = true;
    roboticLegRoot.add(hipPillar);

    const hipPivotGroup = new THREE.Group();
    hipPivotGroup.position.set(0.15, 2.05, 0);
    roboticLegRoot.add(hipPivotGroup);

    const hipServoDrum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.34, 28),
      brushedTitaniumMat
    );
    hipServoDrum.rotation.x = Math.PI / 2;
    hipServoDrum.castShadow = true;
    hipPivotGroup.add(hipServoDrum);

    const thighMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.92, 0.24),
      brushedTitaniumMat
    );
    thighMesh.position.set(-0.18, -0.42, 0);
    thighMesh.rotation.z = -0.32;
    thighMesh.castShadow = true;
    hipPivotGroup.add(thighMesh);

    const thighPiston = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.78, 16),
      goldPinMat
    );
    thighPiston.position.set(-0.04, -0.42, 0.14);
    thighPiston.rotation.z = -0.32;
    hipPivotGroup.add(thighPiston);

    const kneePivotGroup = new THREE.Group();
    kneePivotGroup.position.set(-0.34, -0.82, 0);
    hipPivotGroup.add(kneePivotGroup);

    const kneeJointCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.3, 24),
      darkAlloyMat
    );
    kneeJointCylinder.rotation.x = Math.PI / 2;
    kneeJointCylinder.castShadow = true;
    kneePivotGroup.add(kneeJointCylinder);

    const shinMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.86, 0.2),
      brushedTitaniumMat
    );
    shinMesh.position.set(-0.12, -0.42, 0);
    shinMesh.rotation.z = -0.18;
    shinMesh.castShadow = true;
    kneePivotGroup.add(shinMesh);

    const anklePivotGroup = new THREE.Group();
    anklePivotGroup.position.set(-0.24, -0.82, 0);
    kneePivotGroup.add(anklePivotGroup);

    const ankleGimbal = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 20, 20),
      goldPinMat
    );
    anklePivotGroup.add(ankleGimbal);

    const footChassis = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.14, 0.34),
      darkAlloyMat
    );
    footChassis.position.set(-0.26, -0.04, 0);
    footChassis.castShadow = true;
    anklePivotGroup.add(footChassis);

    const footStrikePad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.26, 0.05, 32),
      tactilePadMat
    );
    footStrikePad.position.set(-0.34, 0.055, 0);
    footStrikePad.castShadow = true;
    anklePivotGroup.add(footStrikePad);

    const footSensorRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.018, 12, 36),
      sensorRingMat
    );
    footSensorRing.rotation.x = Math.PI / 2;
    footSensorRing.position.set(-0.34, 0.065, 0);
    anklePivotGroup.add(footSensorRing);

    // ========================================================================
    // THREAD NEEDLE MODE WORKSPACE GROUP (바닥 거치대 고정 바늘 + 로봇 핀셋/손가락 에나멜선 정밀 삽입)
    // 1. Floor Stand & Precision Micro-Vice Clamp (바닥 거치대) grounded flush at TABLE_Y = 0
    // 2. Thin Polished Chrome Sewing Needle with True Open Eye Hole (얇은 바늘 + 작은 바늘귀 구멍)
    // 3. Dual Holographic Emerald Pulse Rings + 24-Particle Success Sparkle Burst (zero-GC InstancedMesh)
    // 4. Grounded Micro-Manipulator Stage driving the Robotic Pinch Fingers / Precision Tweezers & Enamel Wire
    // ========================================================================
    const needleWorkspaceGroup = new THREE.Group();
    needleWorkspaceGroup.position.set(0, 0, 0);
    needleWorkspaceGroup.visible = true;
    scene.add(needleWorkspaceGroup);

    // Dedicated precision macro illumination highlighting the chrome needle eye & metallic copper enamel wire
    const needleSpotLight = new THREE.PointLight(0xfffbeb, 1.55, 4.0);
    needleSpotLight.position.set(0.18, NEEDLE_EYE_Y + 0.45, 0.65);
    needleWorkspaceGroup.add(needleSpotLight);

    const needleRimLight = new THREE.PointLight(0x38bdf8, 0.7, 3.2);
    needleRimLight.position.set(-0.35, NEEDLE_EYE_Y + 0.15, -0.55);
    needleWorkspaceGroup.add(needleRimLight);

    // Helper: Build an articulated finger phalanx segment extending along dirSign * X
    const buildPhalanxSegment = (
      len: number,
      rProx: number,
      rDist: number,
      mat: THREE.Material,
      dirSign: 1 | -1 = -1
    ) => {
      const segGroup = new THREE.Group();

      const jointPin = new THREE.Mesh(
        new THREE.CylinderGeometry(rProx * 0.95, rProx * 0.95, rProx * 2.4, 16),
        goldPinMat
      );
      jointPin.rotation.x = Math.PI / 2;
      segGroup.add(jointPin);

      const boneGeo = new THREE.CylinderGeometry(
        dirSign === -1 ? rDist : rProx,
        dirSign === -1 ? rProx : rDist,
        len,
        20
      );
      boneGeo.rotateZ(Math.PI / 2);
      const boneMesh = new THREE.Mesh(boneGeo, mat);
      boneMesh.position.set(dirSign * len * 0.5, 0, 0);
      boneMesh.castShadow = true;
      segGroup.add(boneMesh);

      return segGroup;
    };

    // ------------------------------------------------------------------------
    // 1. FLOOR STAND & PRECISION MICRO-VICE CLAMP (바닥 거치대)
    // ------------------------------------------------------------------------
    const needleStandGroup = new THREE.Group();
    needleStandGroup.position.set(0, TABLE_Y, 0);
    needleWorkspaceGroup.add(needleStandGroup);

    // Soft contact shadow directly beneath the floor stand
    const standShadowMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.48, 48),
      new THREE.MeshBasicMaterial({
        color: 0x020617,
        transparent: true,
        opacity: 0.58,
        depthWrite: false,
      })
    );
    standShadowMesh.rotation.x = -Math.PI / 2;
    standShadowMesh.position.y = 0.002;
    needleStandGroup.add(standShadowMesh);

    // 4 Anti-Vibration Rubber/Alloy Leveling Feet grounded at y = 0
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const footMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.048, 0.024, 18),
        darkAlloyMat
      );
      footMesh.position.set(Math.cos(angle) * 0.31, 0.012, Math.sin(angle) * 0.31);
      footMesh.castShadow = true;
      footMesh.receiveShadow = true;
      needleStandGroup.add(footMesh);
    }

    // Heavy Machined Circular Pedestal Base (바닥 거치대 하부 받침대)
    const standLowerBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.4, 0.068, 48),
      darkAlloyMat
    );
    standLowerBase.position.y = 0.056;
    standLowerBase.castShadow = true;
    standLowerBase.receiveShadow = true;
    needleStandGroup.add(standLowerBase);

    // Beveled Titanium Upper Plinth
    const standUpperPlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.33, 0.062, 48),
      brushedTitaniumMat
    );
    standUpperPlinth.position.y = 0.12;
    standUpperPlinth.castShadow = true;
    standUpperPlinth.receiveShadow = true;
    needleStandGroup.add(standUpperPlinth);

    // Precision Gold Vernier Accent Ring around base
    const standVernierRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.355, 0.009, 14, 64),
      goldPinMat
    );
    standVernierRing.rotation.x = Math.PI / 2;
    standVernierRing.position.y = 0.09;
    needleStandGroup.add(standVernierRing);

    // Upright Machined Stainless Support Pillar
    const pillarHeight = 0.42;
    const standPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062, 0.078, pillarHeight, 32),
      brushedTitaniumMat
    );
    standPillar.position.y = 0.15 + pillarHeight * 0.5;
    standPillar.castShadow = true;
    standPillar.receiveShadow = true;
    needleStandGroup.add(standPillar);

    // Anodized Collar with Calibration Status LED Ring
    const standCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.088, 0.065, 32),
      darkAlloyMat
    );
    standCollar.position.y = 0.56;
    standCollar.castShadow = true;
    needleStandGroup.add(standCollar);

    const standOpticalRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.0075, 12, 40),
      sensorRingMat
    );
    standOpticalRing.rotation.x = Math.PI / 2;
    standOpticalRing.position.y = 0.585;
    needleStandGroup.add(standOpticalRing);

    // Precision Micro-Vice Clamping Head (정밀 바늘 고정 바이스 클램프)
    const viceBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.095, 0.14),
      darkAlloyMat
    );
    viceBody.position.y = 0.64;
    viceBody.castShadow = true;
    needleStandGroup.add(viceBody);

    // Twin Opposing Titanium Clamping Jaws gripping the needle shaft
    const leftClampJaw = new THREE.Mesh(
      new THREE.BoxGeometry(0.062, 0.088, 0.095),
      brushedTitaniumMat
    );
    leftClampJaw.position.set(-0.044, 0.725, 0);
    leftClampJaw.castShadow = true;
    needleStandGroup.add(leftClampJaw);

    const rightClampJaw = new THREE.Mesh(
      new THREE.BoxGeometry(0.062, 0.088, 0.095),
      brushedTitaniumMat
    );
    rightClampJaw.position.set(0.044, 0.725, 0);
    rightClampJaw.castShadow = true;
    needleStandGroup.add(rightClampJaw);

    // Tapered Gold Collet Chuck at the center of the clamp jaws
    const needleCollet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.042, 0.075, 24),
      goldPinMat
    );
    needleCollet.position.y = 0.768;
    needleCollet.castShadow = true;
    needleStandGroup.add(needleCollet);

    // Knurled Brass Tension Thumb-Screw protruding to the left (-X)
    const screwStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.13, 16),
      chromeNeedleMat
    );
    screwStem.rotation.z = Math.PI / 2;
    screwStem.position.set(-0.14, 0.64, 0);
    needleStandGroup.add(screwStem);

    const screwKnob = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 0.034, 24),
      goldPinMat
    );
    screwKnob.rotation.z = Math.PI / 2;
    screwKnob.position.set(-0.205, 0.64, 0);
    screwKnob.castShadow = true;
    needleStandGroup.add(screwKnob);

    // ------------------------------------------------------------------------
    // 2. THIN VERTICAL SEWING NEEDLE WITH OPEN EYE HOLE (얇은 바늘 + 작은 바늘귀 구멍)
    // ------------------------------------------------------------------------
    const needleAssembly = new THREE.Group();
    needleWorkspaceGroup.add(needleAssembly);

    // Slender lower chrome shaft rising cleanly from the floor stand collet (y=0.77) up to the base of the needle eye
    const shaftBottomY = 0.77;
    const eyeBottomY = NEEDLE_EYE_Y - 0.125;
    const shaftHeight = eyeBottomY - shaftBottomY;
    const lowerNeedleShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.013, shaftHeight, 24),
      chromeNeedleMat
    );
    lowerNeedleShaft.position.set(0, shaftBottomY + shaftHeight * 0.5, 0);
    lowerNeedleShaft.castShadow = true;
    needleAssembly.add(lowerNeedleShaft);

    // True Open-Hole Beveled Needle Eye (작은 바늘귀 구멍) centered precisely at (0, NEEDLE_EYE_Y, 0)
    const eyeOuterShape = new THREE.Shape();
    const ew = 0.036;
    const eh = 0.132;
    eyeOuterShape.absarc(0, eh - ew, ew, 0, Math.PI, false);
    eyeOuterShape.absarc(0, -(eh - ew), ew, Math.PI, Math.PI * 2, false);
    eyeOuterShape.closePath();

    const eyeHolePath = new THREE.Path();
    const hw = 0.02;
    const hh = 0.092;
    eyeHolePath.absarc(0, hh - hw, hw, 0, Math.PI, false);
    eyeHolePath.absarc(0, -(hh - hw), hw, Math.PI, Math.PI * 2, false);
    eyeHolePath.closePath();
    eyeOuterShape.holes.push(eyeHolePath);

    const needleEyeGeo = new THREE.ExtrudeGeometry(eyeOuterShape, {
      depth: 0.018,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.0035,
      bevelSegments: 3,
      curveSegments: 32,
    });
    needleEyeGeo.center();
    // Rotate 90deg around Y so the open eye tunnel aligns with the X-axis (Right -> Left insertion)
    needleEyeGeo.rotateY(Math.PI / 2);

    const needleEyeMesh = new THREE.Mesh(needleEyeGeo, chromeNeedleMat);
    needleEyeMesh.position.set(0, NEEDLE_EYE_Y, 0);
    needleEyeMesh.castShadow = true;
    needleAssembly.add(needleEyeMesh);

    // Smooth rounded polished crown tip atop the needle eye head
    const needleCrownMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 20, 16),
      chromeNeedleMat
    );
    needleCrownMesh.scale.set(0.62, 1.05, 1.0);
    needleCrownMesh.position.set(0, NEEDLE_EYE_Y + 0.128, 0);
    needleAssembly.add(needleCrownMesh);

    // Subtle Holographic Optical Alignment Reticle framing the Needle Eye
    const eyeReticleMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const eyeReticleRing = new THREE.Mesh(
      new THREE.RingGeometry(0.145, 0.16, 48),
      eyeReticleMat
    );
    eyeReticleRing.rotation.y = Math.PI / 2;
    eyeReticleRing.position.set(0, NEEDLE_EYE_Y, 0);
    needleWorkspaceGroup.add(eyeReticleRing);

    // Dual Staggered Emerald Success Pulse Halo Rings (성공 이펙트 펄스 링)
    const successPulseMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
    });
    const successPulseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.165, 48),
      successPulseMat
    );
    successPulseRing.position.set(0, NEEDLE_EYE_Y, 0);
    needleWorkspaceGroup.add(successPulseRing);

    const successPulseMat2 = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
    });
    const successPulseRing2 = new THREE.Mesh(
      new THREE.RingGeometry(0.09, 0.145, 48),
      successPulseMat2
    );
    successPulseRing2.rotation.y = Math.PI / 2;
    successPulseRing2.position.set(0, NEEDLE_EYE_Y, 0);
    needleWorkspaceGroup.add(successPulseRing2);

    // 24-Particle Radial Success Sparkle Burst (zero per-frame allocations)
    const SPARK_COUNT = 24;
    const sparkGeo = new THREE.OctahedronGeometry(0.012, 0);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.0,
    });
    const successSparkMesh = new THREE.InstancedMesh(
      sparkGeo,
      sparkMat,
      SPARK_COUNT
    );
    successSparkMesh.visible = false;
    needleWorkspaceGroup.add(successSparkMesh);

    const sparkDirs = Array.from({ length: SPARK_COUNT }, (_, idx) => {
      const phi = Math.acos(1 - (2 * (idx + 0.5)) / SPARK_COUNT);
      const theta = Math.PI * (1 + Math.sqrt(5)) * idx;
      return {
        dx: Math.sin(phi) * Math.cos(theta),
        dy: Math.cos(phi),
        dz: Math.sin(phi) * Math.sin(theta),
        speed: 0.28 + (idx % 5) * 0.06,
      };
    });
    const _sparkMatrix = new THREE.Matrix4();
    const _sparkPos = new THREE.Vector3();
    const _sparkQuat = new THREE.Quaternion();
    const _sparkEuler = new THREE.Euler();
    const _sparkScale = new THREE.Vector3();

    // ------------------------------------------------------------------------
    // 3. GROUNDED RIGHT-SIDE PRECISION MICRO-MANIPULATOR STAGE (로봇 정밀 스테이지)
    // ------------------------------------------------------------------------
    const manipulatorBaseX = 1.42;
    const manipulatorStageGroup = new THREE.Group();
    manipulatorStageGroup.position.set(manipulatorBaseX, TABLE_Y, 0);
    needleWorkspaceGroup.add(manipulatorStageGroup);

    const stageShadowMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.38, 36),
      new THREE.MeshBasicMaterial({
        color: 0x020617,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      })
    );
    stageShadowMesh.rotation.x = -Math.PI / 2;
    stageShadowMesh.position.y = 0.002;
    manipulatorStageGroup.add(stageShadowMesh);

    const stageBasePlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.08, 0.42),
      darkAlloyMat
    );
    stageBasePlate.position.y = 0.04;
    stageBasePlate.castShadow = true;
    stageBasePlate.receiveShadow = true;
    manipulatorStageGroup.add(stageBasePlate);

    const stageTower = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, NEEDLE_EYE_Y + 0.16, 0.18),
      brushedTitaniumMat
    );
    stageTower.position.set(0.06, (NEEDLE_EYE_Y + 0.16) * 0.5 + 0.04, -0.03);
    stageTower.castShadow = true;
    stageTower.receiveShadow = true;
    manipulatorStageGroup.add(stageTower);

    const stageCarriage = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.22, 0.24),
      darkAlloyMat
    );
    stageCarriage.position.set(0.02, NEEDLE_EYE_Y + 0.01, -0.03);
    stageCarriage.castShadow = true;
    manipulatorStageGroup.add(stageCarriage);

    const stageServoRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.012, 12, 32),
      goldPinMat
    );
    stageServoRing.rotation.y = Math.PI / 2;
    stageServoRing.position.set(-0.105, NEEDLE_EYE_Y + 0.01, -0.03);
    manipulatorStageGroup.add(stageServoRing);

    // Telescoping Horizontal Actuator Rod connecting the grounded stage carriage to the moving robotic wrist
    const actuatorRodGeo = new THREE.CylinderGeometry(0.036, 0.036, 1.0, 20);
    actuatorRodGeo.rotateZ(Math.PI / 2);
    const actuatorRodMesh = new THREE.Mesh(actuatorRodGeo, chromeNeedleMat);
    actuatorRodMesh.castShadow = true;
    needleWorkspaceGroup.add(actuatorRodMesh);

    // Origin (0,0,0) of `enamelWireAndPinchGroup` is the exact front tip of the copper enamel wire!
    const enamelWireAndPinchGroup = new THREE.Group();
    needleWorkspaceGroup.add(enamelWireAndPinchGroup);

    // (a) Bare slender Copper Enamel Lead Wire from x = 0 (front tip) to x = +0.34 (pinched by right thumb & index at x = +0.21)
    const leadWireLen = 0.36;
    const leadWireGeo = new THREE.CylinderGeometry(
      0.008,
      0.009,
      leadWireLen,
      20
    );
    leadWireGeo.rotateZ(Math.PI / 2);
    const leadWireMesh = new THREE.Mesh(leadWireGeo, copperEnamelMat);
    leadWireMesh.position.set(leadWireLen * 0.5, 0, 0);
    leadWireMesh.castShadow = true;
    enamelWireAndPinchGroup.add(leadWireMesh);

    // Bright polished copper tip micro-cone at x = 0 pointing LEFT (-X) into the needle eye
    const wireTipCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.0085, 0.022, 16),
      goldPinMat
    );
    wireTipCone.rotation.z = Math.PI / 2;
    wireTipCone.position.set(-0.011, 0, 0);
    enamelWireAndPinchGroup.add(wireTipCone);

    // (b) Helical Copper Enamel Coil Winding Section trailing behind the fingertip pinch (x = +0.29 to x = +0.52)
    const coilCurvePoints: THREE.Vector3[] = [];
    const coilTurns = 9;
    const coilSteps = 100;
    for (let i = 0; i <= coilSteps; i++) {
      const u = i / coilSteps;
      const cx = 0.29 + u * 0.22;
      const angle = u * coilTurns * Math.PI * 2;
      const radius = 0.028;
      coilCurvePoints.push(
        new THREE.Vector3(
          cx,
          Math.sin(angle) * radius - 0.015 * u,
          Math.cos(angle) * radius + 0.02 * u
        )
      );
    }
    const coilCurve = new THREE.CatmullRomCurve3(coilCurvePoints);
    const coilTubeGeo = new THREE.TubeGeometry(
      coilCurve,
      100,
      0.0085,
      12,
      false
    );
    const coilTubeMesh = new THREE.Mesh(coilTubeGeo, copperEnamelMat);
    coilTubeMesh.castShadow = true;
    enamelWireAndPinchGroup.add(coilTubeMesh);

    // (c) Right Anthropomorphic Robotic Hand (우측 로봇 손: 엄지·검지 정밀 핀치 + 중지·약지·소지 마디)
    const pinchHandGroup = new THREE.Group();
    // Anchor at the exact pinch point on the wire: x = +0.21, y = 0, z = 0
    pinchHandGroup.position.set(0.21, 0, 0);
    enamelWireAndPinchGroup.add(pinchHandGroup);

    // Right Metacarpal Palm & Wrist Hub at (+0.42, +0.02, -0.03)
    const pinchPalmGroup = new THREE.Group();
    pinchPalmGroup.position.set(0.42, 0.02, -0.03);
    pinchHandGroup.add(pinchPalmGroup);

    const palmBodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.21, 0.14),
      brushedTitaniumMat
    );
    palmBodyMesh.castShadow = true;
    pinchPalmGroup.add(palmBodyMesh);

    const wristCollarMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.082, 0.095, 0.14, 24),
      darkAlloyMat
    );
    wristCollarMesh.rotation.z = Math.PI / 2;
    wristCollarMesh.position.set(0.16, -0.01, 0);
    wristCollarMesh.castShadow = true;
    pinchPalmGroup.add(wristCollarMesh);

    const wristStatusRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.012, 14, 36),
      sensorRingMat
    );
    wristStatusRing.rotation.y = Math.PI / 2;
    wristStatusRing.position.set(0.12, -0.01, 0);
    pinchPalmGroup.add(wristStatusRing);

    // --- 1. RIGHT ARTICULATED INDEX FINGER (우측 검지: MCP -> PIP -> DIP -> 끝단 광학 촉각 센서) ---
    const indexMcpPivot = new THREE.Group();
    indexMcpPivot.position.set(0.32, 0.115, 0.012);
    pinchHandGroup.add(indexMcpPivot);

    const indexProximal = buildPhalanxSegment(
      0.175,
      0.032,
      0.027,
      brushedTitaniumMat,
      -1
    );
    indexMcpPivot.add(indexProximal);

    const indexPipPivot = new THREE.Group();
    indexPipPivot.position.set(-0.175, 0, 0);
    indexProximal.add(indexPipPivot);

    const indexMiddle = buildPhalanxSegment(
      0.125,
      0.026,
      0.022,
      darkAlloyMat,
      -1
    );
    indexPipPivot.add(indexMiddle);

    const indexDipPivot = new THREE.Group();
    indexDipPivot.position.set(-0.125, 0, 0);
    indexMiddle.add(indexDipPivot);

    const indexDistal = buildPhalanxSegment(
      0.1,
      0.021,
      0.016,
      brushedTitaniumMat,
      -1
    );
    indexDipPivot.add(indexDistal);

    // Upper Precision Micro-Tweezer Blade gripping the top of the copper enamel wire
    const upperTweezerTip = new THREE.Mesh(
      new THREE.BoxGeometry(0.058, 0.006, 0.012),
      chromeNeedleMat
    );
    upperTweezerTip.position.set(-0.108, -0.008, 0);
    upperTweezerTip.rotation.z = 0.12;
    indexDistal.add(upperTweezerTip);

    // Index Fingertip Glowing Tactile Force Sensor Pad (검지 끝 촉각 센서)
    const indexSensorPad = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.014, 0.032, 12, 20),
      fingertipSensorMat
    );
    indexSensorPad.rotation.z = Math.PI / 2;
    indexSensorPad.scale.set(1.0, 0.55, 1.15);
    indexSensorPad.position.set(-0.075, -0.012, 0);
    indexDistal.add(indexSensorPad);

    const indexSensorBezel = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, 0.007, 0.028),
      goldPinMat
    );
    indexSensorBezel.position.set(-0.075, -0.004, 0);
    indexDistal.add(indexSensorBezel);

    // --- 2. RIGHT ARTICULATED OPPOSABLE THUMB (우측 엄지: CMC/MCP -> IP -> 끝단 광학 촉각 센서) ---
    const thumbMcpPivot = new THREE.Group();
    thumbMcpPivot.position.set(0.29, -0.1, 0.012);
    pinchHandGroup.add(thumbMcpPivot);

    const thumbProximal = buildPhalanxSegment(
      0.18,
      0.035,
      0.029,
      darkAlloyMat,
      -1
    );
    thumbMcpPivot.add(thumbProximal);

    const thumbIpPivot = new THREE.Group();
    thumbIpPivot.position.set(-0.18, 0, 0);
    thumbProximal.add(thumbIpPivot);

    const thumbDistal = buildPhalanxSegment(
      0.125,
      0.028,
      0.019,
      brushedTitaniumMat,
      -1
    );
    thumbIpPivot.add(thumbDistal);

    // Lower Precision Micro-Tweezer Blade opposing the upper blade on the copper enamel wire
    const lowerTweezerTip = new THREE.Mesh(
      new THREE.BoxGeometry(0.058, 0.006, 0.012),
      chromeNeedleMat
    );
    lowerTweezerTip.position.set(-0.125, 0.009, 0);
    lowerTweezerTip.rotation.z = -0.12;
    thumbDistal.add(lowerTweezerTip);

    // Thumb Fingertip Glowing Tactile Force Sensor Pad (엄지 끝 촉각 센서)
    const thumbSensorPad = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.015, 0.035, 12, 20),
      fingertipSensorMat
    );
    thumbSensorPad.rotation.z = Math.PI / 2;
    thumbSensorPad.scale.set(1.0, 0.55, 1.2);
    thumbSensorPad.position.set(-0.085, 0.013, 0);
    thumbDistal.add(thumbSensorPad);

    const thumbSensorBezel = new THREE.Mesh(
      new THREE.BoxGeometry(0.052, 0.007, 0.03),
      goldPinMat
    );
    thumbSensorBezel.position.set(-0.085, 0.004, 0);
    thumbDistal.add(thumbSensorBezel);

    // --- 3. RIGHT HAND CURLED MIDDLE, RING & PINKY FINGERS (중지·약지·소지 관절 디테일) ---
    [
      { y: 0.085, z: -0.035, curl1: -0.45, curl2: 0.85, len1: 0.15, len2: 0.11 },
      { y: 0.04, z: -0.068, curl1: -0.58, curl2: 0.95, len1: 0.14, len2: 0.1 },
      { y: -0.01, z: -0.095, curl1: -0.7, curl2: 1.05, len1: 0.12, len2: 0.085 },
    ].forEach((fg) => {
      const fMcp = new THREE.Group();
      fMcp.position.set(0.32, fg.y, fg.z);
      fMcp.rotation.z = fg.curl1;
      pinchHandGroup.add(fMcp);
      const fProx = buildPhalanxSegment(fg.len1, 0.028, 0.023, darkAlloyMat, -1);
      fMcp.add(fProx);
      const fPip = new THREE.Group();
      fPip.position.set(-fg.len1, 0, 0);
      fPip.rotation.z = fg.curl2;
      fProx.add(fPip);
      fPip.add(
        buildPhalanxSegment(fg.len2, 0.022, 0.017, brushedTitaniumMat, -1)
      );
    });

    // ========================================================================
    // 9. Build Overhead 3-Finger Robotic Hand (Used in Egg & Pen Modes)
    // ========================================================================
    const handRoot = new THREE.Group();
    handRoot.position.set(0, simRef.current.handY, 0);
    scene.add(handRoot);

    const shaftMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 3.6, 32),
      brushedTitaniumMat
    );
    shaftMesh.position.y = 2.25;
    shaftMesh.castShadow = true;
    handRoot.add(shaftMesh);

    const wristHousing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.52, 0.38, 36),
      darkAlloyMat
    );
    wristHousing.position.y = 0.42;
    wristHousing.castShadow = true;
    handRoot.add(wristHousing);

    const sensorRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.495, 0.028, 16, 48),
      sensorRingMat
    );
    sensorRing.rotation.x = Math.PI / 2;
    sensorRing.position.y = 0.42;
    handRoot.add(sensorRing);

    const palmCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.48, 0.26, 6),
      brushedTitaniumMat
    );
    palmCore.position.y = 0.12;
    palmCore.castShadow = true;
    handRoot.add(palmCore);

    interface FingerRig {
      mountGroup: THREE.Group;
      proximalPivot: THREE.Group;
      distalPivot: THREE.Group;
      padMesh: THREE.Mesh;
      pistonMesh: THREE.Mesh;
    }

    const fingers: FingerRig[] = [];
    const fingerAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];

    fingerAngles.forEach((angle) => {
      const mountGroup = new THREE.Group();
      mountGroup.rotation.y = angle;
      handRoot.add(mountGroup);

      const clevis = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.18, 0.28),
        darkAlloyMat
      );
      clevis.position.set(0, 0.04, 0.56);
      clevis.castShadow = true;
      mountGroup.add(clevis);

      const hingePin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.28, 16),
        goldPinMat
      );
      hingePin.rotation.z = Math.PI / 2;
      hingePin.position.set(0, 0.0, 0.62);
      mountGroup.add(hingePin);

      const proximalPivot = new THREE.Group();
      proximalPivot.position.set(0, 0.0, 0.62);
      mountGroup.add(proximalPivot);

      const proxBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.82, 0.14),
        brushedTitaniumMat
      );
      proxBody.position.set(0, -0.41, 0.04);
      proxBody.castShadow = true;
      proximalPivot.add(proxBody);

      const pistonMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.032, 0.65, 12),
        goldPinMat
      );
      pistonMesh.position.set(0, -0.35, 0.14);
      proximalPivot.add(pistonMesh);

      const distalPin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.22, 16),
        goldPinMat
      );
      distalPin.rotation.z = Math.PI / 2;
      distalPin.position.set(0, -0.82, 0.02);
      proximalPivot.add(distalPin);

      const distalPivot = new THREE.Group();
      distalPivot.position.set(0, -0.82, 0.02);
      proximalPivot.add(distalPivot);

      const distalBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.68, 0.12),
        darkAlloyMat
      );
      distalBody.position.set(0, -0.34, -0.02);
      distalBody.castShadow = true;
      distalPivot.add(distalBody);

      const padGeo = new THREE.CapsuleGeometry(0.085, 0.34, 12, 24);
      const padMesh = new THREE.Mesh(padGeo, tactilePadMat);
      padMesh.position.set(0, -0.38, -0.09);
      padMesh.scale.set(1.0, 1.0, 0.65);
      padMesh.castShadow = true;
      distalPivot.add(padMesh);

      fingers.push({
        mountGroup,
        proximalPivot,
        distalPivot,
        padMesh,
        pistonMesh,
      });
    });

    // Pre-warm shaders
    renderer.compile(scene, camera);

    const triggerShatterAt = (originY: number, isImpactDrop: boolean) => {
      intactEggMesh.visible = false;
      crackLinesGroup.visible = false;
      shatterGroup.visible = true;
      yolkSplashGroup.visible = true;
      yolkSplashGroup.scale.setScalar(0.2);

      shards.forEach((s, idx) => {
        s.mesh.position
          .copy(s.baseOffset)
          .add(new THREE.Vector3(0, originY, 0));
        s.mesh.rotation.copy(s.baseRotation);

        const outward = s.baseOffset.clone().normalize();
        const speed = isImpactDrop
          ? 1.4 + (idx % 5) * 0.35
          : 2.2 + (idx % 6) * 0.45;
        s.velocity.set(
          outward.x * speed,
          (isImpactDrop ? 0.8 : 0.4) + (idx % 4) * 0.35,
          outward.z * speed
        );
        s.angularVelocity.set(
          (((idx * 17) % 10) - 5) * 1.8,
          (((idx * 23) % 10) - 5) * 1.8,
          (((idx * 31) % 10) - 5) * 1.8
        );
      });

      sfx.playEggCrack();
    };

    const performJegiKick = (grade: 'PERFECT' | 'GOOD') => {
      const s = simRef.current;
      s.jegiCombo += 1;
      if (s.jegiCombo > s.jegiBestCombo) {
        s.jegiBestCombo = s.jegiCombo;
      }
      s.jegiTimingGrade = grade;
      s.status = '제기 차올림! (Kick!)';
      s.jegiKickAnimTimer = 0.32;
      s.appliedForceN = grade === 'PERFECT' ? 8.8 : 7.4;

      const upwardSpeed = grade === 'PERFECT' ? 5.65 : 5.1;
      s.jegiVy = upwardSpeed;
      s.jegiVx = -s.jegiX * 0.85 + (Math.random() - 0.5) * 0.55;
      s.jegiVz = -s.jegiZ * 0.85 + (Math.random() - 0.5) * 0.55;

      s.jegiRotZ = (Math.random() - 0.5) * 0.7;
      s.jegiRotX = (Math.random() - 0.5) * 0.7;

      sfx.playJegiKick(s.jegiCombo);
    };

    const resetSceneEntities = () => {
      const s = simRef.current;
      s.phaseTimer = 0;
      s.handX = 0;
      s.handZ = 0;
      s.handRotX = 0;
      s.handRotZ = 0;
      s.eggY = EGG_REST_Y;
      s.eggVy = 0;
      s.eggRotX = 0;
      s.eggRotZ = 0;
      s.writingSegmentIdx = 0;
      s.writingSegmentTime = 0;
      s.writingProgress = 0;
      s.hasLastInkPoint = false;

      // Reset Jegi state
      s.jegiX = 0;
      s.jegiY = JEGI_FLOOR_Y;
      s.jegiZ = 0;
      s.jegiVx = 0;
      s.jegiVy = 0;
      s.jegiVz = 0;
      s.jegiRotX = 0;
      s.jegiRotZ = 0;
      s.jegiCombo = 0;
      s.jegiKickAnimTimer = 0;
      s.jegiFootTargetX = 0;
      s.jegiFootTargetZ = 0;
      s.jegiTimingGrade = 'READY';

      // Reset Needle Threading state (Right -> Left trajectory)
      s.needleTremorAmplitude = 1.0;
      s.needlePrecisionPct = 91.2;
      s.needleTremorUm = 118.4;
      s.needleProgressPct = 0;
      s.needleWireTipX = 0.19;
      s.needleWireTipY = NEEDLE_EYE_Y;
      s.needleWireTipZ = 0;
      s.needlePinchTightness = 0.25;
      s.needlePulseTimer = 0;
      successPulseMat.opacity = 0;

      intactEggMesh.visible = true;
      crackLinesGroup.visible = false;
      shatterGroup.visible = false;
      yolkSplashGroup.visible = false;
      eggGroup.position.set(0, EGG_REST_Y, 0);
      eggGroup.rotation.set(0, 0, 0);
      eggGroup.scale.set(1, 1, 1);

      paperPadSystem.resetPaper();
      clearInkRibbons();

      if (s.taskMode === 'pen') {
        eggWorkspaceGroup.visible = false;
        penWorkspaceGroup.visible = true;
        jegiWorkspaceGroup.visible = false;
        needleWorkspaceGroup.visible = false;
        handRoot.visible = true;
        s.phase = 'pen_acquiring';
        s.penHeldByHand = false;
        s.handX = -1.25;
        s.handY = 2.2;
        s.handZ = -0.22;
        s.currentGripClosure = 25;
        s.appliedForceN = 5.4;
        s.structuralIntegrity = 100;
        s.status = 'Pen Acquired';
      } else if (s.taskMode === 'jegi') {
        eggWorkspaceGroup.visible = false;
        penWorkspaceGroup.visible = false;
        jegiWorkspaceGroup.visible = true;
        needleWorkspaceGroup.visible = false;
        handRoot.visible = false;
        penAssembly.visible = false;
        s.phase = 'jegi_idle';
        s.penHeldByHand = false;
        s.appliedForceN = 0;
        s.structuralIntegrity = 100;
        s.status = '제기차기 대기 중';
        jegiModelGroup.position.set(0, JEGI_FLOOR_Y, 0);
        jegiModelGroup.rotation.set(0, 0, 0);
      } else if (s.taskMode === 'needle') {
        eggWorkspaceGroup.visible = false;
        penWorkspaceGroup.visible = false;
        jegiWorkspaceGroup.visible = false;
        needleWorkspaceGroup.visible = true;
        handRoot.visible = false; // Uses the dedicated Thumb & Index Finger Pinch Hand!
        penAssembly.visible = false;
        s.phase = 'needle_idle';
        s.penHeldByHand = false;
        s.currentGripClosure = 72;
        s.appliedForceN = 3.8;
        s.structuralIntegrity = 100;
        s.status = '바늘귀 조준 대기';
      } else {
        eggWorkspaceGroup.visible = true;
        penWorkspaceGroup.visible = false;
        jegiWorkspaceGroup.visible = false;
        needleWorkspaceGroup.visible = false;
        handRoot.visible = true;
        s.phase = 'idle';
        s.penHeldByHand = false;
        s.handY = 3.15;
        s.currentGripClosure = 0;
        s.appliedForceN = 0;
        s.structuralIntegrity = 100;
        s.status = 'Ready';
      }
    };

    // ========================================================================
    // 60FPS ANIMATION, KINEMATICS, PHYSICS & BCI OSCILLOSCOPE LOOP
    // ========================================================================
    const clock = new THREE.Clock();
    let animationFrameId = 0;
    let lastTelemetryPush = 0;
    const eegHistoryAlpha: number[] = new Array(140).fill(0);
    const eegHistoryBeta: number[] = new Array(140).fill(0);

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const rawDelta = clock.getDelta();
      const dt = Math.min(rawDelta, 0.05);
      const elapsed = clock.getElapsedTime();
      const s = simRef.current;

      // 1. Check Reset Request
      if (s.resetRequested) {
        s.resetRequested = false;
        resetSceneEntities();
      }

      // Ensure workspace visibility matches current taskMode
      if (s.taskMode === 'pen') {
        eggWorkspaceGroup.visible = false;
        penWorkspaceGroup.visible = true;
        jegiWorkspaceGroup.visible = false;
        needleWorkspaceGroup.visible = false;
        handRoot.visible = true;
      } else if (s.taskMode === 'jegi') {
        eggWorkspaceGroup.visible = false;
        penWorkspaceGroup.visible = false;
        jegiWorkspaceGroup.visible = true;
        needleWorkspaceGroup.visible = false;
        handRoot.visible = false;
        penAssembly.visible = false;
      } else if (s.taskMode === 'needle') {
        eggWorkspaceGroup.visible = false;
        penWorkspaceGroup.visible = false;
        jegiWorkspaceGroup.visible = false;
        needleWorkspaceGroup.visible = true;
        handRoot.visible = false; // Uses dedicated articulated Thumb & Index Finger Pinch Hand
        penAssembly.visible = false;
      } else {
        eggWorkspaceGroup.visible = true;
        penWorkspaceGroup.visible = false;
        jegiWorkspaceGroup.visible = false;
        needleWorkspaceGroup.visible = false;
        handRoot.visible = true;
      }

      // 2. Neural / BCI Signal Synthesis & Real-Time Decoding
      let alphaWave =
        Math.sin(elapsed * 9.5 * Math.PI * 2) * 12 +
        Math.sin(elapsed * 11.2 * Math.PI * 2) * 6;
      let betaAmplitude = 24;

      if (s.taskMode === 'needle') {
        const isCompensating =
          s.phase === 'needle_stabilizing' ||
          s.phase === 'needle_threading' ||
          s.phase === 'needle_success';
        alphaWave *= isCompensating ? 0.35 : 0.85;
        betaAmplitude = isCompensating
          ? 52 + Math.sin(elapsed * 3.5) * 2.5
          : 32 + Math.sin(elapsed * 12.0) * 11;
      } else if (s.taskMode === 'jegi') {
        const kickSpike = s.jegiKickAnimTimer > 0 ? 38 : 0;
        betaAmplitude = 42 + kickSpike + Math.sin(elapsed * 6.0) * 8;
        alphaWave *= 0.65;
      } else if (s.taskMode === 'pen') {
        if (s.phase === 'pen_writing') {
          alphaWave *= 0.55;
          betaAmplitude =
            58 +
            Math.sin(elapsed * 14.0) * 14 +
            Math.cos(elapsed * 23.0) * 9;
        } else {
          betaAmplitude = 36 + Math.sin(elapsed * 3.0) * 4;
        }
      } else if (s.bciActive) {
        s.bciAutoSequenceTime += dt;
        let decodedTargetGrip = s.targetGripStrength;
        if (s.bciPreset === 'optimal') {
          betaAmplitude = 44 + Math.sin(elapsed * 2.2) * 5;
          decodedTargetGrip = 50 + Math.sin(elapsed * 1.9) * 6;
        } else if (s.bciPreset === 'weak') {
          betaAmplitude = 15 + Math.sin(elapsed * 1.8) * 3;
          decodedTargetGrip = 18 + Math.sin(elapsed * 2.1) * 4;
        } else if (s.bciPreset === 'overgrip') {
          betaAmplitude = 82 + Math.sin(elapsed * 4.0) * 10;
          decodedTargetGrip = 84 + Math.sin(elapsed * 3.2) * 6;
        } else if (s.bciPreset === 'oscillating') {
          const wave = Math.sin(elapsed * 0.95);
          decodedTargetGrip = THREE.MathUtils.clamp(50 + wave * 34, 12, 88);
          betaAmplitude = decodedTargetGrip * 0.95;
        }
        s.targetGripStrength = Math.round(decodedTargetGrip);
      } else {
        betaAmplitude = 14 + s.targetGripStrength * 0.68;
      }

      const betaWave =
        Math.sin(elapsed * 21.0 * Math.PI * 2) * (betaAmplitude * 0.45) +
        Math.cos(elapsed * 26.5 * Math.PI * 2) * (betaAmplitude * 0.35);

      eegHistoryAlpha.push(alphaWave);
      eegHistoryAlpha.shift();
      eegHistoryBeta.push(betaWave);
      eegHistoryBeta.shift();

      // Render 2D EEG Oscilloscope Canvas
      const eegCanvas = eegCanvasRef.current;
      if (eegCanvas) {
        const ctx = eegCanvas.getContext('2d');
        if (ctx) {
          const cw = eegCanvas.width;
          const ch = eegCanvas.height;
          ctx.fillStyle = '#090D14';
          ctx.fillRect(0, 0, cw, ch);

          ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
          ctx.lineWidth = 1;
          const y70 = ch - 0.7 * ch;
          const y30 = ch - 0.3 * ch;
          ctx.beginPath();
          ctx.moveTo(0, y70);
          ctx.lineTo(cw, y70);
          ctx.moveTo(0, y30);
          ctx.lineTo(cw, y30);
          ctx.stroke();

          ctx.fillStyle = 'rgba(16, 185, 129, 0.05)';
          ctx.fillRect(0, y70, cw, y30 - y70);

          // Alpha Wave
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          for (let i = 0; i < eegHistoryAlpha.length; i++) {
            const x = (i / (eegHistoryAlpha.length - 1)) * cw;
            const y = ch * 0.72 + eegHistoryAlpha[i] * 0.55;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Beta Wave
          const currentGrip = s.targetGripStrength;
          ctx.strokeStyle =
            s.taskMode === 'needle' || s.taskMode === 'jegi'
              ? '#10B981'
              : s.taskMode === 'pen'
              ? '#38BDF8'
              : currentGrip > 70
              ? '#F43F5E'
              : currentGrip < 30
              ? '#F59E0B'
              : '#10B981';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          for (let i = 0; i < eegHistoryBeta.length; i++) {
            const x = (i / (eegHistoryBeta.length - 1)) * cw;
            const y = ch * 0.36 + eegHistoryBeta[i] * 0.45;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      // ======================================================================
      // 3. STATE MACHINE BY MODE: NEEDLE vs JEGICHAGI vs PEN & WRITE vs EGG
      // ======================================================================
      if (s.taskMode === 'needle') {
        // Check if user clicked "[바늘귀 통과 시작]"
        if (s.triggerNeedleStartRequested) {
          s.triggerNeedleStartRequested = false;
          s.phase = 'needle_stabilizing';
          s.phaseTimer = 0;
          s.needleTremorAmplitude = 1.0;
          s.needleWireTipX = 0.19;
          s.needlePinchTightness = 0.25;
          s.needleProgressPct = 0;
          s.needlePulseTimer = 0;
          s.status = 'BCI 손떨림 보정 중...';
          sfx.playServoEngage();
        }

        s.phaseTimer += dt;
        s.appliedForceN = 3.8;

        let fingerPushExtension = 0; // 0..1 controls subtle distal phalanx feeding motion

        if (s.phase === 'needle_idle') {
          // Uncompensated physiological hand tremor (~118 μm) while waiting on the right side of the needle eye
          s.needleTremorAmplitude = THREE.MathUtils.damp(
            s.needleTremorAmplitude,
            1.0,
            4.0,
            dt
          );
          s.needleWireTipX = THREE.MathUtils.damp(
            s.needleWireTipX,
            0.19,
            5.0,
            dt
          );
          s.needlePinchTightness = THREE.MathUtils.damp(
            s.needlePinchTightness,
            0.35 + Math.sin(elapsed * 4.0) * 0.08,
            5.0,
            dt
          );
          s.needlePrecisionPct = 91.0 + Math.sin(elapsed * 7.0) * 1.4;
          s.needleTremorUm = 115 + Math.sin(elapsed * 11.0) * 14;
          s.needleProgressPct = 0;
        } else if (s.phase === 'needle_stabilizing') {
          // Phase 1 (0 ~ 1.25s): Thumb & Index fingers gently firm up their precision pinch and cancel tremor
          s.status = 'BCI 손떨림 보정 중...';
          s.needleTremorAmplitude = THREE.MathUtils.damp(
            s.needleTremorAmplitude,
            0.012,
            4.2,
            dt
          );
          s.needlePinchTightness = THREE.MathUtils.damp(
            s.needlePinchTightness,
            0.92,
            5.5,
            dt
          );
          s.needleWireTipX = THREE.MathUtils.damp(
            s.needleWireTipX,
            0.13,
            3.8,
            dt
          );

          const filterRatio = 1 - s.needleTremorAmplitude;
          s.needlePrecisionPct = Number(
            (91.2 + filterRatio * 8.6).toFixed(1)
          );
          s.needleTremorUm = Number(
            Math.max(1.6, 118.4 * s.needleTremorAmplitude).toFixed(1)
          );
          s.needleProgressPct = Math.min(
            35,
            Math.round((s.phaseTimer / 1.25) * 35)
          );

          if (s.phaseTimer >= 1.25) {
            s.phase = 'needle_threading';
            s.phaseTimer = 0;
            s.status = '바늘귀 정밀 관통 중...';
            sfx.playPenStrokeTick();
          }
        } else if (s.phase === 'needle_threading') {
          // Phase 2: Thumb & Index fingers smoothly push the copper enamel wire from RIGHT (+0.13) to LEFT (-0.24) through the needle eye (x=0)
          s.status = '바늘귀 정밀 관통 중...';
          s.needleTremorAmplitude = THREE.MathUtils.damp(
            s.needleTremorAmplitude,
            0.006,
            6.0,
            dt
          );
          s.needlePinchTightness = 1.0;
          s.needlePrecisionPct = 99.8;
          s.needleTremorUm = 1.5;

          const threadDuration = 1.95;
          const u = Math.min(1, s.phaseTimer / threadDuration);
          const smoothU = THREE.MathUtils.smoothstep(u, 0, 1);
          s.needleWireTipX = THREE.MathUtils.lerp(0.13, -0.24, smoothU);
          fingerPushExtension = smoothU;
          s.needleProgressPct = Math.round(35 + smoothU * 65);

          if (u >= 1) {
            s.phase = 'needle_success';
            s.phaseTimer = 0;
            s.needleProgressPct = 100;
            s.needlePrecisionPct = 99.8;
            s.needleTremorUm = 1.4;
            s.needlePulseTimer = 1.0;
            s.status = 'Threading Success! (정밀도 99.8%)';
            sfx.playSuccessChime();
          }
        } else if (s.phase === 'needle_success') {
          s.status = 'Threading Success! (정밀도 99.8%)';
          s.needlePrecisionPct = 99.8;
          s.needleTremorUm = 1.4;
          s.needleProgressPct = 100;
          s.needleTremorAmplitude = 0.006;
          s.needlePinchTightness = 1.0;
          fingerPushExtension = 1.0;
        }

        // Compute high-frequency micro-tremor offset in Y and Z scaled by needleTremorAmplitude
        const tremorY =
          (Math.sin(elapsed * 37.0) * 0.018 +
            Math.cos(elapsed * 53.0) * 0.011) *
          s.needleTremorAmplitude;
        const tremorZ =
          (Math.cos(elapsed * 41.0) * 0.018 +
            Math.sin(elapsed * 61.0) * 0.011) *
          s.needleTremorAmplitude;

        s.needleWireTipY = NEEDLE_EYE_Y + tremorY;
        s.needleWireTipZ = tremorZ;

        // Position the Copper Enamel Wire + Robotic Pinch Fingers / Precision Tweezers Group
        enamelWireAndPinchGroup.position.set(
          s.needleWireTipX,
          s.needleWireTipY,
          s.needleWireTipZ
        );

        // Continuously link the grounded right micro-stage carriage to the moving robotic wrist (zero per-frame allocations)
        const wristAnchorX = s.needleWireTipX + 0.21 + 0.42 + 0.16;
        const stageAnchorX = manipulatorBaseX - 0.08;
        const rodSpan = Math.max(0.08, stageAnchorX - wristAnchorX);
        actuatorRodMesh.position.set(
          (wristAnchorX + stageAnchorX) * 0.5,
          s.needleWireTipY + 0.01,
          s.needleWireTipZ - 0.03
        );
        actuatorRodMesh.scale.set(rodSpan, 1, 1);

        // Animate Articulated Index Finger (MCP, PIP, DIP) & Opposable Thumb (MCP, IP) with Precision Micro-Tweezers
        const pinchClose = s.needlePinchTightness * 0.06;
        const feedRoll = fingerPushExtension * 0.08;

        indexMcpPivot.rotation.z = -0.34 - pinchClose * 0.5 + feedRoll * 0.35;
        indexPipPivot.rotation.z = 0.64 - pinchClose * 0.35 - feedRoll * 0.45;
        indexDipPivot.rotation.z = -0.28 + pinchClose * 0.8 + feedRoll * 0.25;

        thumbMcpPivot.rotation.z = 0.36 + pinchClose * 0.5 - feedRoll * 0.35;
        thumbIpPivot.rotation.z = -0.4 + pinchClose * 0.4 + feedRoll * 0.35;

        // Fingertip Tactile Sensor Pad color feedback & 3D Threading Success Visual Effects
        if (s.phase === 'needle_success') {
          fingertipSensorMat.color.setHex(0x10b981);
          fingertipSensorMat.emissive.setHex(0x059669);
          eyeReticleMat.color.setHex(0x10b981);
          eyeReticleMat.opacity = 0.88;

          // Staggered dual expanding emerald pulse rings
          const pulseWave1 = (elapsed * 1.35) % 1;
          successPulseRing.scale.setScalar(1.0 + pulseWave1 * 2.3);
          successPulseMat.opacity = (1.0 - pulseWave1) * 0.78;

          const pulseWave2 = (elapsed * 1.35 + 0.5) % 1;
          successPulseRing2.scale.setScalar(1.0 + pulseWave2 * 2.1);
          successPulseMat2.opacity = (1.0 - pulseWave2) * 0.65;

          // Radiant 24-particle emerald sparkle burst around the needle eye
          const sparkLoop = Math.min(1, s.phaseTimer * 0.75);
          const sparkCycle =
            s.phaseTimer < 1.35 ? sparkLoop : (elapsed * 0.65) % 1;
          successSparkMesh.visible = true;
          sparkMat.opacity = Math.sin(sparkCycle * Math.PI) * 0.92;
          const sparkSize = 0.55 + (1 - sparkCycle) * 0.75;
          for (let i = 0; i < SPARK_COUNT; i++) {
            const d = sparkDirs[i];
            const dist = 0.05 + sparkCycle * d.speed;
            _sparkPos.set(
              d.dx * dist,
              NEEDLE_EYE_Y + d.dy * dist,
              d.dz * dist
            );
            _sparkEuler.set(elapsed * 3.5 + i, elapsed * 2.4 + i, 0);
            _sparkQuat.setFromEuler(_sparkEuler);
            _sparkScale.setScalar(sparkSize);
            _sparkMatrix.compose(_sparkPos, _sparkQuat, _sparkScale);
            successSparkMesh.setMatrixAt(i, _sparkMatrix);
          }
          successSparkMesh.instanceMatrix.needsUpdate = true;
        } else if (
          s.phase === 'needle_threading' ||
          s.phase === 'needle_stabilizing'
        ) {
          fingertipSensorMat.color.setHex(0x38bdf8);
          fingertipSensorMat.emissive.setHex(0x0284c7);
          eyeReticleMat.color.setHex(0x38bdf8);
          eyeReticleMat.opacity = 0.78;
          successPulseMat.opacity = 0;
          successPulseMat2.opacity = 0;
          successSparkMesh.visible = false;
        } else {
          fingertipSensorMat.color.setHex(0xf59e0b);
          fingertipSensorMat.emissive.setHex(0xb45309);
          eyeReticleMat.color.setHex(0xf59e0b);
          eyeReticleMat.opacity = 0.45;
          successPulseMat.opacity = 0;
          successPulseMat2.opacity = 0;
          successSparkMesh.visible = false;
        }
      } else if (s.taskMode === 'jegi') {
        if (s.triggerJegiStartRequested) {
          s.triggerJegiStartRequested = false;
          s.jegiCombo = 0;
          s.jegiX = 0;
          s.jegiY = 0.68;
          s.jegiZ = 0;
          s.phase = 'jegi_rally';
          performJegiKick('PERFECT');
        }

        if (s.triggerJegiManualKickRequested) {
          s.triggerJegiManualKickRequested = false;
          s.jegiKickAnimTimer = 0.32;
          if (
            s.phase === 'jegi_rally' &&
            s.jegiY >= 0.25 &&
            s.jegiY <= 1.45 &&
            s.jegiVy <= 1.2
          ) {
            const isPerfect = s.jegiY >= 0.45 && s.jegiY <= 0.95;
            performJegiKick(isPerfect ? 'PERFECT' : 'GOOD');
          } else {
            sfx.playServoEngage();
          }
        }

        if (s.jegiKickAnimTimer > 0) {
          s.jegiKickAnimTimer = Math.max(0, s.jegiKickAnimTimer - dt);
        } else {
          s.appliedForceN = THREE.MathUtils.damp(s.appliedForceN, 0, 6.0, dt);
        }

        if (s.phase === 'jegi_rally') {
          const gravity = 9.81;
          const airDragCoeff = s.jegiVy < 0 ? 0.58 : 0.14;
          const ay = -gravity - airDragCoeff * s.jegiVy * Math.abs(s.jegiVy);

          s.jegiVy += ay * dt;
          s.jegiY += s.jegiVy * dt;
          s.jegiX += s.jegiVx * dt;
          s.jegiZ += s.jegiVz * dt;

          s.jegiVx *= 1 - 0.8 * dt;
          s.jegiVz *= 1 - 0.8 * dt;

          s.jegiRotX = THREE.MathUtils.damp(
            s.jegiRotX,
            s.jegiVz * 0.18,
            6.5,
            dt
          );
          s.jegiRotZ = THREE.MathUtils.damp(
            s.jegiRotZ,
            -s.jegiVx * 0.18,
            6.5,
            dt
          );
          s.jegiSpinY += dt * 3.8;

          if (s.jegiVy < -0.2 && s.jegiKickAnimTimer <= 0.05) {
            s.status = '공중 체공 중...';
          }

          if (
            s.jegiAutoRally &&
            s.jegiVy < 0 &&
            s.jegiY <= 0.72 &&
            s.jegiY >= 0.35 &&
            s.jegiKickAnimTimer === 0
          ) {
            performJegiKick('PERFECT');
          }

          if (s.jegiY <= JEGI_FLOOR_Y) {
            s.jegiY = JEGI_FLOOR_Y;
            s.jegiVy = 0;
            s.jegiVx = 0;
            s.jegiVz = 0;
            s.jegiRotX = 0.25;
            s.jegiRotZ = -0.18;
            s.phase = 'jegi_dropped';
            s.status = '제기 바닥에 떨어짐!';
            s.jegiTimingGrade = 'MISS';
            sfx.playServoEngage();
          }
        } else if (s.phase === 'jegi_idle') {
          s.jegiY = JEGI_FLOOR_Y;
          s.jegiRotX = THREE.MathUtils.damp(s.jegiRotX, 0, 6.0, dt);
          s.jegiRotZ = THREE.MathUtils.damp(s.jegiRotZ, 0, 6.0, dt);
        }

        jegiModelGroup.position.set(s.jegiX, s.jegiY, s.jegiZ);
        jegiModelGroup.rotation.set(s.jegiRotX, s.jegiSpinY, s.jegiRotZ);

        const velocityFlare = THREE.MathUtils.clamp(
          -s.jegiVy * 0.085,
          -0.22,
          0.38
        );
        hanjiStrips.forEach((strip) => {
          const flutter =
            Math.abs(s.jegiVy) > 0.2
              ? Math.sin(elapsed * 26.0 + strip.phaseOffset) * 0.06
              : Math.sin(elapsed * 3.0 + strip.phaseOffset) * 0.012;
          strip.pivot.rotation.x =
            strip.baseFlareAngle + velocityFlare + flutter;
        });

        s.jegiFootTargetX = THREE.MathUtils.damp(
          s.jegiFootTargetX,
          s.jegiX,
          12.0,
          dt
        );
        s.jegiFootTargetZ = THREE.MathUtils.damp(
          s.jegiFootTargetZ,
          s.jegiZ,
          12.0,
          dt
        );

        roboticLegRoot.position.x = 1.22 + s.jegiFootTargetX * 0.65;
        roboticLegRoot.position.z = s.jegiFootTargetZ * 0.85;

        const kickPhase =
          s.jegiKickAnimTimer > 0
            ? Math.sin((s.jegiKickAnimTimer / 0.32) * Math.PI)
            : 0;

        hipPivotGroup.rotation.z = -0.12 - kickPhase * 0.42;
        kneePivotGroup.rotation.z = 0.22 - kickPhase * 0.36;
        anklePivotGroup.rotation.z = 0.08 + kickPhase * 0.55;

        const inStrikeWindow =
          s.phase === 'jegi_rally' && s.jegiY >= 0.4 && s.jegiY <= 1.05;
        strikeZoneRing.position.x = s.jegiX;
        strikeZoneRing.position.z = s.jegiZ;
        strikeZoneRingMat.color.setHex(
          s.jegiKickAnimTimer > 0
            ? 0x10b981
            : inStrikeWindow
            ? 0xf59e0b
            : 0x38bdf8
        );
        strikeZoneRingMat.opacity =
          s.jegiKickAnimTimer > 0 ? 0.75 : inStrikeWindow ? 0.55 : 0.28;

        const heightAboveFloor = Math.max(0, s.jegiY - JEGI_FLOOR_Y);
        jegiShadowMesh.position.x = s.jegiX;
        jegiShadowMesh.position.z = s.jegiZ;
        jegiShadowMesh.material.opacity = Math.max(
          0.15,
          0.72 - heightAboveFloor * 0.25
        );
        const jShadowScale = 1.0 + heightAboveFloor * 0.3;
        jegiShadowMesh.scale.set(jShadowScale, jShadowScale, 1);
      } else if (s.taskMode === 'pen') {
        // ====================================================================
        // PEN & WRITE MODE STATE MACHINE
        // ====================================================================
        if (s.triggerWriteRequested) {
          s.triggerWriteRequested = false;
          paperPadSystem.resetPaper();
          clearInkRibbons();
          s.writingSegmentIdx = 0;
          s.writingSegmentTime = 0;
          s.writingProgress = 0;
          s.hasLastInkPoint = false;
          s.penHeldByHand = true;
          s.phase = 'pen_writing';
          s.status = "Drawing 'Y'";
          sfx.playPenStrokeTick();
        }

        s.phaseTimer += dt;

        if (s.phase === 'pen_acquiring') {
          s.status = 'Pen Acquired';
          if (s.phaseTimer < 0.55) {
            s.handX = THREE.MathUtils.damp(s.handX, -1.55, 7.5, dt);
            s.handY = THREE.MathUtils.damp(s.handY, 1.55, 7.5, dt);
            s.handZ = THREE.MathUtils.damp(s.handZ, -0.25, 7.5, dt);
            s.currentGripClosure = THREE.MathUtils.damp(
              s.currentGripClosure,
              64,
              7.0,
              dt
            );
          } else {
            s.penHeldByHand = true;
            s.phase = 'pen_ready';
            s.phaseTimer = 0;
          }
        } else if (s.phase === 'pen_ready') {
          s.penHeldByHand = true;
          s.status = 'Pen Acquired';
          s.handX = THREE.MathUtils.damp(s.handX, -0.35, 5.5, dt);
          s.handY = THREE.MathUtils.damp(s.handY, 1.82, 5.5, dt);
          s.handZ = THREE.MathUtils.damp(s.handZ, -0.1, 5.5, dt);
          s.handRotZ = THREE.MathUtils.damp(s.handRotZ, 0.08, 5.5, dt);
          s.handRotX = THREE.MathUtils.damp(s.handRotX, 0.06, 5.5, dt);
          s.currentGripClosure = THREE.MathUtils.damp(
            s.currentGripClosure,
            66,
            6.0,
            dt
          );
          s.appliedForceN = 5.8;
          s.structuralIntegrity = 100;
        } else if (s.phase === 'pen_writing') {
          s.penHeldByHand = true;
          s.currentGripClosure = THREE.MathUtils.damp(
            s.currentGripClosure,
            68,
            8.0,
            dt
          );
          s.appliedForceN = 6.2 + Math.sin(elapsed * 18.0) * 0.35;

          const seg = YES_WRITING_SEGMENTS[s.writingSegmentIdx];
          if (!seg) {
            s.phase = 'pen_completed';
            s.status = 'Writing Completed!';
            s.writingProgress = 100;
            sfx.playSuccessChime();
          } else {
            const nextStatus: SimStatus =
              seg.letter === 'Y'
                ? "Drawing 'Y'"
                : seg.letter === 'E'
                ? "Drawing 'E'"
                : "Drawing 'S'";
            if (s.status !== nextStatus) {
              s.status = nextStatus;
              sfx.playPenStrokeTick();
            }

            s.writingSegmentTime += dt;
            const localProgress = Math.min(
              1,
              s.writingSegmentTime / seg.duration
            );
            const targetPt = evaluatePolyline(seg.points, localProgress);

            s.writingProgress = Math.round(
              ((s.writingSegmentIdx + localProgress) /
                YES_WRITING_SEGMENTS.length) *
                100
            );

            const desiredTipY = seg.penDown
              ? PAPER_SURFACE_Y + 0.002
              : PAPER_SURFACE_Y + 0.22;

            s.handX = THREE.MathUtils.damp(s.handX, targetPt.x, 22.0, dt);
            s.handZ = THREE.MathUtils.damp(s.handZ, targetPt.z, 22.0, dt);
            s.handY = THREE.MathUtils.damp(
              s.handY,
              desiredTipY + 1.42,
              20.0,
              dt
            );

            s.handRotZ = THREE.MathUtils.damp(
              s.handRotZ,
              0.09 + Math.cos(elapsed * 10) * 0.015,
              10.0,
              dt
            );
            s.handRotX = THREE.MathUtils.damp(
              s.handRotX,
              0.08 + Math.sin(elapsed * 10) * 0.015,
              10.0,
              dt
            );

            if (seg.penDown) {
              const tipX = s.handX;
              const tipZ = s.handZ;
              if (s.hasLastInkPoint) {
                const moveDist = Math.hypot(
                  tipX - s.lastInkX,
                  tipZ - s.lastInkZ
                );
                if (moveDist > 0.004) {
                  paperPadSystem.drawInkStroke(
                    s.lastInkX,
                    s.lastInkZ,
                    tipX,
                    tipZ
                  );
                  add3DInkSegment(s.lastInkX, s.lastInkZ, tipX, tipZ);
                  s.lastInkX = tipX;
                  s.lastInkZ = tipZ;
                }
              } else {
                s.lastInkX = tipX;
                s.lastInkZ = tipZ;
                s.hasLastInkPoint = true;
              }
            } else {
              s.hasLastInkPoint = false;
            }

            if (localProgress >= 1) {
              s.writingSegmentIdx += 1;
              s.writingSegmentTime = 0;
              s.hasLastInkPoint = false;
              if (s.writingSegmentIdx < YES_WRITING_SEGMENTS.length) {
                if (YES_WRITING_SEGMENTS[s.writingSegmentIdx].penDown) {
                  sfx.playPenStrokeTick();
                }
              }
            }
          }
        } else if (s.phase === 'pen_completed') {
          s.status = 'Writing Completed!';
          s.penHeldByHand = true;
          s.handX = THREE.MathUtils.damp(s.handX, 0.85, 4.5, dt);
          s.handY = THREE.MathUtils.damp(s.handY, 2.35, 4.5, dt);
          s.handZ = THREE.MathUtils.damp(s.handZ, -0.55, 4.5, dt);
          s.handRotZ = THREE.MathUtils.damp(s.handRotZ, 0.12, 4.5, dt);
          s.handRotX = THREE.MathUtils.damp(s.handRotX, 0.05, 4.5, dt);
          s.appliedForceN = THREE.MathUtils.damp(s.appliedForceN, 5.4, 5.0, dt);
        }

        penAssembly.visible = true;
        if (s.penHeldByHand) {
          penAssembly.position.set(s.handX, s.handY - 1.42, s.handZ);
          penAssembly.rotation.set(s.handRotX, 0, s.handRotZ);
        } else {
          penAssembly.position.set(-1.55, 0.16, -0.25);
          penAssembly.rotation.set(0.08, 0, -0.22);
        }
      } else {
        // ====================================================================
        // EGG GRASP MODE STATE MACHINE
        // ====================================================================
        penAssembly.visible = false;
        s.handX = THREE.MathUtils.damp(s.handX, 0, 6.0, dt);
        s.handZ = THREE.MathUtils.damp(s.handZ, 0, 6.0, dt);
        s.handRotX = THREE.MathUtils.damp(s.handRotX, 0, 6.0, dt);
        s.handRotZ = THREE.MathUtils.damp(s.handRotZ, 0, 6.0, dt);

        if (s.triggerGraspRequested) {
          s.triggerGraspRequested = false;
          if (s.phase === 'idle' || s.phase === 'holding') {
            s.phase = 'descending';
            s.phaseTimer = 0;
            s.status = 'Grasping...';
          }
        }

        s.phaseTimer += dt;

        if (s.phase === 'idle') {
          s.handY = THREE.MathUtils.damp(s.handY, 3.15, 5.5, dt);
          s.currentGripClosure = THREE.MathUtils.damp(
            s.currentGripClosure,
            12,
            6.0,
            dt
          );
          s.appliedForceN = THREE.MathUtils.damp(s.appliedForceN, 0, 8.0, dt);
          s.structuralIntegrity = THREE.MathUtils.damp(
            s.structuralIntegrity,
            100,
            6.0,
            dt
          );
          s.eggY = EGG_REST_Y;
          s.eggRotX = THREE.MathUtils.damp(s.eggRotX, 0, 6.0, dt);
          s.eggRotZ = THREE.MathUtils.damp(s.eggRotZ, 0, 6.0, dt);
        } else if (s.phase === 'descending') {
          s.status = 'Grasping...';
          s.currentGripClosure = THREE.MathUtils.damp(
            s.currentGripClosure,
            8,
            7.0,
            dt
          );
          s.handY = THREE.MathUtils.damp(s.handY, 1.48, 5.5, dt);
          if (Math.abs(s.handY - 1.48) < 0.03) {
            s.phase = 'closing';
            s.phaseTimer = 0;
            sfx.playServoEngage();
          }
        } else if (s.phase === 'closing') {
          s.status = 'Grasping...';
          const desiredClosure = s.targetGripStrength;
          s.currentGripClosure = THREE.MathUtils.damp(
            s.currentGripClosure,
            desiredClosure,
            5.2,
            dt
          );

          const contactEngagement = Math.max(
            0,
            (s.currentGripClosure - 12) / 88
          );
          s.appliedForceN =
            (s.currentGripClosure / 100) *
            MAX_FORCE_NEWTONS *
            (contactEngagement > 0 ? 1 : 0.15);

          if (s.currentGripClosure > 70) {
            s.structuralIntegrity = 0;
            s.status = 'Egg Broken!';
            s.phase = 'shattered';
            triggerShatterAt(s.eggY, false);
          } else {
            const strain =
              s.currentGripClosure <= 50
                ? (s.currentGripClosure / 50) * 6
                : 6 + ((s.currentGripClosure - 50) / 20) * 58;
            s.structuralIntegrity = Math.max(0, 100 - strain);

            if (
              Math.abs(s.currentGripClosure - desiredClosure) < 1.2 ||
              s.phaseTimer > 0.85
            ) {
              s.phase = 'lifting';
              s.phaseTimer = 0;
            }
          }
        } else if (s.phase === 'lifting' || s.phase === 'holding') {
          s.currentGripClosure = THREE.MathUtils.damp(
            s.currentGripClosure,
            s.targetGripStrength,
            6.0,
            dt
          );
          s.appliedForceN = (s.currentGripClosure / 100) * MAX_FORCE_NEWTONS;

          if (s.currentGripClosure > 70) {
            s.structuralIntegrity = 0;
            s.status = 'Egg Broken!';
            s.phase = 'shattered';
            triggerShatterAt(s.eggY, false);
          } else {
            const strain =
              s.currentGripClosure <= 50
                ? (s.currentGripClosure / 50) * 6
                : 6 + ((s.currentGripClosure - 50) / 20) * 58;
            s.structuralIntegrity = Math.max(0, 100 - strain);

            s.handY = THREE.MathUtils.damp(s.handY, 3.05, 3.2, dt);
            const handDeltaY = s.handY - 1.48;

            if (s.currentGripClosure < 30) {
              if (handDeltaY < 0.42 && s.phase === 'lifting') {
                s.eggY = EGG_REST_Y + handDeltaY * 0.55;
                s.eggRotZ = Math.sin(elapsed * 28) * 0.09;
                s.eggRotX = Math.cos(elapsed * 24) * 0.06;
              } else {
                s.phase = 'slipping';
                s.eggVy = -0.35;
                s.status = 'Egg Dropped!';
              }
            } else {
              s.eggY = EGG_REST_Y + handDeltaY;
              s.eggRotZ = THREE.MathUtils.damp(s.eggRotZ, 0, 8.0, dt);
              s.eggRotX = THREE.MathUtils.damp(s.eggRotX, 0, 8.0, dt);

              if (s.handY >= 2.88 && s.phase !== 'holding') {
                s.phase = 'holding';
                s.status = 'Successfully Lifted!';
                sfx.playSuccessChime();
              }
            }
          }
        } else if (s.phase === 'slipping') {
          s.status = 'Egg Dropped!';
          s.handY = THREE.MathUtils.damp(s.handY, 3.05, 3.5, dt);
          s.appliedForceN = THREE.MathUtils.damp(s.appliedForceN, 0.2, 8.0, dt);

          s.eggVy -= 9.81 * 1.35 * dt;
          s.eggY += s.eggVy * dt;
          s.eggRotZ += 2.6 * dt;
          s.eggRotX += 1.4 * dt;

          if (s.eggY <= EGG_REST_Y) {
            s.eggY = EGG_REST_Y;
            s.structuralIntegrity = 0;
            s.phase = 'dropped';
            triggerShatterAt(EGG_REST_Y, true);
          }
        } else if (s.phase === 'dropped' || s.phase === 'shattered') {
          yolkSplashGroup.scale.setScalar(
            THREE.MathUtils.damp(yolkSplashGroup.scale.x, 1.0, 7.5, dt)
          );

          shards.forEach((shard) => {
            shard.velocity.y -= 9.81 * 1.4 * dt;
            shard.mesh.position.addScaledVector(shard.velocity, dt);
            shard.mesh.rotation.x += shard.angularVelocity.x * dt;
            shard.mesh.rotation.y += shard.angularVelocity.y * dt;
            shard.mesh.rotation.z += shard.angularVelocity.z * dt;

            const minY = 0.16;
            if (shard.mesh.position.y < minY) {
              shard.mesh.position.y = minY;
              shard.velocity.y *= -0.28;
              shard.velocity.x *= 0.72;
              shard.velocity.z *= 0.72;
              shard.angularVelocity.multiplyScalar(0.68);
            }
          });
        }
      }

      // 5. Update Overhead 3D Robotic Hand & Finger Kinematics
      handRoot.position.set(s.handX, s.handY, s.handZ);
      handRoot.rotation.set(s.handRotX, 0, s.handRotZ);

      const isPrecisionPinch = s.taskMode === 'pen' && s.penHeldByHand;
      const visualClamp = Math.min(s.currentGripClosure, 76) / 100;
      const proxAngle = isPrecisionPinch ? 0.24 : -0.32 + visualClamp * 0.62;
      const distAngle = isPrecisionPinch ? 0.56 : 0.26 + visualClamp * 0.54;

      fingers.forEach((f) => {
        f.proximalPivot.rotation.x = proxAngle;
        f.distalPivot.rotation.x = distAngle;
        const squish =
          s.currentGripClosure >= 30 &&
          (s.phase === 'closing' ||
            s.phase === 'lifting' ||
            s.phase === 'holding' ||
            isPrecisionPinch)
            ? Math.min(0.28, (s.currentGripClosure - 25) * 0.005)
            : 0;
        f.padMesh.scale.set(1.0 + squish * 0.4, 1.0, 0.65 - squish);
      });

      // Update Force-Torque Sensor Ring LED Color
      if (
        s.status === 'Egg Broken!' ||
        s.status === 'Egg Dropped!' ||
        s.status === '제기 바닥에 떨어짐!'
      ) {
        sensorRingMat.color.setHex(0xf43f5e);
        sensorRingMat.emissive.setHex(0xf43f5e);
      } else if (s.taskMode === 'pen') {
        sensorRingMat.color.setHex(0x38bdf8);
        sensorRingMat.emissive.setHex(0x38bdf8);
      } else if (s.taskMode === 'jegi' || s.taskMode === 'needle') {
        sensorRingMat.color.setHex(0x10b981);
        sensorRingMat.emissive.setHex(0x10b981);
      } else if (s.currentGripClosure > 70) {
        sensorRingMat.color.setHex(0xf43f5e);
        sensorRingMat.emissive.setHex(0xf43f5e);
      } else if (s.currentGripClosure < 30 && s.phase !== 'idle') {
        sensorRingMat.color.setHex(0xf59e0b);
        sensorRingMat.emissive.setHex(0xf59e0b);
      } else {
        sensorRingMat.color.setHex(0x10b981);
        sensorRingMat.emissive.setHex(0x10b981);
      }

      // 6. Update Egg Position, Pre-Fracture Micro-Cracks & Contact Shadow
      eggGroup.position.y = s.eggY;
      eggGroup.rotation.set(s.eggRotX, 0, s.eggRotZ);

      const showStressCracks =
        intactEggMesh.visible &&
        s.currentGripClosure >= 58 &&
        (s.phase === 'closing' ||
          s.phase === 'lifting' ||
          s.phase === 'holding');
      crackLinesGroup.visible = showStressCracks;

      const elasticSqueeze =
        intactEggMesh.visible &&
        (s.phase === 'closing' ||
          s.phase === 'lifting' ||
          s.phase === 'holding')
          ? Math.max(0, (s.currentGripClosure - 30) * 0.0009)
          : 0;
      eggGroup.scale.set(
        1.0 - elasticSqueeze,
        1.0 + elasticSqueeze * 0.6,
        1.0 - elasticSqueeze
      );

      const heightAboveRest = Math.max(0, s.eggY - EGG_REST_Y);
      contactShadowMesh.material.opacity = intactEggMesh.visible
        ? Math.max(0.18, 0.75 - heightAboveRest * 0.28)
        : 0.35;
      const shadowScale = 1.0 + heightAboveRest * 0.35;
      contactShadowMesh.scale.set(shadowScale, shadowScale, 1);

      // 7. Smooth Camera Preset Interpolation
      if (s.cameraTransitionTimer > 0) {
        s.cameraTransitionTimer -= dt;
        if (s.cameraPreset === 'macro') {
          // Ultra-Close Needle Eye Macro View centered on the open needle eye & copper wire tip
          _camTargetPos.set(0.08, NEEDLE_EYE_Y + 0.025, 0.56);
          _camLookTarget.set(0.04, NEEDLE_EYE_Y, 0);
        } else if (s.cameraPreset === 'studio') {
          if (s.taskMode === 'pen') {
            _camTargetPos.set(0.0, 3.85, 4.15);
            _camLookTarget.set(0, 0.45, 0.05);
          } else if (s.taskMode === 'jegi') {
            _camTargetPos.set(0.2, 2.75, 4.95);
            _camLookTarget.set(0.15, 1.15, 0);
          } else if (s.taskMode === 'needle') {
            // Centered Workspace View showing the floor stand, vertical needle eye & robotic tweezers/fingers
            _camTargetPos.set(0.32, NEEDLE_EYE_Y + 0.24, 1.72);
            _camLookTarget.set(0.14, NEEDLE_EYE_Y - 0.14, 0);
          } else {
            _camTargetPos.set(4.6, 3.3, 5.4);
            _camLookTarget.set(0, 1.35, 0);
          }
        } else if (s.cameraPreset === 'closeup') {
          if (s.taskMode === 'needle') {
            _camTargetPos.set(0.2, NEEDLE_EYE_Y + 0.07, 0.94);
            _camLookTarget.set(0.1, NEEDLE_EYE_Y - 0.02, 0);
          } else {
            _camTargetPos.set(2.15, 1.85, 2.45);
            _camLookTarget.set(0, 0.85, 0);
          }
        } else if (s.cameraPreset === 'topdown') {
          _camTargetPos.set(0.01, 5.6, 1.25);
          _camLookTarget.set(0, 0.3, 0);
        }
        camera.position.lerp(_camTargetPos, 1 - Math.exp(-6.5 * dt));
        controls.target.lerp(_camLookTarget, 1 - Math.exp(-6.5 * dt));
      }

      controls.update();
      renderer.render(scene, camera);

      // 8. Throttled React Telemetry State Update (~15fps)
      if (elapsed - lastTelemetryPush > 0.065) {
        lastTelemetryPush = elapsed;

        let phaseNote =
          'Set grip strength or activate BCI Auto-Grasp to test tactile control.';
        if (s.taskMode === 'needle') {
          if (s.phase === 'needle_idle') {
            phaseNote =
              '바닥 거치대에 고정된 바늘귀 앞에 로봇 핀셋·손가락이 구리빛 에나멜 코일 선을 쥐고 대기 중입니다.';
          } else if (s.phase === 'needle_stabilizing') {
            phaseNote = `BCI 정밀 미세 제어 가동 — 손떨림을 ±${s.needleTremorUm}μm로 보정하며 에나멜선 끝단을 바늘귀 중심에 정렬합니다.`;
          } else if (s.phase === 'needle_threading') {
            phaseNote =
              '정밀 삽입 진행 중 — 로봇 핀셋·손가락이 구리빛 에나멜 코일 선을 바늘귀 구멍 안으로 쏙 통과시키고 있습니다.';
          } else if (s.phase === 'needle_success') {
            phaseNote =
              'Threading Success! (정밀도 99.8%) — BCI 손떨림 보정으로 구리빛 에나멜선이 바늘귀 구멍을 완벽히 통과했습니다!';
          }
        } else if (s.taskMode === 'jegi') {
          if (s.phase === 'jegi_idle') {
            phaseNote =
              '전통 엽전·한지 제기가 준비되었습니다. [제기차기 시작]을 눌러 로봇 발 연속 차기를 시작하세요.';
          } else if (s.phase === 'jegi_rally') {
            phaseNote = s.jegiAutoRally
              ? `BCI 운동피질 리듬 동기화 중 — 로봇 발이 낙하 타이밍에 맞춰 제기를 연속 차올립니다 (${s.jegiCombo}콤보).`
              : `수동 타이밍 모드 — 제기가 타격권(0.4m~1.0m)으로 내려올 때 [직접 차기! (Space)]를 누르세요!`;
          } else if (s.phase === 'jegi_dropped') {
            phaseNote = `제기가 바닥에 떨어졌습니다! 최종 기록: ${s.jegiCombo}회 (최고 기록: ${s.jegiBestCombo}회). [다시하기]를 눌러 재도전하세요.`;
          }
        } else if (s.taskMode === 'pen') {
          if (s.status === 'Pen Acquired') {
            phaseNote =
              'Precision tripod pinch engaged. Click "Start Writing \'YES\'" to execute BCI calligraphy.';
          } else if (
            s.status === "Drawing 'Y'" ||
            s.status === "Drawing 'E'" ||
            s.status === "Drawing 'S'"
          ) {
            phaseNote = `Decoding C3/C4 motor cortex trajectory — actively scribing ${s.status.replace(
              'Drawing ',
              'letter '
            )} on paper pad.`;
          } else if (s.status === 'Writing Completed!') {
            phaseNote =
              'Calligraphy sequence "YES" completed with continuous ballpoint ink deposition.';
          }
        } else {
          if (s.status === 'Grasping...') {
            phaseNote =
              'Closing compliant silicone phalanges & calibrating contact force...';
          } else if (s.status === 'Successfully Lifted!') {
            phaseNote =
              'Optimal friction lock achieved (30%–70%). Egg held stably without shell fracture.';
          } else if (s.status === 'Egg Dropped!') {
            phaseNote =
              'Grip strength too weak (< 30%). Insufficient normal force caused gravitational slip.';
          } else if (s.status === 'Egg Broken!') {
            phaseNote =
              'Grip strength exceeded 70% (> 8.4 N). Calcium carbonate shell shattered under load.';
          }
        }

        setTelemetry({
          gripStrength: Math.round(
            s.taskMode === 'pen' || s.taskMode === 'needle'
              ? s.currentGripClosure
              : s.targetGripStrength
          ),
          appliedForceN: Number(s.appliedForceN.toFixed(2)),
          structuralIntegrity: Math.round(s.structuralIntegrity),
          status: s.status,
          phaseNote,
          alphaPower: Number((14 + Math.abs(alphaWave) * 0.8).toFixed(1)),
          betaPower: Number((betaAmplitude * 0.9).toFixed(1)),
          writingProgress: s.writingProgress,
          jegiCombo: s.jegiCombo,
          jegiBestCombo: s.jegiBestCombo,
          jegiHeightM: Number(Math.max(0, s.jegiY - JEGI_FLOOR_Y).toFixed(2)),
          jegiTimingGrade: s.jegiTimingGrade,
          needlePrecisionPct: Number(s.needlePrecisionPct.toFixed(1)),
          needleTremorUm: Number(s.needleTremorUm.toFixed(1)),
          needleProgressPct: s.needleProgressPct,
        });

        if (s.bciActive && s.taskMode === 'egg') {
          setGripStrength(Math.round(s.targetGripStrength));
        }
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener(
        'webglcontextlost',
        handleContextLost
      );
      renderer.domElement.removeEventListener(
        'webglcontextrestored',
        handleContextRestored
      );
      controls.removeEventListener('start', stopCamTransition);
      cancelAnimationFrame(animationFrameId);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const gripZoneLabel =
    gripStrength < 30
      ? 'Too Weak (< 30% · Slip Risk)'
      : gripStrength <= 70
      ? 'Optimal Zone (30%–70% · Stable Lift)'
      : 'Too Strong (> 70% · Crush Risk)';

  const gripZoneColor =
    gripStrength < 30
      ? 'text-amber-400'
      : gripStrength <= 70
      ? 'text-emerald-400'
      : 'text-rose-400';

  const renderStatusIcon = (status: SimStatus) => {
    switch (status) {
      case 'Successfully Lifted!':
      case 'Writing Completed!':
      case '제기 차올림! (Kick!)':
      case 'Threading Success! (정밀도 99.8%)':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'Egg Broken!':
      case '제기 바닥에 떨어짐!':
        return <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'Egg Dropped!':
        return <ArrowDownCircle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'Pen Acquired':
      case "Drawing 'Y'":
      case "Drawing 'E'":
      case "Drawing 'S'":
        return <PenTool className="w-4 h-4 text-sky-400 shrink-0" />;
      case '바늘귀 조준 대기':
      case 'BCI 손떨림 보정 중...':
      case '바늘귀 정밀 관통 중...':
        return <Crosshair className="w-4 h-4 text-sky-400 shrink-0" />;
      case '공중 체공 중...':
      case '제기차기 대기 중':
        return <Trophy className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'Grasping...':
        return <Hand className="w-4 h-4 text-sky-400 shrink-0" />;
      default:
        return <Activity className="w-4 h-4 text-slate-400 shrink-0" />;
    }
  };

  const statusTextColor =
    telemetry.status === 'Successfully Lifted!' ||
    telemetry.status === 'Writing Completed!' ||
    telemetry.status === '제기 차올림! (Kick!)' ||
    telemetry.status === 'Threading Success! (정밀도 99.8%)'
      ? 'text-emerald-300'
      : telemetry.status === 'Egg Broken!' ||
        telemetry.status === '제기 바닥에 떨어짐!'
      ? 'text-rose-300'
      : telemetry.status === 'Egg Dropped!'
      ? 'text-amber-300'
      : telemetry.status === 'Grasping...' ||
        telemetry.status === 'Pen Acquired' ||
        telemetry.status === "Drawing 'Y'" ||
        telemetry.status === "Drawing 'E'" ||
        telemetry.status === "Drawing 'S'" ||
        telemetry.status === '공중 체공 중...' ||
        telemetry.status === 'BCI 손떨림 보정 중...' ||
        telemetry.status === '바늘귀 정밀 관통 중...'
      ? 'text-sky-300'
      : 'text-slate-200';

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0B0F17] select-none">
      {/* 1. Dedicated WebGL 3D Canvas Container */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing"
        aria-label="Interactive 3D Robotic Simulation Viewport"
      />

      {/* 2. Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="relative z-10 flex items-center justify-between gap-8 px-6 py-3.5 bg-[#0B0F17]/90 border-b border-slate-800/80">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            handleCameraPresetChange('studio');
          }}
          className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          NeuroGrasp 3D
        </a>

        {/* Zone 2: Concise single-line navigation / camera links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-400">
          <button
            type="button"
            onClick={() => handleCameraPresetChange('studio')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              cameraView === 'studio'
                ? 'text-sky-400 underline underline-offset-4'
                : ''
            }`}
          >
            Studio View
          </button>
          <button
            type="button"
            onClick={() => handleCameraPresetChange('closeup')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              cameraView === 'closeup'
                ? 'text-sky-400 underline underline-offset-4'
                : ''
            }`}
          >
            Tactile Close-Up
          </button>
          <button
            type="button"
            onClick={() => handleCameraPresetChange('macro')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              cameraView === 'macro'
                ? 'text-emerald-400 underline underline-offset-4'
                : ''
            }`}
          >
            Needle Eye Macro View
          </button>
          <button
            type="button"
            onClick={() => handleCameraPresetChange('topdown')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              cameraView === 'topdown'
                ? 'text-sky-400 underline underline-offset-4'
                : ''
            }`}
          >
            Top Calibration
          </button>
          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-sky-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>{soundEnabled ? 'Audio On' : 'Audio Muted'}</span>
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Simulation</span>
          </button>
        </div>
      </header>

      {/* 3. Top-Center Compact Mode Switcher & Telemetry Readout Bar */}
      <div className="relative z-10 pointer-events-none flex flex-col items-center gap-2.5 px-4 pt-3">
        {/* Mode Toggle: [Mode: Egg Grasp] | [Mode: Pen & Write] | [Mode: 제기차기] | [Mode: 바늘귀 꿰기] */}
        <div className="pointer-events-auto inline-flex flex-wrap items-center justify-center gap-1 p-1 bg-[#0F1623]/95 border border-slate-800 rounded-xl shadow-lg">
          <button
            type="button"
            onClick={() => handleSelectTaskMode('egg')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              taskMode === 'egg'
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <Egg className="w-3.5 h-3.5" />
            <span>Mode: Egg Grasp</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectTaskMode('pen')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              taskMode === 'pen'
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Mode: Pen & Write</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectTaskMode('jegi')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              taskMode === 'jegi'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Mode: 제기차기</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectTaskMode('needle')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              taskMode === 'needle'
                ? 'bg-emerald-400 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Mode: 바늘귀 꿰기</span>
          </button>
        </div>

        {/* Real-Time Telemetry & Scoreboard Bar */}
        <div className="pointer-events-auto bg-[#0F1623]/95 border border-slate-800 rounded-xl px-5 py-3 shadow-xl max-w-3xl w-full flex flex-wrap items-center justify-between gap-6">
          {/* Status Indicator */}
          <div className="flex items-center gap-3 min-w-[200px]">
            {renderStatusIcon(telemetry.status)}
            <div>
              <div className="text-[11px] text-slate-400">Simulation Status</div>
              <div
                className={`text-sm font-bold tracking-tight ${statusTextColor}`}
              >
                {telemetry.status}
              </div>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-800 hidden sm:block" />

          {taskMode === 'needle' ? (
            <>
              {/* BCI 손떨림 보정 정밀도 & 잔류 진폭 */}
              <div className="flex-1 min-w-[165px]">
                <div className="flex items-baseline justify-between text-xs mb-1">
                  <span className="text-slate-400">BCI 정밀도 (Precision)</span>
                  <span className="font-mono font-semibold text-emerald-400">
                    {telemetry.needlePrecisionPct.toFixed(1)}% · ±
                    {telemetry.needleTremorUm.toFixed(1)}μm
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-emerald-400 transition-transform duration-150 origin-left"
                    style={{
                      transform: `scaleX(${Math.max(
                        0,
                        Math.min(1, telemetry.needlePrecisionPct / 100)
                      )})`,
                    }}
                  />
                </div>
              </div>

              <div className="h-8 w-px bg-slate-800 hidden sm:block" />

              {/* 바늘귀 관통 진행률 */}
              <div className="flex-1 min-w-[150px]">
                <div className="flex items-baseline justify-between text-xs mb-1">
                  <span className="text-slate-400">
                    바늘귀 통과 진행률
                  </span>
                  <span className="font-mono font-semibold text-sky-400">
                    {telemetry.needleProgressPct}%
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-sky-400 transition-transform duration-150 origin-left"
                    style={{
                      transform: `scaleX(${Math.max(
                        0,
                        Math.min(1, telemetry.needleProgressPct / 100)
                      )})`,
                    }}
                  />
                </div>
              </div>
            </>
          ) : taskMode === 'jegi' ? (
            <>
              {/* 제기차기 콤보 / 카운트 점수판 */}
              <div className="flex-1 min-w-[180px] flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] text-slate-400">
                    제기차기 연속 콤보 (Count)
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-bold text-amber-400">
                      {telemetry.jegiCombo}
                    </span>
                    <span className="text-xs font-semibold text-slate-300">
                      회 연속 성공
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] text-slate-400">
                    최고 기록 (Best)
                  </div>
                  <div className="font-mono text-base font-bold text-emerald-400">
                    {telemetry.jegiBestCombo} 회
                  </div>
                </div>
              </div>

              <div className="h-8 w-px bg-slate-800 hidden sm:block" />

              <div className="flex-1 min-w-[140px]">
                <div className="flex items-baseline justify-between text-xs mb-1">
                  <span className="text-slate-400">제기 체공 고도</span>
                  <span className="font-mono font-semibold text-sky-400">
                    {telemetry.jegiHeightM.toFixed(2)} m ·{' '}
                    {telemetry.jegiTimingGrade}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-amber-400 transition-transform duration-100 origin-left"
                    style={{
                      transform: `scaleX(${Math.max(
                        0,
                        Math.min(1, telemetry.jegiHeightM / 2.2)
                      )})`,
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Real-Time Gauge: Grip Force (Newtons) */}
              <div className="flex-1 min-w-[150px]">
                <div className="flex items-baseline justify-between text-xs mb-1">
                  <span className="text-slate-400">
                    {taskMode === 'pen' ? 'Pinch Force' : 'Grip Force'}
                  </span>
                  <span className="font-mono font-semibold text-slate-100">
                    {telemetry.appliedForceN.toFixed(2)} N{' '}
                    <span className="text-slate-500 font-normal">
                      ({telemetry.gripStrength}%)
                    </span>
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-transform duration-150 origin-left ${
                      taskMode === 'pen'
                        ? 'bg-sky-400'
                        : telemetry.gripStrength > 70
                        ? 'bg-rose-500'
                        : telemetry.gripStrength < 30
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                    style={{
                      transform: `scaleX(${Math.min(
                        1,
                        telemetry.gripStrength / 100
                      )})`,
                    }}
                  />
                </div>
              </div>

              <div className="h-8 w-px bg-slate-800 hidden sm:block" />

              {taskMode === 'egg' ? (
                <div className="flex-1 min-w-[165px]">
                  <div className="flex items-baseline justify-between text-xs mb-1">
                    <span className="text-slate-400">
                      Egg Structural Integrity
                    </span>
                    <span
                      className={`font-mono font-semibold ${
                        telemetry.structuralIntegrity === 0
                          ? 'text-rose-400'
                          : telemetry.structuralIntegrity < 65
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {telemetry.structuralIntegrity}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-transform duration-150 origin-left ${
                        telemetry.structuralIntegrity === 0
                          ? 'bg-rose-500'
                          : telemetry.structuralIntegrity < 65
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                      }`}
                      style={{
                        transform: `scaleX(${Math.max(
                          0,
                          Math.min(1, telemetry.structuralIntegrity / 100)
                        )})`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-w-[165px]">
                  <div className="flex items-baseline justify-between text-xs mb-1">
                    <span className="text-slate-400">
                      Calligraphy Stroke (&apos;YES&apos;)
                    </span>
                    <span className="font-mono font-semibold text-sky-400">
                      {telemetry.writingProgress}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-sky-400 transition-transform duration-150 origin-left"
                      style={{
                        transform: `scaleX(${Math.max(
                          0,
                          Math.min(1, telemetry.writingProgress / 100)
                        )})`,
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Threading Success Banner Alert when Needle Threading completes */}
        {taskMode === 'needle' &&
          telemetry.status === 'Threading Success! (정밀도 99.8%)' && (
            <div className="pointer-events-auto bg-emerald-950/95 border border-emerald-500/60 text-emerald-200 px-5 py-2.5 rounded-xl shadow-2xl flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="text-xs sm:text-sm font-bold tracking-tight">
                Threading Success! (정밀도 99.8%) — BCI 손떨림 보정 정밀 제어로
                에나멜 코일 선이 바늘귀 구멍을 완벽히 통과했습니다!
              </div>
            </div>
          )}
      </div>

      {/* 4. Collapsible Unified Control Dock */}
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(940px,95vw)] transition-transform duration-200"
        style={{
          transform: dockCollapsed
            ? 'translate(-50%, calc(100% - 34px))'
            : 'translate(-50%, 0)',
        }}
      >
        {/* Collapse / Expand Zen Mode Handle */}
        <div className="flex justify-center mb-1.5">
          <button
            type="button"
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="px-3.5 py-1 text-xs font-semibold text-slate-300 bg-[#0F1623] hover:bg-slate-800 border border-slate-700/80 rounded-lg shadow-lg flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-sky-400" />
                <span>Show Simulation Controls (H)</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                <span>Hide Controls (H)</span>
              </>
            )}
          </button>
        </div>

        {/* Main Dock Panel */}
        <div className="bg-[#0F1623]/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Column (7 cols): Mode-Specific Controls */}
            <div className="lg:col-span-7 flex flex-col justify-between gap-4">
              {taskMode === 'egg' && (
                <>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div>
                        <h2 className="text-sm font-bold text-slate-100">
                          Grip Strength & Tactile Pressure Control
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {telemetry.phaseNote}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono text-lg font-bold text-slate-100">
                          {gripStrength}%
                        </span>
                        <div
                          className={`text-[11px] font-semibold ${gripZoneColor}`}
                        >
                          {gripZoneLabel}
                        </div>
                      </div>
                    </div>

                    <div className="relative pt-1 pb-2">
                      <div className="w-full h-2 rounded-full flex overflow-hidden mb-1.5">
                        <div
                          className="h-full bg-amber-500/75"
                          style={{ width: '30%' }}
                          title="Too Weak (<30%): Egg Slips"
                        />
                        <div
                          className="h-full bg-emerald-500/85"
                          style={{ width: '40%' }}
                          title="Optimal (30%-70%): Stable Lift"
                        />
                        <div
                          className="h-full bg-rose-500/80"
                          style={{ width: '30%' }}
                          title="Too Strong (>70%): Egg Shatters"
                        />
                      </div>

                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={gripStrength}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setGripStrength(val);
                          if (bciMode) {
                            setBciMode(false);
                            simRef.current.bciActive = false;
                          }
                        }}
                        aria-label="Grip Strength Percentage"
                        className="grip-slider w-full -mt-5 relative z-10"
                      />

                      <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1">
                        <span>0% (0 N)</span>
                        <span className="text-amber-400">
                          30% Slip Threshold
                        </span>
                        <span className="text-emerald-400">50% Ideal</span>
                        <span className="text-rose-400">
                          70% Fracture Limit
                        </span>
                        <span>100% (12 N)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setBciMode(false);
                          simRef.current.bciActive = false;
                          setGripStrength(18);
                        }}
                        className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          gripStrength < 30 && !bciMode
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Weak (18%)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBciMode(false);
                          simRef.current.bciActive = false;
                          setGripStrength(48);
                        }}
                        className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          gripStrength >= 30 && gripStrength <= 70 && !bciMode
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Optimal (48%)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBciMode(false);
                          simRef.current.bciActive = false;
                          setGripStrength(85);
                        }}
                        className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          gripStrength > 70 && !bciMode
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Crush (85%)
                      </button>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleExecuteManualGrasp}
                        className="px-4 py-2 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Grasp & Lift Egg</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleReset}
                        className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {taskMode === 'pen' && (
                <>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div>
                        <h2 className="text-sm font-bold text-slate-100">
                          Precision Pen Pinch & BCI Calligraphy (&apos;YES&apos;)
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {telemetry.phaseNote}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono text-lg font-bold text-sky-400">
                          {telemetry.writingProgress}%
                        </span>
                        <div className="text-[11px] font-semibold text-slate-400">
                          Stroke Sequence: Y · E · S
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 pt-2">
                      {(['Y', 'E', 'S'] as const).map((letter) => {
                        const isDrawingThis =
                          telemetry.status === `Drawing '${letter}'`;
                        const isDone =
                          telemetry.status === 'Writing Completed!' ||
                          (letter === 'Y' &&
                            (telemetry.status === "Drawing 'E'" ||
                              telemetry.status === "Drawing 'S'")) ||
                          (letter === 'E' &&
                            telemetry.status === "Drawing 'S'");
                        return (
                          <div
                            key={letter}
                            className={`px-3 py-2 rounded-xl border transition-colors flex items-center justify-between ${
                              isDrawingThis
                                ? 'bg-sky-500/15 border-sky-400 text-sky-200'
                                : isDone
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                                : 'bg-slate-900/70 border-slate-800 text-slate-400'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-base font-bold">
                                &apos;{letter}&apos;
                              </span>
                              <span className="text-xs">
                                {isDrawingThis
                                  ? 'Drawing...'
                                  : isDone
                                  ? 'Inked'
                                  : 'Pending'}
                              </span>
                            </div>
                            {isDone && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                    <div className="text-xs text-slate-400 font-mono">
                      <span>Tripod Grip: 68% (6.2 N)</span>
                      <span className="mx-2">·</span>
                      <span>Ink: Royal Blue Ballpoint</span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleStartWritingYes}
                        className="px-4 py-2 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        <span>Start Writing &apos;YES&apos;</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleReset}
                        className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Clear Paper</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {taskMode === 'jegi' && (
                <>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div>
                        <h2 className="text-sm font-bold text-slate-100">
                          한국 전통놀이 제기차기 (Robotic Jegichagi Simulation)
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {telemetry.phaseNote}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-1.5 shrink-0">
                        <div>
                          <div className="text-[10px] text-slate-400">
                            연속 차기 콤보
                          </div>
                          <div className="font-mono text-xl font-bold text-amber-400">
                            {telemetry.jegiCombo}{' '}
                            <span className="text-xs font-normal text-slate-400">
                              COMBO
                            </span>
                          </div>
                        </div>
                        <div className="h-7 w-px bg-slate-800" />
                        <div>
                          <div className="text-[10px] text-slate-400">
                            최고 기록
                          </div>
                          <div className="font-mono text-sm font-bold text-emerald-400">
                            {telemetry.jegiBestCombo} 회
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setJegiAutoMode(true)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            jegiAutoMode
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          BCI 자동 연속 차기 (Auto-Rally)
                        </button>
                        <button
                          type="button"
                          onClick={() => setJegiAutoMode(false)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            !jegiAutoMode
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          수동 타이밍 차기 (Space / 클릭)
                        </button>
                      </div>

                      {!jegiAutoMode && (
                        <button
                          type="button"
                          onClick={handleManualJegiKick}
                          className="px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5 fill-current" />
                          <span>지금 차기! (Space)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                    <div className="text-xs text-slate-400 font-mono">
                      <span>모델: 상평통보 엽전 + 24가닥 한지 술</span>
                      <span className="mx-2">·</span>
                      <span>공기저항 낙하 물리 적용</span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleStartJegichagi}
                        className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>제기차기 시작</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleReset}
                        className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>다시하기</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {taskMode === 'needle' && (
                <>
                  {/* THREAD NEEDLE MODE (에나멜선 바늘귀 끼우기: 바닥 거치대 바늘 + 로봇 핀셋/손가락 정밀 삽입) */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div>
                        <h2 className="text-sm font-bold text-slate-100">
                          에나멜선 바늘귀 끼우기 (Thread Needle Precision Mode)
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {telemetry.phaseNote}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-1.5 shrink-0">
                        <div>
                          <div className="text-[10px] text-slate-400">
                            BCI 정밀도
                          </div>
                          <div className="font-mono text-lg font-bold text-emerald-400">
                            {telemetry.needlePrecisionPct.toFixed(1)}%
                          </div>
                        </div>
                        <div className="h-7 w-px bg-slate-800" />
                        <div>
                          <div className="text-[10px] text-slate-400">
                            잔류 손떨림
                          </div>
                          <div className="font-mono text-sm font-bold text-sky-400">
                            ±{telemetry.needleTremorUm.toFixed(1)} μm
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Camera Macro View Switcher & Tremor Filter Status Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCameraPresetChange('macro')}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                            cameraView === 'macro'
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                              : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                          }`}
                        >
                          <Focus className="w-3.5 h-3.5" />
                          <span>Needle Eye Macro View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCameraPresetChange('studio')}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            cameraView === 'studio'
                              ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                              : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          전체 거치대 · 핀셋 시점
                        </button>
                      </div>

                      <div className="text-xs font-mono text-slate-400">
                        바닥 거치대 고정 바늘 · 로봇 핀셋/손가락 에나멜선 파지
                      </div>
                    </div>
                  </div>

                  {/* [바늘귀 통과 시작] & [다시하기] Action Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                    <div className="text-xs text-slate-400 font-mono">
                      <span>구리 에나멜 코일 선 (Ø 0.14mm)</span>
                      <span className="mx-2">·</span>
                      <span>BCI 칼만 손떨림 보정</span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleStartNeedleThreading}
                        className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                        <span>바늘귀 통과 시작</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleReset}
                        className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>다시하기</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right Column (5 cols): Simulated Brain Signal (BCI) Oscilloscope & Decoder */}
            <div className="lg:col-span-5 bg-slate-900/75 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-200">
                    Neural BCI Decoder (EEG Alpha / Beta Waves)
                  </h3>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    <span>α 8–12Hz: {telemetry.alphaPower} μV</span>
                    <span className="mx-1.5">·</span>
                    <span>β 13–30Hz: {telemetry.betaPower} μV</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAutoGraspBci}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    bciMode
                      ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                      : 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/40'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>
                    {taskMode === 'needle'
                      ? 'BCI 바늘귀 통과'
                      : taskMode === 'jegi'
                      ? 'BCI 제기차기 시작'
                      : taskMode === 'pen'
                      ? "BCI Write 'YES'"
                      : bciMode
                      ? 'BCI Active (Stop)'
                      : 'Auto-Grasp via BCI'}
                  </span>
                </button>
              </div>

              {/* Real-Time Animated EEG Waveform Canvas */}
              <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-[#090D14]">
                <canvas
                  ref={eegCanvasRef}
                  width={340}
                  height={72}
                  className="w-full h-[72px] block"
                />
                <div className="absolute top-1.5 left-2 text-[10px] font-mono text-slate-400 pointer-events-none">
                  <span>C3/C4 Motor Cortex</span>
                  <span className="mx-1.5">·</span>
                  <span>
                    {taskMode === 'needle'
                      ? 'Micro-Tremor Cancellation'
                      : taskMode === 'jegi'
                      ? 'Lower-Limb Kick Rhythm'
                      : taskMode === 'pen'
                      ? 'Calligraphy Motor Intent'
                      : bciMode
                      ? 'Live Neural Lock'
                      : 'Standby Telemetry'}
                  </span>
                </div>
              </div>

              {/* Neural Signal Pattern Selector */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                  EEG Profile:
                </span>
                <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setBciPreset('optimal')}
                    className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      bciPreset === 'optimal'
                        ? 'bg-slate-800 text-emerald-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Steady Beta (50%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBciPreset('weak')}
                    className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      bciPreset === 'weak'
                        ? 'bg-slate-800 text-amber-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Low Beta (18%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBciPreset('overgrip')}
                    className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      bciPreset === 'overgrip'
                        ? 'bg-slate-800 text-rose-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Spike (84%)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle Bottom-Right Camera Orbit Helper */}
      <div className="fixed bottom-4 right-5 z-10 hidden xl:flex items-center gap-2 text-xs text-slate-400 bg-[#0F1623]/90 border border-slate-800/80 px-3 py-1.5 rounded-lg pointer-events-none">
        <Camera className="w-3.5 h-3.5 text-slate-400" />
        <span>Drag to orbit</span>
        <span>·</span>
        <span>Scroll to zoom</span>
      </div>
    </div>
  );
}
