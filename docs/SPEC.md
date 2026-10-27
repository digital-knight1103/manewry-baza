# Specyfikacja — Symulator manewrów na bazie wagonowej

## 1. Cel
Aplikacja ma w prosty, czytelny sposób pokazać:
- schemat bocznicy (tory 3, 63, 65, 67, 69, łącznik ukośny, hala z kanałem rewizyjnym),
- rozmieszczenie wagonów różnych typów na torach,
- ruchy lokomotywy manewrowej i shuntera oraz przestawianie wagonów (sprzęganie, rozprzęganie,
  przestawianie rozjazdów),
- zapisane sekwencje ruchów („scenariusze”) odtwarzane krok po kroku z podpisami —
  do prezentacji dla zarządu.

Wygląd ma odpowiadać rysunkom w `docs/img/` (schemat z podwójną linią torów, prostokąty wagonów,
legenda kolorów, opis etapu w prawym górnym rogu).

## 2. Forma aplikacji (decyzja)
**Statyczna aplikacja webowa (SPA) opublikowana na GitHub Pages.**
- Zarząd otwiera link w przeglądarce — bez instalacji, działa na laptopie i rzutniku.
- Kod w repozytorium GitHub, każdy push na `main` automatycznie publikuje nową wersję.
- Technologia: Vite + React + TypeScript + SVG + Zustand + Vitest.
- SVG skaluje się do dowolnego ekranu bez utraty jakości (ważne przy prezentacji na rzutniku).

## 3. Pojęcia
| Pojęcie | Znaczenie |
|---|---|
| Węzeł (node) | punkt topologii: koniec toru (kozioł), rozjazd, granica toru, wyjazd ze stacji |
| Odcinek (edge) | fragment toru między dwoma węzłami; należy do toru o numerze (63, 65, …) |
| Rozjazd (switch) | węzeł z kilkoma stanami; każdy stan to zbiór aktywnych połączeń odcinków |
| Pojazd | wagon, platforma, lokomotywa lub shunter |
| Skład (consist) | grupa sprzęgniętych pojazdów poruszająca się razem |
| Pojazd trakcyjny | lokomotywa lub shunter — tylko skład z takim pojazdem może jechać |
| Scenariusz | stan początkowy + lista kroków (etapów), każdy krok = podpis + lista akcji |

## 4. Układ stacji (model danych)
Plik `src/data/station.json` (wzór: `docs/station.json`). Współrzędne w jednostkach schematu
(viewBox 1000×400 — odpowiada rysunkom). Odcinki są liniami prostymi (polilinia opcjonalnie
przez `points`).

Topologia odtworzona z rysunków:
```
tor 63 (W) ── S1 ── tor 65 ──────────────── kozioł
               \
                \ łącznik
tor 67 (W) ──────X1─────── tor 67 ─── H1 ═ tor 69 (hala) ═ kozioł
                   \
                    \
tor 3 (W) ───────────S2────────────── tor 3 (E)
```
- **S1**: z toru 63 prosto na tor 65 albo w łącznik.
- **S2**: z toru 3 (część wschodnia) prosto na tor 3 (zachód) albo w łącznik.
- **X1**: rozjazd krzyżowy (przecięcie łącznika z torem 67) o trzech stanach:
  0 „prosto” = tor 67 ↔ tor 67 oraz łącznik ↔ łącznik jednocześnie;
  1 = łącznik od S1 → tor 67 w stronę hali (tor 67/69);
  2 = tor 67 (część zachodnia) → łącznik w stronę S2 (tor 3).
  Numeracja stanów jest stała (używają jej scenariusze). Rozjazd o więcej niż dwóch stanach
  przestawia się z menu z nazwami stanów, a nie kolejnymi kliknięciami.
- **Hala**: prostokąt w kolorze #FBE3D6 z szarym kanałem rewizyjnym; tor 69 wchodzi do hali.
- Końce torów 63, 65, 67 (W), 69 — kozły oporowe. Końce toru 3 — wyjazdy ze stacji (wahadło):
  tam pojazdy mogą wjechać na stację i z niej zjechać.

