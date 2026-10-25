# manewry-baza

Symulator manewrów na bazie wagonowej — schemat bocznicy (tory 3, 63, 65, 67, 69 i hala z kanałem
rewizyjnym) oraz ruchy wagonów wykonywane lokomotywą manewrową lub shunterem. Służy do
prezentowania zarządowi sposobu wstawiania wagonów na naprawę.

**Aplikacja online:** https://digital-knight1103.github.io/manewry-baza/

Specyfikacja: [`docs/SPEC.md`](docs/SPEC.md).

## Stan prac
- [x] E0 — szkielet (Vite + React + TypeScript, ESLint, Vitest, Zustand) i publikacja na GitHub Pages
- [x] E1 — statyczny schemat stacji rysowany z `src/data/station.json` (tory, łącznik, hala, rozjazdy, etykiety, legenda)
- [x] E2 — tabor i tryb Edycja (rozstawianie pojazdów, szybkie wypełnienie, liczniki wagonów)
- [x] E3 — silnik ruchu + testy
- [x] E4 — tryb Jazda (sterowanie, rozjazdy, „Ustaw drogę”, sprzęganie, cofnij/ponów)
- [x] E5 — scenariusze (odtwarzanie z animacją i podpisami, nagrywanie, edycja kroków, eksport/import)
- [ ] E6 — prezentacja

## Uruchomienie lokalne
Wymagany Node.js 18+.

```bash
npm install
npm run dev      # serwer deweloperski (http://localhost:5173/manewry-baza/)
npm run build    # build produkcyjny do dist/
npm test         # testy Vitest
npm run lint     # ESLint
```

## Tryb Edycja — rozstawianie taboru
- **Dodawanie:** przeciągnij pojazd z legendy (legenda = paleta) na tor — przyciąga się do
  najbliższego toru i najbliższego wolnego miejsca; przy sąsiednim pojeździe dosuwa się do niego.
- **Szybkie wypełnienie** (panel boczny): tor, typ, liczba, kierunek dosuwania → „Dodaj”.
  Przykład — rysunek 1: tor 63 → 8, tor 65 → 9, tor 67 (zachód) → 11, tor 69 (hala) → 2,
  tor 67 (wschód) → 7 wagonów REV.
- **Zaznaczanie:** kliknięcie pojazdu; panel pokazuje typ, numer wagonu (edytowalny), sprzęgi
  z sąsiadami (Sprzęgnij / Rozprzęgnij) i skład. **Del** usuwa pojazd, **Esc** odznacza.
- **Przesuwanie:** przeciągnięcie pojazdu przesuwa cały jego skład wzdłuż toru, z zatrzymaniem
  na innych pojazdach i kozłach; po puszczeniu mała przerwa (< 12 jedn.) jest domykana.
- Stykające się pojazdy są sprzęgane automatycznie (przełącznik w panelu).
- Stan stacji zapisuje się automatycznie w przeglądarce (localStorage) w formacie
  `initialState` scenariusza; „Wczytaj stan początkowy scenariusza” przywraca przykład.
- „Zapisz jako stan początkowy scenariusza” zapisuje bieżący stan stacji do scenariusza wybranego
  w trybie Scenariusz (tylko edytowalnego).

## Tryb Jazda — ręczne manewry
- **Pojazd prowadzący:** kliknij lokomotywę lub shunter (żółta poświata + czerwona strzałka
  kierunku). Kliknięcie wagonu tylko pokazuje informacje o nim w panelu.
- **Jazda:** przytrzymaj ◀ / ▶ w panelu lub klawisze **←** / **→** — skład jedzie, dopóki
  trzymasz; **Spacja** = stop. Kierunek jest ekranowy (na łączniku ◀ = w górę-lewo,
  ▶ = w dół-prawo). Suwak ustawia prędkość animacji.
- **Rozjazdy:** kliknięcie kółka S1 / X1 / S2 przełącza na następny stan (aktywna droga jest
  podświetlona, nazwa stanu w podpowiedzi). Zajętego rozjazdu nie da się przełożyć.
- **Ustaw drogę:** wybierz pojazd, kliknij „Ustaw drogę”, potem tor docelowy — aplikacja ustawia
  rozjazdy i podświetla drogę. Jeśli po drodze trzeba zmienić kierunek, pasek stanu mówi, gdzie
  i które rozjazdy przestawić potem (wtedy ponownie „Ustaw drogę”).
