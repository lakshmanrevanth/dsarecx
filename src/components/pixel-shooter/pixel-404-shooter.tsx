'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import { Brand } from '@/components/brand';
import { ThemeSwitch } from '@/components/landing/theme-switch';
import { retroAudio } from './audio';

// 1 = ink pixel. A small plane pointing up.
const PLANE = [
  '0000001000000',
  '0000011100000',
  '0000011100000',
  '0000111110000',
  '0000110110000',
  '0011111111100',
  '0111111111110',
  '1111111111111',
  '1110011100111',
  '0000011100000',
  '0000111110000',
  '0001111111000',
  '0011100011100',
  '0011000001100',
  '0010000000100',
].map((r) => r.split('').map(Number));

const FOUR = ['10001', '10001', '10001', '11111', '00001', '00001', '00001'];
const ZERO = ['01110', '10001', '10011', '10101', '11001', '10001', '01110'];
// "404" as a 19×7 bitmap.
const GLYPH_404 = FOUR.map((r, i) => `${r}00${ZERO[i]}00${r}`.split('').map(Number));

type Bullet = { x: number; y: number; vy: number };
type Enemy = { x: number; y: number; vx: number; vy: number; hp: number };
type Debris = { x: number; y: number; vx: number; vy: number; size: number; alpha: number; decay: number; ember: boolean };
type Phase = 'ready' | 'playing' | 'over';

const PLANE_SCALE = 2.4;
const PLANE_W = 13 * PLANE_SCALE;
const PLANE_H = 15 * PLANE_SCALE;
const ENEMY_SCALE = 4.5;
const ENEMY_W = 19 * ENEMY_SCALE;
const ENEMY_H = 7 * ENEMY_SCALE;
const BULLET_W = 2.5;
const BULLET_H = 8;
const POINTS = 100;
const POINTS_PER_LEVEL = 600;

type Palette = { paper: string; ink: string; ember: string; faint: string; rule: string };

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    paper: v('--card', '#faf7f1'),
    ink: v('--foreground', '#161311'),
    ember: v('--ember', '#ff6a1f'),
    faint: v('--faint', '#8a8178'),
    rule: v('--border', '#d9d0c1'),
  };
}

const levelFor = (score: number) => 1 + Math.floor(score / POINTS_PER_LEVEL);