Rozjazd jest opisany generycznie: `states: [{ name, connections: [[edgeA, edgeB], …] }]`.
Dzięki temu skrzyżowanie, rozjazd zwyczajny i rozjazd krzyżowy obsługuje ten sam kod.

## 5. Tabor
Typy w `station.json → vehicleTypes` (kolory z legendy na rysunkach):
| id | Nazwa | Kolor | Długość |
|---|---|---|---|
| wagon_dlugo | Wagon na naprawę długoterminową | #7B3A12 (brąz) | 15 m |
| wagon_rev | Wagon na naprawę REV | #1F5F7F (granat) | 15 m |
| wagon_zdrowy | Wagon zdrowy | #CDE8F6 (jasnoniebieski) | 15 m |
| platforma | Platforma z zestawami | #F2AA84 (łososiowy) | 30 m |
| lokomotywa | Lokomotywa | #4CD964 (zielony) | 25 m |
| shunter | Shunter | #4CD964, wąski | 3 m, maks. 4 wagony (konfigurowalne) |

Długość prostokąta = `lengthM × scalePxPerMeter`. Przerwa sprzęgowa = `couplingGapM`.
Każdy pojazd ma `id` (np. R1, D3, LOK1) i opcjonalny `number` (numer wagonu w tooltipie).

## 6. Tryby aplikacji
Przełącznik w pasku górnym: **Edycja | Jazda | Scenariusz**, plus przycisk **Prezentacja**.

### 6.1 Edycja (rozstawianie taboru)
- Paleta typów pojazdów (legenda = paleta). Przeciągnięcie na tor → pojazd przyciąga się do
  najbliższego odcinka i najbliższego wolnego miejsca.
- „Szybkie wypełnienie”: wybierz tor → „Dodaj N wagonów typu X” (np. 8 wagonów REV na tor 63).
- Zaznaczenie pojazdu → panel boczny: typ, numer, sprzęgnięty z…, przycisk Usuń (klawisz Del).
- Przeciąganie pojazdu wzdłuż toru (z zachowaniem kolizji).
- Pojazdy postawione obok siebie w edycji są domyślnie sprzęgnięte (przełącznik w panelu).
- Przycisk „Wyczyść stację”, „Zapisz jako stan początkowy scenariusza”.

### 6.2 Jazda (ręczne manewry)
- Kliknięcie lokomotywy/shuntera = wybór pojazdu prowadzącego.
- Sterowanie: przyciski ◀ ▶ oraz klawisze ←/→ (jazda dopóki wciśnięte), Spacja = stop,
  suwak prędkości. Kierunek ◀/▶ = kierunek ekranowy na bieżącym odcinku (na łączniku:
  ◀ = w górę-lewo, ▶ = w dół-prawo).
- Kliknięcie rozjazdu = przełączenie na następny stan (aktywna droga podświetlona).
- Kliknięcie przerwy między dwoma sprzęgniętymi pojazdami = rozprzęgnięcie (nożyczki w kursorze);
  kliknięcie przerwy między stykającymi się niesprzęgniętymi = sprzęgnięcie.
- Auto-sprzęganie przy najechaniu (domyślnie włączone, przełącznik).
- Komunikaty w pasku stanu, np. „Rozjazd S1 ustawiony przeciwnie”, „Shunter może pchać maks. 4 wagony”.
- Cofnij / Ponów (Ctrl+Z / Ctrl+Y) — historia stanów.

### 6.3 Scenariusz (nagrywanie i odtwarzanie)
- Lista kroków po prawej: tytuł (np. „Etap 1 – wstawienie wagonu na halę”) + punkty opisu.
- **Nagrywanie**: w trybie Jazda każda czynność zapisuje się jako akcja w bieżącym kroku
  (przestawienie rozjazdu, przejazd do punktu zatrzymania, sprzęgnięcie, rozprzęgnięcie).
  Przycisk „Nowy krok” zamyka krok i otwiera następny.
