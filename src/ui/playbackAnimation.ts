import { useEffect } from 'react';
import { useScenarioStore } from '../store/useScenarioStore';

/** Longest frame step (ms): after a hidden tab the animation must not jump. */
const MAX_FRAME_MS = 100;

/** Animation loop of scenario playback (also used by the presentation). */
export function usePlaybackAnimation() {
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
}