- **Sprzęganie:** kliknięcie przerwy między sprzęgniętymi pojazdami rozprzęga je (kursor ✂),
  między stykającymi się niesprzęgniętymi — sprzęga. „Auto-sprzęganie” łączy składy przy najechaniu.
- **Zjedź ze stacji:** skład na końcu toru 3 może opuścić schemat.
- **Cofnij / Ponów:** Ctrl+Z / Ctrl+Y (także w trybie Edycja). „Reset do stanu początkowego”
  przywraca stan z chwili wejścia w tryb Jazda.

## Tryb Scenariusz — odtwarzanie i nagrywanie
- **Lista scenariuszy** (panel boczny): wybór, **Nowy** (stan początkowy = bieżący stan stacji),
  **Duplikuj**, **Zmień nazwę**, **Usuń**. Scenariusze wbudowane (`src/data/scenarios/*.json`,
  oznaczone 🔒) są tylko do odczytu — „Duplikuj” tworzy edytowalną kopię. Edytowalne scenariusze
  zapisują się automatycznie w przeglądarce.
- **Eksport / Import JSON:** „Eksport” zapisuje bieżący scenariusz, „Eksport wszystkich” — komplet
  w jednym pliku; „Import…” przyjmuje oba formaty (scenariusz o tym samym id jest zastępowany,
  wbudowanego nie da się nadpisać — dostaje nowe id).
- **Odtwarzanie** (pasek na dole): ⟲ Od początku, ⏮ Poprzedni, ▶ Odtwórz / ⏸ Pauza, ⏭ Następny,
  prędkość 0,5×–4×. Klawisze: **Spacja** ▶/⏸, **→** następny krok, **←** poprzedni, **Home** od początku.
  „Następny” animuje jeden krok (drugie kliknięcie w trakcie — od razu koniec kroku). W prawym
  górnym rogu schematu ramka z tytułem i punktami kroku (jak na slajdach); podczas przejazdu
  podświetlona jest droga, przy przełożeniu — rozjazd, akcja `highlight` pulsuje wskazane pojazdy/tor.
- **Skok do kroku:** kliknięcie tytułu kroku na liście pokazuje natychmiast stan po tym kroku
  (migawki); ▶ przy kroku odtwarza tylko ten krok.
- **Edycja kroków** (scenariusz edytowalny): ✎ tytuł i punkty opisu (jeden punkt w wierszu),
  ↑ ↓ kolejność, ✕ usunięcie, „Akcje (n)” — podgląd listy akcji.
- **Nagrywanie:** „● Nagrywaj” włącza sterowanie jak w trybie Jazda. Pusty scenariusz zaczyna od
  bieżącego stanu stacji (staje się stanem początkowym), scenariusz z krokami — od swojego końca.
  Przełożenie rozjazdu, zakończony przejazd (zapisany jako „jedź do” punktu zatrzymania; najechanie
  z auto-sprzęganiem — jako „dojedź i sprzęgnij”), sprzęgnięcie, rozprzęgnięcie i „Zjedź ze stacji”
  trafiają do bieżącego (ostatniego) kroku. „Nowy krok” pyta o tytuł i otwiera kolejny krok,
  „↶ Cofnij akcję” usuwa ostatnią nagraną akcję, „■ Zakończ” kończy nagrywanie.
- Błędna akcja (np. rozjazd ustawiony przeciwnie, punkt wymagający zmiany kierunku) zatrzymuje
  odtwarzanie z komunikatem „Krok N, akcja M: …”; kroki za błędem są niedostępne.

Format scenariusza: SPEC rozdz. 10. Wbudowany przykład: `src/data/scenarios/wstawienie-na-naprawe.json`.

## Układ stacji
Cały schemat jest sterowany danymi z `src/data/station.json` (węzły, odcinki, rozjazdy, hala,
etykiety, typy taboru). Zmiana układu torów = edycja tego pliku; współrzędne są w jednostkach
viewBox 1000×400.

## Publikacja
Każdy push na `main` uruchamia `.github/workflows/deploy.yml` (lint, testy, build, deploy).
W ustawieniach repozytorium: **Settings → Pages → Source: GitHub Actions**.
