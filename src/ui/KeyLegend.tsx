const KEYS: [keys: string, action: string][] = [
  ['← / →', 'jazda (trzymaj)'],
  ['Spacja', 'stop'],
  ['Ctrl+Z / Ctrl+Y', 'cofnij / ponów'],
  ['Esc', 'anuluj „Ustaw drogę”'],
];

/** Keyboard shortcuts of the drive mode, shown in the corner of the schematic. */
export function KeyLegend() {
  return (
    <dl className="key-legend" aria-label="Skróty klawiszowe">
      {KEYS.map(([keys, action]) => (
        <div key={keys}>
          <dt>
            {keys.split(' / ').map((k, i) => (
              <span key={k}>
                {i > 0 && ' / '}
                <kbd>{k}</kbd>
              </span>
            ))}
          </dt>
          <dd>{action}</dd>
        </div>
      ))}
    </dl>
  );
}