- **Odtwarzanie**: ▶ Odtwórz / ⏸ Pauza / ⏭ Następny krok / ⏮ Poprzedni krok / ⟲ Od początku,
  prędkość animacji 0,5×–4×.
- Po każdym kroku zapisywany jest snapshot stanu → skok do dowolnego kroku jest natychmiastowy.
- Edycja tytułu i opisu kroku, usuwanie i zmiana kolejności kroków.
- Wiele scenariuszy: lista, „Nowy”, „Duplikuj”, „Eksport JSON”, „Import JSON”.
- Wbudowany scenariusz przykładowy: „Wstawienie wagonów na naprawę” (plik w `src/data/scenarios/`).

### 6.4 Prezentacja (dla zarządu)
- Pełny ekran, ukryte panele edycji, duży schemat + ramka z opisem kroku w prawym górnym rogu
  (jak na slajdach), legenda u góry.
- Strzałka → / Spacja = następny krok z animacją; ← = poprzedni; Esc = wyjście.
- Wskaźnik postępu „Krok 3 / 7”.
- Link bezpośredni do scenariusza: `…/#/prezentacja/wstawienie-na-naprawe`.

## 7. Silnik ruchu — reguły
Pozycja pojazdu: `{ edgeId, s }` (odległość od węzła `from` odcinka, środek pojazdu) + orientacja.
Skład: uporządkowana lista pojazdów; pozycje kolejnych wyznaczane przez „przejście” po grafie
torów od pojazdu skrajnego o długość pojazdu + przerwę sprzęgową, zgodnie ze stanami rozjazdów.

1. Jechać może tylko skład zawierający pojazd trakcyjny (lokomotywa/shunter).
2. Shunter: liczba wagonów w składzie ≤ `maxWagons` — inaczej ruch zablokowany z komunikatem.
3. Ruch odbywa się po aktywnych połączeniach rozjazdów. Jeśli czoło składu dojeżdża do rozjazdu,
   którego stan nie łączy bieżącego odcinka z dalszą drogą → zatrzymanie przed rozjazdem
   (brak „rozpruwania” rozjazdu) i komunikat.
4. Rozjazdu nie można przełożyć, gdy w jego strefie (± `switchFoulingDistance`) stoi pojazd.
5. Kozioł oporowy: zatrzymanie na końcu odcinka.
6. Kolizja: gdy odstęp do innego składu spadnie do `couplingGap` → zatrzymanie; przy
   auto-sprzęganiu oba składy łączą się w jeden.
7. Wyjazd ze stacji (węzeł `exit`): skład może wyjechać — pojazdy znikają ze schematu
   (akcja `remove`). Wjazd: akcja `spawn` wstawia skład przy węźle `exit`.
8. Rozprzęgnięcie dzieli skład na dwa; część bez pojazdu trakcyjnego zostaje na miejscu.
9. Silnik nie zna czasu — animacja w warstwie UI interpoluje kolejne stany
   (`step(state, dt, speed)`), a akcje scenariusza są wykonywane do zakończenia.
10. Licznik zajętości: dla każdego toru (pole `track`) liczba wagonów (bez pojazdów trakcyjnych),
    wyświetlana jak na rysunku 1: „8 wagonów”, „9 wagonów” (poprawna odmiana: 1 wagon,
    2–4 wagony, 5+ wagonów, 12–14 wagonów).

Wymagane testy (Vitest) — minimum:
- przejazd przez S1 prosto i w łącznik; zatrzymanie przed źle ustawionym rozjazdem,
- kozioł oporowy, kolizja + auto-sprzęgnięcie, rozprzęgnięcie,
- limit wagonów shuntera, blokada przełożenia zajętego rozjazdu,
- przejazd składu przez X1 we wszystkich trzech stanach (w tym tor 67 → łącznik → tor 3),
- odtworzenie scenariusza przykładowego od początku do końca bez błędów i stan końcowy:
  wagon R1 w hali na torze 69.

