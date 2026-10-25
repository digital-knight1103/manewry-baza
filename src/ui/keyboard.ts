import { useEffect } from 'react';
import type { ScreenSide } from '../engine/control';
import { useAppStore } from '../store/useAppStore';
import { useDriveStore } from '../store/useDriveStore';

/** Longest frame step (s): after a hidden tab or a hiccup the consist must not jump. */
const MAX_FRAME_S = 0.1;

const KEY_SIDE: Record<string, ScreenSide> = { ArrowLeft: 'left', ArrowRight: 'right' };

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return !!el && (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable);
};

/** Ctrl+Z / Ctrl+Y (and Ctrl+Shift+Z) in the edit and drive modes. */
export function useUndoKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isTyping(e.target) || useAppStore.getState().mode === 'scenario') return;
      const key = e.key.toLowerCase();
      const drive = useDriveStore.getState();
      if (key === 'z' && !e.shiftKey) drive.undo();
      else if (key === 'y' || (key === 'z' && e.shiftKey)) drive.redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Drive mode: ←/→ drive while held, Space stops, Esc cancels route picking; animation loop. */
export function useDriveControls() {
  const throttle = useDriveStore((s) => s.throttle);

  useEffect(() => {
    if (!throttle) return;
    let last = performance.now();
    let raf = requestAnimationFrame(function frame(now) {
      const dt = Math.min(MAX_FRAME_S, Math.max(0, now - last) / 1000);
      last = now;
      useDriveStore.getState().driveTick(dt);
      raf = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(raf);
  }, [throttle]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const drive = useDriveStore.getState();
      const side = KEY_SIDE[e.key];
      if (side) {
        e.preventDefault();
        // Key auto-repeat must not restart a drive stopped by Space or by the engine.
        if (!e.repeat) drive.setThrottle(side);
      } else if (e.key === ' ') {
        e.preventDefault();
        drive.setThrottle(null);
      } else if (e.key === 'Escape') drive.cancelRoutePick();
    };
    const up = (e: KeyboardEvent) => {
      const side = KEY_SIDE[e.key];
      const drive = useDriveStore.getState();
      if (side && drive.throttle === side) drive.setThrottle(null);
      // Keep Space from also "clicking" a focused button.
      if (e.key === ' ' && !isTyping(e.target)) e.preventDefault();
    };
    const blur = () => useDriveStore.getState().setThrottle(null);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      useDriveStore.getState().setThrottle(null);
    };
  }, []);
}
