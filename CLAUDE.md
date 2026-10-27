# CLAUDE.md — Symulator manewrów na bazie wagonowej

## Czym jest ten projekt
Prosta aplikacja webowa pokazująca schemat bocznicy (tory 3, 63, 65, 67, 69 + hala z kanałem
rewizyjnym) oraz ruchy wagonów wykonywane lokomotywą manewrową lub shunterem.
Służy do **prezentowania zarządowi** sposobu wstawiania wagonów na naprawę — krok po kroku,
z animacją i podpisami (jak na slajdach w `docs/img/`).

Pełna specyfikacja: **`docs/SPEC.md`** — przeczytaj ją przed każdym większym zadaniem.
Układ stacji (dane): `docs/station.json` → przy scaffoldingu skopiuj do `src/data/station.json`.
Przykładowy scenariusz: `docs/scenario-wstawienie-na-naprawe.json` → `src/data/scenarios/`.
Rysunki referencyjne: `docs/img/*.png` — wygląd aplikacji ma być do nich zbliżony.

## Stos technologiczny (nie zmieniaj bez pytania)
- Vite + React 18 + TypeScript (strict)
- Rysowanie: **SVG** (bez canvas, bez bibliotek graficznych)
- Stan: Zustand
- Testy: Vitest (silnik ruchu MUSI mieć testy jednostkowe)
- Brak backendu. Zapis: localStorage + eksport/import JSON.
- Hosting: GitHub Pages przez GitHub Actions (`.github/workflows/deploy.yml`)

## Komendy
- `npm install`
- `npm run dev` — serwer deweloperski
- `npm run build` — build produkcyjny (musi przechodzić bez błędów TS)
- `npm test` — testy Vitest
- `npm run lint`

## Architektura — zasady
1. `src/engine/` — czysty TypeScript, **zero importów z React**. Topologia torów, pozycje
   pojazdów, ruch, sprzęganie, rozjazdy, wykonywanie akcji scenariusza. Funkcje czyste
   (stan wejściowy → nowy stan), żeby dało się je testować i odtwarzać scenariusze.
2. `src/render/` (lub `src/components/station/`) — komponenty SVG, tylko rysują stan.
3. `src/store/` — Zustand: stan stacji, tryb aplikacji, scenariusz, odtwarzanie.
4. `src/ui/` — panele, pasek narzędzi, legenda, okna.
5. Układ stacji jest **sterowany danymi** (`station.json`). Nie wpisuj współrzędnych torów w kod.
6. Długości pojazdów w metrach (`lengthM`) × `scalePxPerMeter` = długość prostokąta.

## Konwencje
- Interfejs użytkownika **po polsku** (etykiety, komunikaty, podpowiedzi).
- Kod, nazwy zmiennych i komentarze techniczne po angielsku.
- Kolory i nazwy typów taboru wyłącznie z `station.json` → `vehicleTypes` (legenda z obrazka).
- Małe commity z opisem po polsku, np. `feat: tryb jazdy – sterowanie klawiaturą`.
- Nie dodawaj zależności bez uzasadnienia; aplikacja ma być prosta.

## Definicja „gotowe” dla każdego etapu
- `npm run build` i `npm test` przechodzą,
- kryteria akceptacji z `docs/SPEC.md` (rozdz. 13) dla danego etapu spełnione,
- README zaktualizowane, jeśli zmieniło się użycie aplikacji.

## Stan projektu
- Etapy E1–E7 gotowe (edycja, jazda, scenariusze, prezentacja, wygląd dla zarządu).
- Status wagonu „Naprawa” (`src/engine/repair.ts`): wagon podniesiony na podnośnikach nad kanałem
  rewizyjnym (tor 69). Status w `Vehicle.status` (także w `InitialState`), definicja koloru i nazwy
  w `station.json` → `vehicleStatuses`; shunter ma `passesUnderRepair` – sam (bez wagonów)
  przejeżdża pod takim wagonem (`mayOverlap` w `vehicles.ts`). Akcja scenariusza `setStatus`.
- X1 to rozjazd krzyżowy o 3 stanach (numeracja stała – używają jej scenariusze): 0 prosto
  (67↔67b i eD1↔eD2), 1 eD1 → e67b (hala), 2 e67 → eD2 (tor 3). Rozjazd z >2 stanami przestawia się
  z menu (`src/ui/SwitchMenu.tsx`, akcja `setSwitch` w `useDriveStore`); iglice: przy remisie
  w `bladeEdges` rysowane na obu odcinkach połączenia.
- Scenariusz przykładowy ma 6 kroków; krok 6 „Etap 2 – naprawa wagonu” – shunter przejeżdża pod
  R1 i wyjeżdża na tor 67 przez X1 (stan „skrzyżowanie”) bez problemów.

## Otwarte założenia (patrz SPEC rozdz. 15)
Punkt `X1` jest rozstrzygnięty (rozjazd krzyżowy). Pozostałe pytania – SPEC rozdz. 15, pkt 2–5.