## 8. Rysowanie (SVG)
- Tor = dwie równoległe linie (szyny), grubość ~1,5, kolor ciemny — jak na rysunkach.
- Pojazd = prostokąt obrócony wzdłuż odcinka, wysokość ~20 jednostek, obrys #0F2F3F.
  Shunter = wąski prostokąt (rzeczywista długość 3 m).
- Sprzęg = krótka kreska między pojazdami; brak sprzęgu = pusta przerwa.
- Zaznaczony pojazd: żółta poświata. Pojazd prowadzący w trybie Jazda: strzałka kierunku.
- Rozjazd: mały okrąg w węźle (klikalny), aktywna droga lekko podświetlona.
- Hala: prostokąt #FBE3D6 z obrysem, pionowa linia ściany, szary kanał #BDBDBD.
- Etykiety „tor 63”, „tor 65”, „tor 67”, „tor 69”, „tor 3” oraz liczniki wagonów.
- Legenda (jak na rysunku 1) w górnej części ekranu.
- Ramka opisu kroku: tytuł + lista z ❑ w prawym górnym rogu.
- Animacja płynna (requestAnimationFrame), domyślnie ~40 jednostek/s.

## 9. Układ ekranu
```
┌──────────────────────────────────────────────────────────────┐
│ Logo/nazwa | Edycja | Jazda | Scenariusz | ▶ Prezentacja | ⚙ │
├──────────────────────────────────────────────┬───────────────┤
│ Legenda                                      │ Panel boczny  │
│                                              │ (zależny od   │
│        SCHEMAT STACJI (SVG)                  │  trybu)       │
│                                              │               │
├──────────────────────────────────────────────┴───────────────┤
│ Pasek stanu / sterowanie odtwarzaniem / komunikaty           │
└──────────────────────────────────────────────────────────────┘
```
Minimalna rozdzielczość 1280×720. Responsywność mobilna — nie wymagana.

## 10. Format scenariusza
```json
{
  "id": "wstawienie-na-naprawe",
  "title": "Wstawienie wagonów na naprawę",
  "initialState": {
    "switches": { "S1": 0, "S2": 0, "X1": 0 },
    "placements": [
      { "edge": "e3W", "startOffset": 33, "vehicles": [
          { "id": "LOK1", "type": "lokomotywa" },
          { "id": "R1", "type": "wagon_rev", "number": "…" } ] }
    ]
  },
  "steps": [
    { "title": "…", "bullets": ["…"], "actions": [ … ] }
  ]
}
```
`placements`: pojazdy ułożone wzdłuż kierunku odcinka (od węzła `from`), od `startOffset`,
kolejno sprzęgnięte.

Akcje:
| type | pola | znaczenie |
|---|---|---|
| `setSwitch` | `switch`, `state` | przełożenie rozjazdu |
| `driveTo` | `vehicle`, `edge`, `offset` | skład z pojazdem jedzie, aż środek `vehicle` stanie w punkcie; silnik sam wybiera kierunek (punkt musi być osiągalny bez zmiany kierunku przy bieżących rozjazdach) |
| `driveAndCouple` | `vehicle`, `to` | jazda do najbliższego styku z pojazdem `to` i sprzęgnięcie |
| `couple` | `between: [a, b]` | sprzęgnięcie stykających się pojazdów |
| `uncouple` | `between: [a, b]` | rozprzęgnięcie |
| `spawn` | `exit`, `vehicles` | wjazd składu na stację |
| `remove` | `vehicles` | zjazd ze stacji |
| `wait` | `ms` | pauza w animacji |
| `highlight` | `vehicles` / `track`, `ms` | podświetlenie dla uwagi widzów |

Nagrywanie w trybie Jazda zapisuje przejazdy jako `driveTo` (punkt zatrzymania po puszczeniu
klawisza). Błędna akcja przy odtwarzaniu → zatrzymanie z czytelnym komunikatem (nr kroku i akcji).

## 11. Zapis danych
- Autozapis bieżącej pracy do localStorage.
- Eksport/Import: pojedynczy scenariusz lub komplet (JSON).
- Scenariusze „oficjalne” do prezentacji trzymane w repo w `src/data/scenarios/*.json`
  (zmiana = commit = nowa wersja na GitHub Pages).