// Best score and mute live in localStorage (with an in-memory fallback) and are
// read through useSyncExternalStore so the server render stays deterministic.
const BEST_KEY = 'dsarecx_404_best';
const MUTED_KEY = 'dsarecx_404_muted';
const memory = new Map<string, string>();
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}
function writePref(key: string, value: string) {
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {}
  listeners.forEach((l) => l());
}
const readBest = () => {
  const n = Number(readPref(BEST_KEY));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const readMuted = () => readPref(MUTED_KEY) === '1';

/**
 * 404 mini-game. 404s fall from the top; shoot each one twice before it lands.
 * Keyboard: ←/→ or A/D to move, Space/↑/W to fire, Esc to go home.
 * Touch: drag on the board, or use the buttons below it.
 */
export function Pixel404Shooter() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const input = useRef({ left: false, right: false, fire: false, pointer: false });
  const phaseRef = useRef<Phase>('ready');
  const startRef = useRef<() => void>(() => {});

  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [destroyed, setDestroyed] = useState(0);
  const best = useSyncExternalStore(subscribe, readBest, () => 0);
  const muted = useSyncExternalStore(subscribe, readMuted, () => false);

  useEffect(() => {
    retroAudio.setMuted(muted);
  }, [muted]);

  const toggleMute = useCallback(() => {
    writePref(MUTED_KEY, readMuted() ? '0' : '1');
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let palette = readPalette();
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let width = 0;
    let height = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = box.clientWidth;
      height = box.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      planeY = height - PLANE_H - 18;
      planeX = Math.min(Math.max(planeX || width / 2, PLANE_W / 2 + 10), width - PLANE_W / 2 - 10);
    };

    let planeX = 0;
    let planeY = 0;
    let planeVx = 0;
    let bullets: Bullet[] = [];
    let enemies: Enemy[] = [];
    let debris: Debris[] = [];
    let cooldown = 0;
    let spawnTimer = 0;
    let points = 0;
    let kills = 0;
    let tick = 0;
    resize();

    const setPhaseBoth = (p: Phase) => {
      phaseRef.current = p;
      setPhase(p);
    };

    const spawn = (level: number) => {
      const speed = 1 + Math.min(0.85, (level - 1) * 0.09);
      const sway = 0.4 + Math.min(0.8, (level - 1) * 0.1);
      const minX = 14;
      const maxX = Math.max(minX + 20, width - ENEMY_W - 14);
      enemies.push({
        x: minX + Math.random() * (maxX - minX),
        y: -ENEMY_H - 8,
        vx: (Math.random() - 0.5) * sway,
        vy: (1.45 + Math.random() * 0.45) * speed,
        hp: 2,
      });
    };

    const shatter = (e: Enemy) => {
      retroAudio.explode();
      for (let r = 0; r < 7; r++)
        for (let c = 0; c < 19; c++)
          if (GLYPH_404[r][c])
            debris.push({
              x: e.x + c * ENEMY_SCALE,
              y: e.y + r * ENEMY_SCALE,
              vx: (Math.random() - 0.5) * 5.5,
              vy: -1 - Math.random() * 3.5,
              size: ENEMY_SCALE,
              alpha: 1,
              decay: 0.025 + Math.random() * 0.02,
              ember: Math.random() < 0.25,
            });
    };

    const fire = () => {
      retroAudio.shoot();
      bullets.push({ x: planeX - PLANE_W * 0.35 - BULLET_W / 2, y: planeY + 2, vy: -13 });
      bullets.push({ x: planeX + PLANE_W * 0.35 - BULLET_W / 2, y: planeY + 2, vy: -13 });
    };

    const start = () => {
      bullets = [];
      enemies = [];
      debris = [];
      points = 0;
      kills = 0;
      spawnTimer = 0;
      cooldown = 0;
      planeX = width / 2;
      setScore(0);
      setDestroyed(0);
      setPhaseBoth('playing');
      spawn(1);
    };
    startRef.current = start;

    const end = () => {
      setPhaseBoth('over');
      retroAudio.gameOver();
      if (points > readBest()) writePref(BEST_KEY, String(points));
      input.current.fire = false;
    };

    const isControl = (t: EventTarget | null) =>
      t instanceof HTMLElement && !!t.closest('a, button, input, textarea, select') && !t.closest('[data-game-board]');

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isControl(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        router.push('/');
        return;
      }
      if (k === 'arrowleft' || k === 'a') input.current.left = true;
      else if (k === 'arrowright' || k === 'd') input.current.right = true;
      else if (k === ' ' || k === 'arrowup' || k === 'w') input.current.fire = true;
      else if (k === 'enter' || k === 'r') {
        if (phaseRef.current !== 'playing') start();
        return;
      } else return;
      e.preventDefault();
      if (k === ' ' && phaseRef.current !== 'playing' && !e.repeat) {
        input.current.fire = false;
        start();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') input.current.left = false;
      if (k === 'arrowright' || k === 'd') input.current.right = false;
      if (k === ' ' || k === 'arrowup' || k === 'w') input.current.fire = false;
    };

    const moveTo = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      planeX = Math.max(PLANE_W / 2 + 10, Math.min(width - PLANE_W / 2 - 10, clientX - rect.left));
    };
    const onPointerDown = (e: PointerEvent) => {
      if (phaseRef.current !== 'playing') {
        start();
        return;
      }
      input.current.pointer = true;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}
      moveTo(e.clientX);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (phaseRef.current !== 'playing') return;
      if (e.pointerType === 'touch' && !input.current.pointer) return;
      moveTo(e.clientX);
    };
    const onPointerUp = () => {
      input.current.pointer = false;
    };

    const onTheme = () => {
      palette = readPalette();
    };
    const themeObserver = new MutationObserver(onTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    const drawBitmap = (bitmap: number[][], x: number, y: number, scale: number, gap = 0) => {
      for (let r = 0; r < bitmap.length; r++)
        for (let c = 0; c < bitmap[r].length; c++)
          if (bitmap[r][c]) ctx.fillRect(x + c * scale, y + r * scale, scale - gap, scale - gap);
    };

    let frame = 0;
    const loop = () => {
      tick++;
      const playing = phaseRef.current === 'playing';
      const level = levelFor(points);

      // Paper with faint rules
      ctx.fillStyle = palette.paper;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = palette.rule;
      ctx.globalAlpha = 0.6;
      const offset = playing && !reduceMotion ? (tick * 0.6) % 32 : 0;
      for (let ly = offset; ly < height; ly += 32) ctx.fillRect(0, Math.round(ly), width, 1);
      ctx.globalAlpha = 1;

      if (playing) {
        const inp = input.current;
        if (inp.left) planeVx = -10;
        else if (inp.right) planeVx = 10;
        else planeVx *= 0.68;
        planeX = Math.max(PLANE_W / 2 + 10, Math.min(width - PLANE_W / 2 - 10, planeX + planeVx));

        cooldown--;
        if ((inp.fire || inp.pointer) && cooldown <= 0) {
          fire();
          cooldown = 11;
        }

        spawnTimer++;
        if (spawnTimer > Math.max(30, 64 - (level - 1) * 5)) {
          spawn(level);
          if (level >= 3 && Math.random() < 0.18) spawn(level);
          spawnTimer = 0;
        }
      }

      // Bullets (ember)
      ctx.fillStyle = palette.ember;
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        if (playing) b.y += b.vy;
        ctx.fillRect(b.x, b.y, BULLET_W, BULLET_H);
        if (b.y < -15) bullets.splice(i, 1);
      }

      // 404s (ink)
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (playing) {
          e.y += e.vy;
          e.x += e.vx;
          if (e.x < 10 || e.x + ENEMY_W > width - 10) e.vx = -e.vx;

          const hitPlane =
            planeX - PLANE_W / 2 + 4 < e.x + ENEMY_W && planeX + PLANE_W / 2 - 4 > e.x && planeY + 2 < e.y + ENEMY_H && planeY + PLANE_H > e.y;
          if (hitPlane || e.y + ENEMY_H > height - 12) {
            shatter(e);
            enemies.splice(i, 1);
            end();
            continue;
          }

          let destroyedNow = false;
          for (let bi = bullets.length - 1; bi >= 0; bi--) {
            const b = bullets[bi];
            if (b.x + BULLET_W > e.x && b.x < e.x + ENEMY_W && b.y < e.y + ENEMY_H && b.y + BULLET_H > e.y) {
              bullets.splice(bi, 1);
              e.hp--;
              retroAudio.hit();
              debris.push({ x: b.x, y: b.y, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2, size: 2, alpha: 0.9, decay: 0.05, ember: true });
              if (e.hp <= 0) {
                shatter(e);
                enemies.splice(i, 1);
                kills++;
                points += POINTS;
                setDestroyed(kills);
                setScore(points);
                destroyedNow = true;
                break;
              }
            }
          }
          if (destroyedNow) continue;
        }
        ctx.fillStyle = palette.ink;
        ctx.globalAlpha = e.hp === 1 ? 0.65 : 1;
        drawBitmap(GLYPH_404, e.x, e.y, ENEMY_SCALE, 0.5);
        ctx.globalAlpha = 1;
      }

      // Debris
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        d.x += d.vx;
        d.y += d.vy;
        d.vy += 0.16;
        d.alpha -= d.decay;
        if (d.alpha <= 0) {
          debris.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = d.alpha;
        ctx.fillStyle = d.ember ? palette.ember : palette.ink;
        ctx.fillRect(d.x, d.y, d.size, d.size);
      }
      ctx.globalAlpha = 1;

      // Plane
      if (phaseRef.current !== 'over') {
        const sx = planeX - PLANE_W / 2;
        ctx.fillStyle = palette.ink;
        drawBitmap(PLANE, sx, planeY, PLANE_SCALE);
        if (playing) {
          const flame = tick % 2 === 0 ? 6 : 11;
          ctx.fillStyle = palette.ember;
          ctx.fillRect(sx + 2 * PLANE_SCALE, planeY + 15 * PLANE_SCALE, 2 * PLANE_SCALE, flame);
          ctx.fillRect(sx + 9 * PLANE_SCALE, planeY + 15 * PLANE_SCALE, 2 * PLANE_SCALE, flame);
        }
      }

      // On the ready screen, show one 404 hanging at the top.
      if (phaseRef.current === 'ready') {
        ctx.fillStyle = palette.ink;
        drawBitmap(GLYPH_404, width / 2 - ENEMY_W / 2, 36, ENEMY_SCALE, 0.5);
      }

      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    // Pause while the tab is hidden, and drop held inputs.
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
        input.current = { left: false, right: false, fire: false, pointer: false };
      } else if (!frame) {
        frame = requestAnimationFrame(loop);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(frame);
      themeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [router]);

  const level = levelFor(score);
  const hold = (key: 'left' | 'right' | 'fire') => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (phaseRef.current !== 'playing') startRef.current();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      input.current[key] = true;
    },
    onPointerUp: () => {
      input.current[key] = false;
    },
    onPointerCancel: () => {
      input.current[key] = false;
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1000px] flex-col px-4 pb-8 pt-6 sm:px-8">
      <header className="flex items-center justify-between gap-3">
        <Brand />
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={toggleMute}
            aria-pressed={!muted}
            aria-label={muted ? 'Sound off. Turn sound on' : 'Sound on. Turn sound off'}
            title={muted ? 'Sound off' : 'Sound on'}
          >
            {muted ? <VolumeX size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}
          </button>
          <ThemeSwitch />
        </div>
      </header>

      <div className="mt-10 flex flex-col gap-6 sm:mt-14 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">(404) Page not found</p>
          <h1 className="display mt-4 text-[clamp(48px,8vw,92px)] text-foreground">
            This page is <em>forgotten.</em>
          </h1>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-muted-foreground">
            Nothing lives at this address. Head back, or clear a few 404s before they land.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
          >
            <ArrowLeft size={15} aria-hidden /> Go back
          </button>
          <Link href="/" className="btn btn-primary">
            Home
          </Link>
        </div>
      </div>

      {/* HUD */}
      <div className="mt-10 flex items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <div className="flex items-center gap-4 sm:gap-6" aria-live="off">
          <span>
            404s <span className="text-foreground">{String(destroyed).padStart(2, '0')}</span>
          </span>
          <span>
            Score <span className="text-foreground">{String(score).padStart(5, '0')}</span>
          </span>
          <span>
            Lvl <span className="text-foreground">{String(level).padStart(2, '0')}</span>
          </span>
          {best > 0 ? (
            <span className="hidden sm:inline">
              Best <span className="text-ember-strong">{String(best).padStart(5, '0')}</span>
            </span>
          ) : null}
        </div>
        <div className="hidden items-center gap-1.5 normal-case tracking-normal md:flex">
          <span className="kbd">←</span>
          <span className="kbd">→</span> move <span className="kbd ml-2">Space</span> fire <span className="kbd ml-2">Esc</span> home
        </div>
      </div>

      {/* Board */}
      <div
        ref={boxRef}
        data-game-board
        className="card relative mt-3 h-[min(56vh,480px)] min-h-[320px] w-full cursor-crosshair touch-none select-none overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="404 mini-game. Move with the arrow keys or A and D, fire with Space, press Escape to go home."
          className="absolute inset-0 block h-full w-full touch-none"
        />

        {phase !== 'playing' ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card/80 p-6 text-center backdrop-blur-[1px]">
            {phase === 'over' ? (
              <>
                <p className="font-serif text-[44px] leading-none text-foreground">
                  404 <em className="text-ember">landed.</em>
                </p>
                <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Score {score} · 404s {destroyed} · Lvl {level}
                  {score > 0 && score >= best ? ' · new best' : ''}
                </p>
              </>
            ) : (
              <>
                <p className="font-serif text-[40px] leading-none text-foreground">
                  Clear the <em className="text-ember">404s.</em>
                </p>
                <p className="mt-3 max-w-xs text-[14px] text-muted-foreground">Each one takes two hits. Don&apos;t let one reach the bottom.</p>
              </>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button type="button" className="btn btn-ember" onClick={() => startRef.current()} autoFocus={phase === 'over'}>
                {phase === 'over' ? 'Play again' : 'Start'} <span className="kbd border-transparent bg-black/10 text-current">Enter</span>
              </button>
              {phase === 'over' ? (
                <Link href="/" className="btn btn-outline">
                  Home
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Touch controls */}
      <div className="mt-4 flex items-center justify-between gap-3 md:hidden">
        <div className="flex gap-2">
          <button type="button" className="btn btn-outline h-14 w-16 touch-none" aria-label="Move left" {...hold('left')}>
            <ChevronLeft size={22} aria-hidden />
          </button>
          <button type="button" className="btn btn-outline h-14 w-16 touch-none" aria-label="Move right" {...hold('right')}>
            <ChevronRight size={22} aria-hidden />
          </button>
        </div>
        <p className="text-center font-mono text-[10px] uppercase leading-tight tracking-[0.14em] text-faint">
          or drag
          <br />
          on the board
        </p>
        <button type="button" className="btn btn-primary h-14 px-7 touch-none" aria-label="Fire" {...hold('fire')}>
          Fire <span className="ember-dot" aria-hidden />
        </button>
      </div>
    </div>
  );
}
