import { useEffect } from 'react';
import { formatCount, STEP } from '../engine/counters';
import { PLAYBACK_SPEEDS, useScenarioStore } from '../store/useScenarioStore';

/** Longest frame step (ms): after a hidden tab the animation must not jump. */
const MAX_FRAME_MS = 100;

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return !!el && (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable);
};

/** Animation loop and keys of scenario playback: Space ▶/⏸, → next step, ← previous step, Home from the start. */
function usePlaybackLoop() {
  const animating = useScenarioStore((s) => (s.playback !== null && !s.playback.finished) || s.gap > 0);
  const paused = useScenarioStore((s) => s.paused);

  useEffect(() => {
    if (!animating || paused) return;
    let last = performance.now();
    let raf = requestAnimationFrame(function frame(now) {
      const dt = Math.min(MAX_FRAME_MS, Math.max(0, now - last));
      last = now;
      useScenarioStore.getState().tick(dt);
      raf = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(raf);
  }, [animating, paused]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const s = useScenarioStore.getState();
      if (s.recording) return;
      if (e.key === ' ') {
        const running = s.playback !== null && !s.playback.finished && !s.paused;
        if (running) s.pause();
        else s.play();
      } else if (e.key === 'ArrowRight') s.next();
      else if (e.key === 'ArrowLeft') s.prev();
      else if (e.key === 'Home') s.restart();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

const formatSpeed = (x: number) => `${x.toLocaleString('pl-PL')}×`;

/** ⟲ ⏮ ▶/⏸ ⏭, speed and progress of scenario playback (bottom bar). */
export function PlaybackBar() {
  usePlaybackLoop();
  const steps = useScenarioStore((s) => s.active()?.steps.length ?? 0);
  const position = useScenarioStore((s) => s.position);
  const playback = useScenarioStore((s) => s.playback);
  const paused = useScenarioStore((s) => s.paused);
  const gap = useScenarioStore((s) => s.gap);
  const speed = useScenarioStore((s) => s.speed);
  const error = useScenarioStore((s) => s.playback?.error ?? s.run.error);
  const store = useScenarioStore.getState();

  const animating = (playback !== null && !playback.finished) || gap > 0;
  const running = animating && !paused;
  const current = playback && !playback.finished ? playback.step + 1 : position;
  const none = steps === 0;

  return (
    <div className="playback-bar">
      <button type="button" onClick={store.restart} disabled={none} title="Od początku (Home)">
        ⟲ Od początku
      </button>
      <button type="button" onClick={store.prev} disabled={none || (position === 0 && !playback)} title="Poprzedni krok (←)">
        ⏮ Poprzedni
      </button>
      {running ? (
        <button type="button" className="primary" onClick={store.pause} title="Pauza (Spacja)">
          ⏸ Pauza
        </button>
      ) : (
        <button type="button" className="primary" onClick={store.play} disabled={none} title="Odtwórz (Spacja)">
          ▶ Odtwórz
        </button>
      )}
      <button type="button" onClick={store.next} disabled={none || (position >= steps && !animating)} title="Następny krok (→)">
        ⏭ Następny
      </button>
      <label className="speed">
        Prędkość
        <select value={speed} onChange={(e) => store.setSpeed(Number(e.target.value))}>
          {PLAYBACK_SPEEDS.map((x) => (
            <option key={x} value={x}>
              {formatSpeed(x)}
            </option>
          ))}
        </select>
      </label>
      <span className="progress">
        {none
          ? 'Scenariusz bez kroków'
          : current === 0
            ? `Stan początkowy · ${formatCount(steps, STEP)}`
            : `Krok ${current} / ${steps}`}
      </span>
      {error && (
        <span className="playback-error" title={error.message}>
          ⚠ {error.message}
        </span>
      )}
    </div>
  );
}