## 12. Struktura projektu
```
/
├─ CLAUDE.md
├─ README.md                 # opis, link do GitHub Pages, zrzut ekranu/GIF
├─ docs/
│  ├─ SPEC.md
│  ├─ station.json            # wzór układu
│  ├─ scenario-wstawienie-na-naprawe.json
│  └─ img/                    # rysunki referencyjne (slajdy)
├─ src/
│  ├─ data/station.json
│  ├─ data/scenarios/*.json
│  ├─ engine/                 # topology.ts, movement.ts, consist.ts, switches.ts,
│  │                          # actions.ts, scenarioRunner.ts, types.ts, *.test.ts
│  ├─ store/                  # useStationStore.ts, usePlaybackStore.ts
│  ├─ components/station/     # StationSvg, Track, Vehicle, Switch, Hall, Labels
│  ├─ ui/                     # Toolbar, Legend, SidePanel, StepList, PlaybackBar, Palette
│  ├─ App.tsx, main.tsx
├─ .github/workflows/deploy.yml
├─ vite.config.ts             # base: '/<nazwa-repo>/'
└─ package.json
```

## 13. Etapy realizacji i kryteria akceptacji
**E0 — Szkielet i publikacja.** Vite+React+TS, ESLint, Vitest, workflow GitHub Pages.
✔ pusta strona z tytułem działa pod adresem GitHub Pages.

**E1 — Statyczny schemat.** Rysowanie z `station.json`: tory, łącznik, hala, etykiety, legenda,
rozjazdy. ✔ wygląd zbliżony do `docs/img/`.

**E2 — Tabor i Edycja.** Wczytanie stanu początkowego, rysowanie pojazdów, paleta, przeciąganie,
szybkie wypełnienie, usuwanie, liczniki wagonów. ✔ da się odtworzyć ręcznie rysunek 1
(8 wagonów na 63, 9 na 65, 11 na 67, 9 na 67/69 z wagonem w hali).

**E3 — Silnik ruchu + testy.** Reguły z rozdz. 7. ✔ wszystkie testy z rozdz. 7 zielone.

**E4 — Tryb Jazda.** Sterowanie, rozjazdy, sprzęganie/rozprzęganie, komunikaty, cofnij.
✔ ręcznie da się wykonać cały scenariusz z rysunków 2–4.

**E5 — Scenariusze.** Nagrywanie, odtwarzanie, snapshoty, edycja kroków, eksport/import,
wbudowany scenariusz przykładowy. ✔ scenariusz przykładowy odtwarza się płynnie od początku do końca.

**E6 — Prezentacja i szlif.** Tryb pełnoekranowy, link bezpośredni, README z GIF-em, poprawki
wizualne. ✔ prezentacja do przeprowadzenia samą klawiaturą.

## 14. Poza zakresem (na teraz)
Edytor układu torów w aplikacji (układ zmienia się w `station.json`), logowanie, backend,
wielu użytkowników naraz, wersja mobilna, rzeczywista fizyka (hamowanie, masy).

## 15. Otwarte pytania (do potwierdzenia z zamawiającym)
1. ~~Punkt X1: czy z łącznika można wjechać na tor 67/69 (rozjazd), czy to tylko skrzyżowanie?~~
   Rozstrzygnięte: X1 to rozjazd krzyżowy – oprócz jazdy prosto pozwala przejechać łukiem
   z łącznika (od S1) na tor 67/69 oraz z toru 67 (zachód) na łącznik do S2 (tor 3).
2. Gdzie dokładnie zaczyna się tor 69 (granica 67/69)? Przyjęto: wjazd do hali.
3. Czy tor 3 po obu stronach to wyjazd do stacji (wahadło)?
4. Rzeczywiste długości wagonów, platformy i shuntera; maksymalna liczba wagonów dla shuntera.
5. Czy na hali mieści się jeden czy kilka wagonów naraz?
