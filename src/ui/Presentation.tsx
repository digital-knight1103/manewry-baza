import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { schematicViewBox } from '../components/station/bounds';
import { StationSvg } from '../components/station/StationSvg';
import { OUTLINE_COLOR } from '../components/station/style';
import { formatCount, STEP } from '../engine/counters';
import type { StationLayout } from '../engine/types';
import { usePresentationStore } from '../store/usePresentationStore';
import { captionStepIndex, scenarioViewState, useScenarioStore } from '../store/useScenarioStore';
import { useStationStore } from '../store/useStationStore';
import { usePlaybackAnimation } from './playbackAnimation';
import { closePresentation, enterFullscreen, fullscreenAvailable, leaveFullscreen } from './presentationControl';

/** The mouse cursor hides after this long without movement. */
const CURSOR_HIDE_MS = 2000;

const NEXT_KEYS = new Set(['ArrowRight', ' ', 'PageDown']);
const PREV_KEYS = new Set(['ArrowLeft', 'PageUp']);

/** Keyboard (and presentation remote: PageUp / PageDown) control; F toggles fullscreen. */
function usePresentationKeys(onToggleFullscreen: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const p = usePresentationStore.getState();
      if (NEXT_KEYS.has(e.key)) {
        // A held key must not race through the steps.
        if (!e.repeat) p.next();
      } else if (PREV_KEYS.has(e.key)) {
        if (!e.repeat) p.prev();
      } else if (e.key === 'Home') p.home();
      else if (e.key === 'Escape') closePresentation();
      else if (e.key === 'f' || e.key === 'F') onToggleFullscreen();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onToggleFullscreen]);
}

/**
 * Leaving fullscreen (Esc is taken by the browser there) ends the presentation, unless it was
 * switched off with F. Returns whether the page is in fullscreen and the F toggle.
 */
function useFullscreenExit() {
  const [fullscreen, setFullscreen] = useState(() => !!document.fullscreenElement);
  const keepOpen = useRef(false);
  useEffect(() => {
    const onChange = () => {
      const now = !!document.fullscreenElement;
      setFullscreen(now);
      if (!now && !keepOpen.current) closePresentation();
      keepOpen.current = false;
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggle = useMemo(
    () => () => {
      if (document.fullscreenElement) {
        keepOpen.current = true;
        leaveFullscreen();
      } else enterFullscreen();
    },
    [],
  );
  return { fullscreen, toggle };
}

/** Hides the cursor after CURSOR_HIDE_MS without mouse movement. */
function useIdleCursor() {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let timer = window.setTimeout(() => setIdle(true), CURSOR_HIDE_MS);
    const onMove = () => {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), CURSOR_HIDE_MS);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mousedown', onMove);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onMove);
    };
  }, []);
  return idle;
}

