import { useMemo, useRef, useState } from 'react';
import { ACTION, formatCount, STEP } from '../engine/counters';
import type { ScenarioStep } from '../engine/scenario';
import { defaultStepTitle } from '../engine/scenarioEdit';
import { captionStepIndex, useScenarioStore } from '../store/useScenarioStore';
import { useStationStore } from '../store/useStationStore';
import { describeAction } from './describeAction';
import { DrivePanel } from './DrivePanel';
import { copyText, openPresentation, presentationUrl } from './presentationControl';

/** Saves text as a file through a temporary link. */
function saveFile({ name, text }: { name: string; text: string }) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Side panel of the scenario mode: scenario list, recording, steps. */
export function ScenarioPanel() {
  const recording = useScenarioStore((s) => s.recording);
  return (
    <div className="scenario-panel">
      <ScenarioList />
      <PresentationSection />
      <Recording />
      {recording ? <DrivePanel history={false} /> : <Steps />}
    </div>
  );
}

function ScenarioList() {
  const builtIn = useScenarioStore((s) => s.builtIn);
  const user = useScenarioStore((s) => s.user);
  const scenarios = useMemo(() => [...builtIn, ...user], [builtIn, user]);
  const activeId = useScenarioStore((s) => s.activeId);
  const active = useScenarioStore((s) => s.active());
  const readOnly = useScenarioStore((s) => s.isReadOnly(s.activeId));
  const store = useScenarioStore.getState();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <section className="first">
      <h2>Scenariusz</h2>
      <select className="wide" value={activeId} onChange={(e) => store.select(e.target.value)} aria-label="Wybierz scenariusz">
        {scenarios.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
            {store.isReadOnly(s.id) ? ' 🔒' : ''}
          </option>
        ))}
      </select>
      {readOnly && <p className="muted small">Scenariusz wbudowany – tylko do odczytu. „Duplikuj” tworzy edytowalną kopię.</p>}
      <div className="button-wrap">
        <button
          type="button"
          title="Nowy scenariusz; stan początkowy = bieżący stan stacji"
          onClick={() => {
            const title = window.prompt('Nazwa nowego scenariusza:', 'Nowy scenariusz');
            if (title !== null) store.create(title);
          }}
        >
          Nowy
        </button>
        <button type="button" disabled={!active} onClick={store.duplicate}>
          Duplikuj
        </button>
        <button
          type="button"
          disabled={!active || readOnly}
          onClick={() => {
            const title = window.prompt('Nowa nazwa scenariusza:', active?.title);
            if (title !== null) store.rename(title);
          }}
        >
          Zmień nazwę
        </button>
        <button
          type="button"
          className="danger"
          disabled={!active || readOnly}
          onClick={() => window.confirm(`Usunąć scenariusz „${active?.title}”?`) && store.remove()}
        >
          Usuń
        </button>
      </div>
      <div className="button-wrap">
        <button
          type="button"
          disabled={!active}
          title="Zapisz ten scenariusz do pliku JSON"
          onClick={() => {
            const file = store.exportActive();
            if (file) saveFile(file);
          }}
        >
          Eksport
        </button>
        <button
          type="button"
          title="Zapisz wszystkie scenariusze do jednego pliku JSON"
          onClick={() => saveFile(store.exportAll())}
        >
          Eksport wszystkich
        </button>
        <button type="button" title="Wczytaj scenariusz lub komplet z pliku JSON" onClick={() => fileRef.current?.click()}>
          Import…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) store.importFile(await file.text());
          }}
        />
      </div>
    </section>
  );
}

function PresentationSection() {
  const active = useScenarioStore((s) => s.active());
  const readOnly = useScenarioStore((s) => s.isReadOnly(s.activeId));
  const recording = useScenarioStore((s) => s.recording);
  if (!active || recording) return null;
  const ready = active.steps.length > 0;
  return (
    <section>
      <h2>Prezentacja</h2>
      <div className="button-wrap">
        <button
          type="button"
          className="primary"
          disabled={!ready}
          title="Pełny ekran, sterowanie klawiaturą: → / Spacja dalej, ← wstecz, Esc wyjście"
          onClick={() => openPresentation(active.id)}
        >
          ▶ Prezentacja
        </button>
        <button
          type="button"
          disabled={!ready}
          title="Link otwierający od razu prezentację tego scenariusza"
          onClick={async () => {
            if (await copyText(presentationUrl(active.id))) useStationStore.getState().setMessage('Skopiowano link do prezentacji');
          }}
        >
          Kopiuj link do prezentacji
        </button>
      </div>
      {!readOnly && (
        <p className="muted small">
          Scenariusz zapisany tylko w tej przeglądarce – link zadziała na innym komputerze po imporcie scenariusza lub
          dodaniu go jako wbudowany.
        </p>
      )}
    </section>
  );
}

