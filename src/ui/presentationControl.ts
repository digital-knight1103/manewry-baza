// Entering / leaving the presentation: fullscreen, the direct link (#/prezentacja/<id>) and the address bar.
import { useEffect } from 'react';
import { parsePresentationHash, presentationHash, usePresentationStore } from '../store/usePresentationStore';

export const fullscreenAvailable = () => typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;

/** Requests fullscreen; without a user gesture (direct link) the browser refuses — the presentation then fills the window. */
export function enterFullscreen() {
  if (!fullscreenAvailable() || document.fullscreenElement) return;
  document.documentElement.requestFullscreen().catch(() => {});
}

export function leaveFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

const setHash = (hash: string) => history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);

/** Full URL of the presentation of scenario `id`. */
export const presentationUrl = (id: string) => `${location.origin}${location.pathname}${location.search}${presentationHash(id)}`;

/** Starts the presentation from a click (fullscreen allowed). */
export function openPresentation(id: string) {
  if (!usePresentationStore.getState().start(id)) return;
  setHash(presentationHash(id));
  enterFullscreen();
}

export function closePresentation() {
  usePresentationStore.getState().exit();
  leaveFullscreen();
  if (parsePresentationHash(location.hash)) setHash('');
}

/** Opens the presentation given in the address (on load and on hash change). */
export function usePresentationRoute() {
  useEffect(() => {
    const sync = () => {
      const id = parsePresentationHash(location.hash);
      if (id) {
        if (!usePresentationStore.getState().start(id)) setHash('');
      } else if (usePresentationStore.getState().presenting) closePresentation();
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
}

/** Copies text to the clipboard; falls back to a prompt the user can copy from. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt('Skopiuj link:', text);
    return false;
  }
}