/** Fullscreen presentation of the active scenario (SPEC rozdz. 6.4): title screen, steps with animation, end screen. */
export function Presentation() {
  usePlaybackAnimation();
  const { fullscreen, toggle } = useFullscreenExit();
  usePresentationKeys(toggle);
  const idle = useIdleCursor();

  const topo = useStationStore((s) => s.topo);
  const screen = usePresentationStore((s) => s.screen);
  const scenario = useScenarioStore((s) => s.active());
  const state = useScenarioStore(scenarioViewState);
  const captionIndex = useScenarioStore(captionStepIndex);
  const anim = useScenarioStore((s) => s.playback?.anim ?? null);
  const playback = useScenarioStore((s) => s.playback);
  const position = useScenarioStore((s) => s.position);
  const error = useScenarioStore((s) => s.playback?.error ?? null);
  const viewBox = useMemo(() => schematicViewBox(topo.layout), [topo]);

  if (!scenario) return null;
  const count = scenario.steps.length;
  const step = screen === 'steps' && captionIndex !== null ? scenario.steps[captionIndex] : undefined;
  const animating = playback !== null && !playback.finished;

  // Progress: finished steps plus the share of finished actions of the animated one.
  let done = 0;
  if (screen === 'end') done = count;
  else if (screen === 'steps') {
    if (playback) {
      const actions = scenario.steps[playback.step]?.actions.length || 1;
      done = playback.step + Math.min(1, playback.action / actions);
    } else done = position;
  }
  const stepNo = screen === 'title' ? 0 : screen === 'end' ? count : playback ? playback.step + 1 : position;

  return (
    <div className={['presentation', idle && 'cursor-hidden'].filter(Boolean).join(' ')}>
      <header className="pres-header">
        <PresentationLegend layout={topo.layout} />
        {step && (
          <div className="pres-caption" aria-live="polite">
            <h2>{step.title}</h2>
            {step.bullets.length > 0 && (
              <ul>
                {step.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </header>

      <div className="pres-stage">
        <StationSvg
          topo={topo}
          state={state}
          legend={false}
          viewBox={viewBox}
          routeEdges={screen === 'steps' ? (anim?.route ?? null) : null}
          flashSwitch={screen === 'steps' ? (anim?.switchId ?? null) : null}
          pulseVehicles={screen === 'steps' ? anim?.highlight?.vehicles : undefined}
          pulseEdges={screen === 'steps' ? anim?.highlight?.edges : undefined}
        />
      </div>

      {screen !== 'steps' && (
        <div className="pres-card-backdrop">
          <div className="pres-card">
            {screen === 'title' ? (
              <>
                <p className="pres-kicker">Scenariusz manewrów</p>
                <h1>{scenario.title}</h1>
                <p className="pres-sub">{formatCount(count, STEP)}</p>
                <p className="pres-keys">
                  <kbd>→</kbd> / <kbd>Spacja</kbd> – rozpocznij
                </p>
              </>
            ) : (
              <>
                <h1>Koniec</h1>
                <p className="pres-sub">{scenario.title}</p>
                <p className="pres-keys">
                  <kbd>←</kbd> ostatni krok · <kbd>Home</kbd> od początku · <kbd>Esc</kbd> wyjście
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <footer className="pres-footer">
        <span className="pres-step">{screen === 'title' ? 'Start' : `Krok ${stepNo} / ${count}`}</span>
        {error && <span className="pres-error">⚠ {error.message}</span>}
        <span className="pres-hint">
          {animating ? '→ dokończ krok' : '→ dalej'} · ← wstecz · Home początek ·{' '}
          {!fullscreen && fullscreenAvailable() ? 'F pełny ekran · ' : ''}Esc wyjście
        </span>
        <button
          type="button"
          className="pres-close"
          onClick={(e) => {
            e.currentTarget.blur();
            closePresentation();
          }}
        >
          ✕ Zakończ
        </button>
        <div className="pres-progress" aria-hidden>
          <div style={{ width: `${count ? (100 * done) / count : 0}%` }} />
        </div>
      </footer>
    </div>
  );
}

/** Legend above the schematic: colours, names and lengths from station.json (wagons | powered stock + hall). */
function PresentationLegend({ layout }: { layout: StationLayout }) {
  const entry = (t: StationLayout['vehicleTypes'][number]) => (
    <li key={t.id}>
      <span className="pres-swatch" style={{ '--len': t.lengthM * layout.scalePxPerMeter, background: t.color } as CSSProperties} />
      {t.name}
    </li>
  );
  const { hall } = layout;
  return (
    <div className="pres-legend" aria-label="Legenda">
      <ul>{layout.vehicleTypes.filter((t) => !t.powered).map(entry)}</ul>
      <ul>
        {layout.vehicleTypes.filter((t) => t.powered).map(entry)}
        <li>
          <svg className="pres-hall-icon" viewBox="-1 -1 108 57" aria-hidden>
            <rect x={0.5} y={0.5} width={105} height={54} fill={hall.fill} stroke={OUTLINE_COLOR} />
            <line x1={85} y1={0} x2={85} y2={55} stroke={OUTLINE_COLOR} />
            <rect x={11} y={18} width={57} height={32} fill={hall.channelFill} stroke={OUTLINE_COLOR} />
          </svg>
          {hall.label}
        </li>
      </ul>
    </div>
  );
}
