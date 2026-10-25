# Prompty do Claude Code — kolejność pracy

## Przygotowanie (ręcznie, raz)
1. Utwórz puste repozytorium na GitHubie, np. `manewry-baza`, i sklonuj je.
2. Wgraj do niego:
   - `CLAUDE.md` (katalog główny)
   - `docs/SPEC.md`, `docs/station.json`, `docs/scenario-wstawienie-na-naprawe.json`, `docs/PROMPTY.md`
   - swoje rysunki do `docs/img/` (np. `01-uklad.png`, `02-wstawienie.png`, `03-tor63.png`, `04-etap1.png`)
3. W GitHubie: Settings → Pages → Source: **GitHub Actions**.
4. W katalogu repo uruchom `claude`. Nie uruchamiaj `/init` — CLAUDE.md już jest.

Po każdym etapie: sprawdź w przeglądarce (`npm run dev`), poproś o commit, zrób push.
Przy większych etapach (E3, E5) najpierw włącz tryb planowania (Shift+Tab), zatwierdź plan, potem implementacja.

---

## Prompt startowy (E0 + E1)
```
Przeczytaj CLAUDE.md i docs/SPEC.md oraz obejrzyj rysunki w docs/img/.
Zrealizuj etapy E0 i E1 ze SPEC (rozdz. 13):
- scaffolding Vite + React + TypeScript (strict), ESLint, Vitest, Zustand,
- workflow .github/workflows/deploy.yml publikujący na GitHub Pages (base w vite.config.ts
  = nazwa repozytorium, którą odczytaj z `git remote -v`),
- skopiuj docs/station.json do src/data/station.json i zdefiniuj typy TS dla tego formatu,
- narysuj statyczny schemat w SVG: tory jako podwójne linie, łącznik, hala z kanałem,
  rozjazdy, etykiety, legenda — maksymalnie podobnie do docs/img/01-uklad.png.
Na koniec uruchom build i testy, krótko opisz co zrobiłeś i zrób commit.
```

## E2 — tabor i tryb Edycja
```
Zrealizuj etap E2 ze SPEC: model pojazdów i składów, wczytanie stanu początkowego
(format placements z rozdz. 10), rysowanie pojazdów jako prostokątów wzdłuż torów,
tryb Edycja (paleta = legenda, przeciąganie na tor, szybkie wypełnienie toru N wagonami,
zaznaczanie, usuwanie, przeciąganie wzdłuż toru), liczniki wagonów z poprawną polską odmianą.
Sprawdź kryterium akceptacji: da się odtworzyć rysunek 01-uklad.png.
```

## E3 — silnik ruchu
```
Zaplanuj, a potem zrealizuj etap E3: silnik ruchu w src/engine/ według rozdz. 7 SPEC
(czysty TS bez Reacta). Najpierw napisz testy z listy w rozdz. 7, potem implementację,
aż wszystkie testy przejdą. Uwzględnij generyczne stany rozjazdów (connections),
w tym X1 z dwoma połączeniami naraz.
```

## E4 — tryb Jazda
```
Zrealizuj etap E4: tryb Jazda wg rozdz. 6.2 — wybór pojazdu trakcyjnego, jazda klawiszami
←/→ i przyciskami z płynną animacją, suwak prędkości, klikanie rozjazdów, sprzęganie
i rozprzęganie kliknięciem w przerwę, auto-sprzęganie, komunikaty po polsku, cofnij/ponów.
Przetestuj ręcznie przejazd z rysunków 02–04 i opisz, czy wszystko zadziałało.
```

## E5 — scenariusze
```
Zrealizuj etap E5: scenariusze wg rozdz. 6.3 i 10 — runner akcji w silniku, nagrywanie
w trybie Jazda, odtwarzanie z kontrolkami i snapshotami kroków, edycja kroków, eksport/import
JSON. Dodaj wbudowany scenariusz z docs/scenario-wstawienie-na-naprawe.json (w razie potrzeby
dostrój offsety, żeby wyglądał jak na slajdach) oraz test, który odtwarza go do końca.
```

## E6 — prezentacja i README
```
Zrealizuj etap E6: tryb Prezentacja (pełny ekran, ramka opisu kroku w prawym górnym rogu
jak na slajdach, sterowanie strzałkami, wskaźnik kroku, link bezpośredni do scenariusza).
Napisz README po polsku: cel, link do GitHub Pages, jak używać (Edycja/Jazda/Scenariusz/
Prezentacja), skróty klawiszowe, jak dodać nowy scenariusz, jak zmienić układ torów.
```

## Przydatne prompty później
- „Dodaj nowy scenariusz: Etap 2 – … (opis ruchów). Zapisz w src/data/scenarios/.”
- „Zmień w station.json punkt X1 na zwykłe skrzyżowanie i sprawdź, które testy/scenariusze się psują.”
- „Dopasuj długości pojazdów: wagon 16,5 m, platforma 27 m.”
