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

## Otwarte założenia (patrz SPEC rozdz. 15)
Połączenie w punkcie `X1` (przecięcie łącznika z torem 67) przyjęto jako rozjazd pozwalający
wjechać z łącznika na tor 67/69 (do hali). Jeśli w rzeczywistości jest tam tylko skrzyżowanie,
zmienia się to wyłącznie w `station.json`.