function Recording() {
  const recording = useScenarioStore((s) => s.recording);
  const readOnly = useScenarioStore((s) => s.isReadOnly(s.activeId));
  const active = useScenarioStore((s) => s.active());
  const lastStep = active?.steps[active.steps.length - 1];
  const store = useScenarioStore.getState();
  if (!active) return null;

  if (!recording) {
    return (
      <section>
        <h2>Nagrywanie</h2>
        <div className="button-column">
          <button
            type="button"
            className="record"
            disabled={readOnly}
            title={
              active.steps.length === 0
                ? 'Nagrywanie od bieżącego stanu stacji (zostanie stanem początkowym)'
                : 'Nagrywanie kolejnych akcji od końca scenariusza'
            }
            onClick={store.startRecording}
          >
            ● Nagrywaj
          </button>
          <button
            type="button"
            disabled={readOnly}
            title="Bieżący stan stacji (z trybu Edycja / Jazda) staje się stanem początkowym scenariusza"
            onClick={() => {
              if (
                active.steps.length === 0 ||
                window.confirm('Zmienić stan początkowy? Istniejące kroki mogą przestać się odtwarzać.')
              )
                store.saveInitialFromStation();
            }}
          >
            Zapisz jako stan początkowy
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="recording">
      <h2>
        <span className="rec-dot" /> Nagrywanie
      </h2>
      <p className="small">
        Bieżący krok: <strong>{lastStep?.title ?? '—'}</strong>
        {lastStep && <span className="muted"> ({formatCount(lastStep.actions.length, ACTION)})</span>}
      </p>
      <p className="muted small">
        Przełożenie rozjazdu, zakończony przejazd, sprzęgnięcie, rozprzęgnięcie i „Zjedź ze stacji” zapisują się jako akcje.
      </p>
      <div className="button-wrap">
        <button
          type="button"
          onClick={() => {
            const title = window.prompt('Tytuł nowego kroku:', defaultStepTitle(active.steps.length));
            if (title !== null) store.addStep(title);
          }}
        >
          Nowy krok
        </button>
        <button type="button" disabled={!lastStep?.actions.length} onClick={store.undoRecorded}>
          ↶ Cofnij akcję
        </button>
        <button type="button" className="primary" onClick={store.stopRecording}>
          ■ Zakończ
        </button>
      </div>
    </section>
  );
}

function Steps() {
  const active = useScenarioStore((s) => s.active());
  const readOnly = useScenarioStore((s) => s.isReadOnly(s.activeId));
  const available = useScenarioStore((s) => s.run.snapshots.length - 1);
  const errorStep = useScenarioStore((s) => s.run.error?.step);
  const current = useScenarioStore(captionStepIndex);
  if (!active) return <p className="muted">Brak scenariusza — utwórz nowy lub zaimportuj.</p>;
  const steps = active.steps;

  return (
    <section>
      <h2>Kroki ({formatCount(steps.length, STEP)})</h2>
      {steps.length === 0 && <p className="muted">Brak kroków — użyj „Nagrywaj”, aby je zarejestrować.</p>}
      <ol className="step-list">
        {steps.map((step, i) => (
          <StepItem
            key={i}
            index={i}
            step={step}
            count={steps.length}
            editable={!readOnly}
            current={i === current}
            reachable={i < available}
            startable={i <= available}
            failed={i === errorStep}
          />
        ))}
      </ol>
    </section>
  );
}

interface StepItemProps {
  index: number;
  step: ScenarioStep;
  count: number;
  editable: boolean;
  current: boolean;
  /** The step plays without error (its end snapshot exists). */
  reachable: boolean;
  /** The state before the step is known, so it can be animated. */
  startable: boolean;
  failed: boolean;
}

function StepItem({ index, step, count, editable, current, reachable, startable, failed }: StepItemProps) {
  const topo = useStationStore((s) => s.topo);
  const store = useScenarioStore.getState();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(step.title);
  const [bullets, setBullets] = useState(step.bullets.join('\n'));

  const startEdit = () => {
    setTitle(step.title);
    setBullets(step.bullets.join('\n'));
    setEditing(true);
  };
  const save = () => {
    store.updateStep(index, { title, bullets: bullets.split('\n') });
    setEditing(false);
  };

  return (
    <li className={['step', current && 'current', failed && 'failed'].filter(Boolean).join(' ')}>
      <div className="step-head">
        <button
          type="button"
          className="step-title"
          disabled={!reachable}
          title={reachable ? 'Pokaż stan po tym kroku' : 'Krok niedostępny – wcześniejsza akcja nie odtwarza się'}
          onClick={() => store.jumpTo(index + 1)}
        >
          <span className="step-no">{index + 1}.</span> {step.title}
        </button>
        <button
          type="button"
          className="icon"
          title="Odtwórz ten krok"
          onClick={() => store.playStep(index)}
          disabled={!startable}
        >
          ▶
        </button>
      </div>
      {editing ? (
        <div className="step-edit">
          <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Tytuł kroku" />
          <textarea
            value={bullets}
            rows={Math.max(3, bullets.split('\n').length + 1)}
            onChange={(e) => setBullets(e.target.value)}
            aria-label="Punkty opisu (jeden w wierszu)"
            placeholder="Punkty opisu – jeden w wierszu"
          />
          <div className="button-row">
            <button type="button" className="primary" onClick={save}>
              Zapisz
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              Anuluj
            </button>
          </div>
        </div>
      ) : (
        step.bullets.length > 0 && (
          <ul className="bullets">
            {step.bullets.map((b, j) => (
              <li key={j}>{b}</li>
            ))}
          </ul>
        )
      )}
      <details className="actions">
        <summary>Akcje ({step.actions.length})</summary>
        <ol>
          {step.actions.map((a, j) => (
            <li key={j}>{describeAction(topo, a)}</li>
          ))}
        </ol>
      </details>
      {editable && !editing && (
        <div className="step-tools">
          <button type="button" className="icon" title="W górę" disabled={index === 0} onClick={() => store.moveStep(index, -1)}>
            ↑
          </button>
          <button
            type="button"
            className="icon"
            title="W dół"
            disabled={index === count - 1}
            onClick={() => store.moveStep(index, 1)}
          >
            ↓
          </button>
          <button type="button" className="icon" title="Edytuj tytuł i opis" onClick={startEdit}>
            ✎
          </button>
          <button
            type="button"
            className="icon danger"
            title="Usuń krok"
            onClick={() => window.confirm(`Usunąć krok „${step.title}”?`) && store.removeStep(index)}
          >
            ✕
          </button>
        </div>
      )}
    </li>
  );
}
