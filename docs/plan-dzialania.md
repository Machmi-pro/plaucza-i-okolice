# Plan działania: strona „Domy i mieszkańcy”

Płaucza Mała • Glinna • Płaucza Wielka | 1700–1945

Dokument opisuje, jak zbudować pierwszą wersję strony (Płaucza Mała) i jak ją potem rozszerzać o Glinną i Płauczę Wielką. Składa się z czterech części:

1. [Pozyskiwanie i opracowanie danych z akt](#1-pozyskiwanie-i-opracowanie-danych-z-akt)
2. [Architektura](#2-architektura)
3. [Etapy prac](#3-etapy-prac)
4. [Ryzyka i otwarte pytania](#4-ryzyka-i-otwarte-pytania)

Makieta mobilna znajduje się w [`mockup/index.html`](../mockup/index.html). Dane w makiecie są przykładowe i nie pochodzą z akt.

---

## 1. Pozyskiwanie i opracowanie danych z akt

### 1.1. Zasada ogólna

Dane powstają w dwóch krokach, które są od siebie oddzielone:

1. **Wykaz źródeł.** Najpierw ustalamy, jakie księgi istnieją, gdzie są przechowywane, jakie roczniki obejmują i czy mają skany. To jest „mapa” materiału, niezależna od tego, czy coś już przepisano.
2. **Opracowanie wpisów.** Dopiero potem przepisujemy akty z konkretnych ksiąg do arkusza, rocznik po roczniku.

Dzięki temu strona od pierwszego dnia potrafi odpowiedzieć na pytanie „dlaczego nic nie ma?”: wykaz źródeł mówi, czy rocznik jest opracowany, czeka na opracowanie, jest znany tylko z katalogu, czy źródła jeszcze nie ustalono.

Strona **nie pobiera danych automatycznie** z archiwów. Archiwa udostępniają inwentarze i skany, ale nie treść aktów w postaci danych, więc treść wpisów zawsze pochodzi z ręcznego odczytu skanu. Automatyzujemy tylko to, co da się zautomatyzować bez ryzyka błędu: wczytanie inwentarzy do wykazu źródeł, kontrolę poprawności arkuszy i budowę strony.

### 1.2. Źródła i co z każdego bierzemy

| Źródło | Co zawiera | Co z niego bierzemy | Sposób pozyskania |
|---|---|---|---|
| AGAD, zespół 301 (metryki rzymskokatolickie), inwentarz XML `KLwo301new.xml` | Opis jednostek: parafia, miejscowości, rodzaj akt, roczniki, sygnatura | Pozycje wykazu źródeł dla parafii obejmujących nasze wsie (m.in. Kozłów, Budyłów, później Płaucza Mała) | Pobranie pliku XML i półautomatyczny wybór jednostek, w których występują nazwy wsi i ich warianty |
| AGAD, zespół 298 (metryki greckokatolickie), inwentarz XML `ksGrec298.xml` | Jak wyżej, dla obrządku greckokatolickiego | Pozycje wykazu źródeł dla parafii greckokatolickich | Jak wyżej |
| Szukaj w Archiwach (szukajwarchiwach.gov.pl) | Opis jednostki i skany, np. Budyłów 1896–1909 (AGAD 301/1831), Płaucza Wielka z filiami 1847–1848 | Potwierdzenie dostępności skanów, stały link do jednostki i do konkretnej karty | Ręczne sprawdzenie każdej jednostki z wykazu; zapis linku do jednostki i, przy opracowaniu, do skanu konkretnej strony |
| Archiwum Historyczne we Lwowie (CDIAL, przeglądarka archium.tsdial.archives.gov.ua) | Galerie skanów ksiąg greckokatolickich | Pozycje wykazu źródeł (fond/opis/sprawa) i linki do galerii | Ręczne przejrzenie galerii, zapis sygnatury, zakresu lat i miejscowości z karty tytułowej |
| Prasa i inne publikacje | Opisy wydarzeń, np. pożaru Płauczy Małej w 1910 r. | Wydarzenia na osi czasu i ich źródła | Ręczny wpis do arkusza wydarzeń z pełnym opisem bibliograficznym |

Podczas przygotowania planu nie było dostępu sieciowego do inwentarzy AGAD, więc **konkretne sygnatury poza tymi z listy wyjściowej trzeba dopiero ustalić** (krok 1 w etapie A poniżej).

### 1.3. Wykaz źródeł: jak go zbudować

1. **Inwentarze XML AGAD.** Skrypt `tools/import-inwentarz` czyta plik XML, szuka jednostek, w których tytuł lub opis zawiera nazwę jednej z wsi albo nazwę parafii, do której wieś należała, i zapisuje kandydatów do pliku `data/zrodla-kandydaci.csv`. Wyszukiwanie korzysta z tej samej normalizacji co wyszukiwarka strony (sekcja 2.4), więc znajdzie np. „Płaucza”, „Plaucza”, „Płaucza Mała”, „Плавуча Мала”, jeśli warianty są wpisane w danych wsi.
2. **Weryfikacja ręczna.** Kandydat trafia do właściwego wykazu `data/zrodla.csv` dopiero po sprawdzeniu przez człowieka: czy jednostka faktycznie obejmuje wieś, jakie ma roczniki, rodzaj akt (urodzenia, małżeństwa, zgony; księga, alegata, duplikat) i obrządek.
3. **Skany.** Dla każdej jednostki sprawdzamy w Szukaj w Archiwach lub w przeglądarce lwowskiej, czy skany są dostępne w całości, częściowo, czy wcale. Wynik zapisujemy w polu dostępności skanów, a link do jednostki w polu `link`.
4. **Stan per rocznik.** Jednostka może obejmować wiele lat, a każdy rok może mieć inny stan. Dlatego obok wykazu źródeł prowadzimy tabelę `data/roczniki.csv`: jeden wiersz = wieś + obrządek + rocznik + źródło + stan opracowania.

Stany opracowania rocznika (stała lista, ta sama na stronie i w arkuszach):

| Kod | Nazwa na stronie | Znaczenie |
|---|---|---|
| `opracowany` | Opracowany | Wszystkie akty z tego rocznika dotyczące wsi są przepisane i sprawdzone |
| `w_opracowaniu` | W opracowaniu | Część aktów jest przepisana |
| `skany_calosc` | Skany do opracowania | Skany są dostępne w całości, nic jeszcze nie przepisano |
| `skany_czesc` | Skany częściowe | Skany są dostępne tylko dla części rocznika |
| `katalog` | Znany z katalogu | Księga figuruje w inwentarzu, ale nie ma potwierdzonego dostępu do skanów |
| `brak_ustalen` | Źródła nie ustalono | Nie wiadomo jeszcze, gdzie są akta z tego roku |

Przykład ze specyfikacji: dla Płauczy Małej lata 1809–1817 dostają stan `katalog` albo `brak_ustalen` (zależnie od wyniku kwerendy) z uwagą „brak potwierdzonego dostępu do skanów”.

### 1.4. Opracowanie wpisów (ręczne)

Opracowanie robimy w arkuszu (LibreOffice Calc albo Arkusze Google), bo to najwygodniejsze narzędzie do szybkiego przepisywania. Arkusz ma stałe kolumny zgodne z modelem danych (sekcja 2.2) i listy rozwijane dla pól słownikowych (rola, rodzaj aktu, obrządek, pewność).

Kolejność pracy dla jednego rocznika:

1. Otwórz skan księgi z linku w wykazie źródeł.
2. Dla każdego aktu dotyczącego wsi dodaj jeden wiersz w zakładce **Akty**: źródło, data, numer aktu lub strona, link do karty skanu, rodzaj aktu.
3. Dla każdej osoby wymienionej w akcie dodaj wiersz w zakładce **Osoby we wpisie**: imię i nazwisko **tak, jak są zapisane**, rola (dziecko, ojciec, matka, chrzestny, świadek, zmarły, pan młody, panna młoda, akuszerka, kapłan itd.), nazwisko panieńskie, wieś zamieszkania i numer domu **tylko jeśli akt je podaje**.
4. Numer domu zapisz dwa razy: w postaci źródłowej (np. „47/2”, „ad 47”, „XLVII”) i w postaci znormalizowanej do sortowania (np. `47`). Jeśli odczyt jest niepewny, zaznacz to w polu pewności, nie poprawiaj źródła.
5. Pole **pewność odczytu** ma trzy wartości: `pewny`, `niepewny` (odczyt prawdopodobny, ale nie oczywisty), `nieczytelny` (zapisujemy to, co widać, np. „Kow…ki”). Pewność dotyczy osobno nazwiska i numeru domu.
6. Gdy rocznik jest skończony, zmień jego stan w `roczniki.csv` na `w_opracowaniu`, a po kontroli jakości na `opracowany`.

Zasady, które wynikają wprost ze specyfikacji i które trzeba pilnować przy wpisywaniu:

- Numer domu przypisujemy osobie tylko wtedy, gdy źródło wiąże ją z tym adresem. Chrzestni i świadkowie bez adresu zostają w szczegółach aktu, ale nie trafiają na listę mieszkańców domu.
- Nie łączymy osób ani rodzin tylko dlatego, że nazwiska są takie same lub podobne. Łączenie wariantów pisowni dotyczy wyszukiwania, nie tożsamości.
- Rok wystąpienia potwierdza wzmiankę, a nie ciągłość zamieszkania.
- Ten sam akt zachowany w dwóch kopiach (np. księga parafialna i duplikat, albo zapis w obu obrządkach) wpisujemy jako dwie wzmianki, każdą ze swoim źródłem, i łączymy je wspólnym identyfikatorem zdarzenia.

### 1.5. Warianty nazwisk

Warianty prowadzimy w osobnej tabeli `data/warianty-nazwisk.csv`: jeden wiersz = grupa wariantów (np. `kowalczuk`: Kowalczuk, Kowalczuck, Ковальчук, Kowalczukowa). Grupę tworzy osoba opracowująca, gdy uzna warianty za ten sam rdzeń nazwiska. Każda osoba we wpisie dostaje w polu „wariant wyszukiwawczy” identyfikator grupy. Pisownia źródłowa zostaje bez zmian.

Formy żeńskie (‑owa, ‑ówna, ‑ska/‑ski) i zapisy cyrylicą lub łaciną dołączamy do grupy, ale grupa nie oznacza pokrewieństwa.

### 1.6. Import do struktury danych

Arkusz jest narzędziem pracy, a źródłem prawdy są pliki CSV w repozytorium (`data/`). Ścieżka:

1. Eksport zakładek arkusza do CSV (UTF‑8, separator przecinek) do katalogu `data/<wieś>/`.
2. `git commit` i pull request. Dzięki temu każda zmiana w danych ma historię: kto, kiedy, co zmienił.
3. Automatyczna kontrola (GitHub Actions) uruchamia walidator i buduje podgląd strony.
4. Po akceptacji dane trafiają na stronę przy następnym buildzie.

Jeśli zespół woli pracować w Arkuszach Google bez ręcznego eksportu, można później dodać skrypt, który pobiera arkusz i tworzy z niego pull request. W pierwszej wersji wystarcza eksport ręczny.

### 1.7. Kontrola jakości

Kontrola ma dwie warstwy.

**Automatyczna (walidator, przy każdym pull requeście):**

- każde pole słownikowe ma dozwoloną wartość (rola, obrządek, rodzaj aktu, pewność, stan opracowania);
- każdy akt wskazuje istniejące źródło, a każda osoba istniejący akt;
- data aktu mieści się w rocznikach źródła;
- numer domu znormalizowany jest liczbą (lub pusty), a źródłowy nie jest pusty, gdy znormalizowany jest wypełniony;
- osoba z numerem domu ma wypełnioną wieś zamieszkania;
- rocznik oznaczony jako `opracowany` ma co najmniej jeden akt albo jawną uwagę „brak aktów dla wsi w tym roczniku”;
- każdy rok, który strona pokaże przy nazwisku, ma co najmniej jeden akt (warunek odbioru z punktu 7 specyfikacji);
- ostrzeżenia (nie błędy): podejrzanie duży numer domu jak na wieś, ta sama osoba wpisana dwa razy w jednym akcie, akt bez żadnej osoby.

**Ręczna (druga osoba):**

- losowa próbka 10% aktów z każdego rocznika jest sprawdzana ze skanem przez drugą osobę;
- wszystkie wpisy oznaczone `niepewny` lub `nieczytelny` są przeglądane przez drugą osobę;
- rocznik przechodzi na `opracowany` dopiero po tym przeglądzie;
- wynik kontroli (kto, kiedy, ile poprawek) zapisujemy w `roczniki.csv` w kolumnach `sprawdzil` i `data_kontroli`.

### 1.8. Stan opracowania roczników na stronie

Strona pokazuje stan na trzech poziomach:

- **przy okresie na osi czasu:** znacznik „są opracowane wpisy” albo „brak opracowanych wpisów”, liczony z `roczniki.csv`;
- **w szczegółowym wykazie okresu:** lista roczników z kolorowym stanem (opracowany / skany do opracowania / częściowo / znany z katalogu / nie ustalono), osobno dla każdego obrządku;
- **przy pustym wyniku:** zamiast samego „brak wyników” strona mówi, dlaczego: np. „Roczniki 1836–1851 obrządku greckokatolickiego mają skany, ale czekają na opracowanie” i podaje link do widoku Źródła.

---

## 2. Architektura

### 2.1. Założenia

- Strona jest **statyczna**: wszystkie dane są znane w chwili budowania, nie ma potrzeby bazy danych ani serwera. To obniża koszty do zera, upraszcza utrzymanie i zapewnia, że strona działa latami bez opieki.
- Dane są **w repozytorium jako CSV**, czytelne bez żadnego programu i łatwe do przeglądu w pull requeście.
- Wszystkie wsie korzystają z tego samego kodu i tych samych widoków. Dodanie wsi to dodanie danych, nie kodu.
- **Mobile first**: projektujemy dla telefonu o szerokości 360 px, bez przewijania w poziomie.

### 2.2. Model danych

```
Wieś 1 ──< Źródło (przez listę miejscowości) >── n
Źródło 1 ──< Rocznik (stan opracowania)
Źródło 1 ──< Akt / wzmianka
Akt 1 ──< Osoba we wpisie
Zdarzenie 1 ──< Akt (kopie tego samego aktu, opcjonalnie)
Wieś 1 ──< Wydarzenie >──< Źródło
Wydarzenie >──< Dom (opcjonalne powiązania)
Grupa wariantów nazwiska 1 ──< Osoba we wpisie
```

**Wieś** (`data/wsie.csv`)

| Pole | Typ | Uwagi |
|---|---|---|
| `id` | tekst | np. `plaucza-mala`, `glinna`, `plaucza-wielka` |
| `nazwa` | tekst | nazwa wyświetlana |
| `warianty_nazwy` | lista | np. `Płaucza Mała; Plaucza Mała; Płaucza parva; Плавуча Мала` |
| `opis` | tekst | krótki opis historyczny |
| `aktywna` | tak/nie | czy wieś jest widoczna na stronie |

**Źródło** (`data/zrodla.csv`)

| Pole | Typ | Uwagi |
|---|---|---|
| `id` | tekst | np. `agad-301-1831` |
| `typ` | słownik | `metryka`, `prasa`, `publikacja`, `inne` |
| `archiwum` | tekst | lub tytuł publikacji |
| `zespol`, `sygnatura` | tekst | np. `301`, `1831` |
| `parafia` | tekst | np. `Budyłów` |
| `obrzadek` | słownik | `rz` (rzymskokatolicki), `gk` (greckokatolicki), puste dla prasy |
| `rodzaj_akt` | lista | `U`, `M`, `Z` (urodzenia, małżeństwa, zgony) |
| `rok_od`, `rok_do` | liczba | |
| `wsie` | lista id | miejscowości, których dotyczy |
| `skany` | słownik | `calosc`, `czesc`, `brak`, `nieznane` |
| `link` | URL | do jednostki w archiwum |
| `uwagi` | tekst | |

**Rocznik** (`data/roczniki.csv`): `wies`, `obrzadek`, `rok`, `rodzaj_akt`, `zrodlo`, `stan` (sekcja 1.3), `uwagi`, `sprawdzil`, `data_kontroli`.

**Akt lub wzmianka** (`data/<wieś>/akty.csv`)

| Pole | Typ | Uwagi |
|---|---|---|
| `id` | tekst | `<źródło>-<rok>-<nr>`, np. `agad-301-1831-1902-U-047` |
| `zrodlo` | id | |
| `data` | data lub rok | `1902-03-14`, `1902-03`, `1902` (dokładność zachowana) |
| `wies` | id | wieś, której dotyczy wpis |
| `rodzaj` | słownik | `U`, `M`, `Z`, `wzmianka` |
| `nr_aktu`, `strona` | tekst | |
| `link_skan` | URL | do konkretnej karty, jeśli jest |
| `zdarzenie` | id | wspólny identyfikator kopii tego samego aktu |
| `uwagi_odczytu` | tekst | |

**Osoba we wpisie** (`data/<wieś>/osoby.csv`)

| Pole | Typ | Uwagi |
|---|---|---|
| `akt` | id | |
| `lp` | liczba | kolejność w akcie |
| `imie` | tekst | jak w dokumencie |
| `nazwisko` | tekst | jak w dokumencie |
| `nazwisko_panienskie` | tekst | jak w dokumencie |
| `wariant` | id grupy | z `warianty-nazwisk.csv` |
| `rola` | słownik | `dziecko`, `ojciec`, `matka`, `chrzestny`, `chrzestna`, `swiadek`, `zmarly`, `pan_mlody`, `panna_mloda`, `rodzic_pana_mlodego`, `rodzic_panny_mlodej`, `akuszerka`, `kaplan`, `inna` |
| `wies_zamieszkania` | id | tylko jeśli źródło podaje |
| `dom_zrodlowy` | tekst | numer domu w postaci ze źródła |
| `dom` | liczba | numer znormalizowany do sortowania |
| `pewnosc_nazwiska` | słownik | `pewny`, `niepewny`, `nieczytelny` |
| `pewnosc_domu` | słownik | jak wyżej |
| `mieszkaniec` | tak/nie | czy źródło wiąże osobę z domem (decyduje o liście mieszkańców) |

**Wydarzenie** (`data/<wieś>/wydarzenia.csv`): `id`, `wies`, `tytul`, `data_od`, `data_do`, `data_pewna` (tak/nie), `opis`, `zrodla` (lista id), `domy` (lista numerów), `podzial` (tak/nie: czy wydarzenie dzieli okres na „przed” i „od roku”).

**Okresy osi czasu** (`data/okresy.csv`, wspólne dla wszystkich wsi): `czesc` (1–4), `rok_od`, `rok_do`, `etykieta`, oraz `uwagi_wsi` jako osobna tabela `wies + okres + opis`, bo opisy w specyfikacji są częściowo specyficzne dla Płauczy Małej.

Klucz domu na stronie to zawsze para **wieś + numer**. Ten sam numer w innej wsi to osobna karta.

### 2.3. Budowanie strony

```
data/*.csv ──► walidator ──► generator indeksów ──► dist/data/*.json ──► front (HTML/JS/CSS) ──► hosting
```

1. **Walidator** (Node.js, jeden skrypt) czyta CSV i sprawdza reguły z sekcji 1.7. Błąd zatrzymuje build.
2. **Generator indeksów** tworzy dla każdej wsi gotowe pliki JSON:
   - `domy-<wieś>.json`: dla każdego domu lista wystąpień (rok, nazwisko, akt), już posortowana liczbowo;
   - `akty-<wieś>.json`: szczegóły aktów z osobami;
   - `szukaj.json`: indeks wyszukiwania dla wszystkich wsi (nazwisko znormalizowane, grupa wariantów, wieś, dom, lata, id aktów);
   - `stan.json`: stan roczników per wieś, obrządek i okres;
   - `wydarzenia.json`.
   Dla tysięcy aktów pliki mają rozmiar rzędu setek kilobajtów, więc wyszukiwanie w przeglądarce jest szybkie i nie trzeba serwera.
3. **Front** to lekka aplikacja jednostronicowa. Rekomendacja: **Astro** (generuje statyczny HTML, mało JavaScriptu) albo, jeśli zespół woli minimum narzędzi, zwykły HTML i JavaScript jak w makiecie. Rekomenduję Astro, bo daje prerenderowane strony domów (dobre do linkowania i indeksowania przez wyszukiwarki) przy niewielkim koszcie.
4. **Adresy URL** są stałe i czytelne, żeby dało się je cytować:
   - `/plaucza-mala/` ekran wsi
   - `/plaucza-mala/okres/1836-1851/` widok okresu
   - `/plaucza-mala/dom/47/` karta domu
   - `/plaucza-mala/akt/agad-301-1831-1902-U-047/` wzmianka
   - `/plaucza-mala/wydarzenie/pozar-1910/`
   - `/szukaj/?q=kowal&wies=plaucza-mala`
   Filtry (rocznik, obrządek, rodzaj aktu) trafiają do parametrów adresu, więc zachowują się przy zmianie wsi i można je udostępnić linkiem.

### 2.4. Wyszukiwanie

Normalizacja (ta sama w buildzie i w przeglądarce):

1. zamiana na małe litery;
2. rozkład Unicode NFD i usunięcie znaków diakrytycznych (ą→a, ć→c, ę→e, ń→n, ó→o, ś→s, ź/ż→z);
3. osobna zamiana `ł→l` (nie rozkłada się w NFD);
4. transliteracja cyrylicy na łacinę wg prostej tabeli (dla zapisów greckokatolickich);
5. usunięcie spacji, myślników i apostrofów.

Dopasowanie:

- fragment: wynik, gdy znormalizowane zapytanie jest podciągiem znormalizowanego nazwiska lub nazwiska panieńskiego;
- warianty: jeżeli zapytanie pasuje do któregokolwiek nazwiska w grupie wariantów, pokazujemy wszystkie nazwiska z tej grupy, z oznaczeniem „wariant pisowni”;
- domyślnie tylko wybrana wieś, przełącznik „Wszystkie wsie” rozszerza zakres;
- wynik grupujemy po (wieś, dom, nazwisko w pisowni źródłowej) i pokazujemy lata wystąpień; brak numeru daje grupę „Bez numeru domu”.

Przy kilku tysiącach osób proste przeszukanie tablicy w przeglądarce trwa milisekundy, więc nie potrzeba silnika wyszukiwania. Gdy danych będzie kilkadziesiąt tysięcy, można dodać gotową bibliotekę (np. MiniSearch) bez zmiany interfejsu.

### 2.5. Front mobilny

- Układ jednokolumnowy, maksymalna szerokość treści ok. 640 px, na komputerze wyśrodkowany.
- Oś czasu jako pionowa lista czterech rozwijanych części (`<details>`), w środku przyciski okresów. Znacznik wydarzenia ma inny kształt i etykietę „Wydarzenie”.
- Wybrany okres i filtry są w adresie URL, więc przetrwają zmianę wsi i odświeżenie strony.
- Długie nazwiska i sygnatury łamią się (`overflow-wrap: anywhere`), nic nie wymusza przewijania w poziomie.
- Dostępność: kontrast WCAG AA, obsługa klawiaturą, prawdziwe przyciski i linki, etykiety dla czytników ekranu, tryb ciemny.
- Strona działa bez JavaScriptu w zakresie przeglądania (prerenderowane strony Astro); JavaScript jest potrzebny tylko do wyszukiwarki i filtrów.

### 2.6. Hosting i repozytorium

- **Hosting:** GitHub Pages (bezpłatny, wbudowany w repozytorium). Alternatywa: Netlify lub Cloudflare Pages, jeśli potrzebne będą podglądy dla każdego pull requestu. Własna domena możliwa w obu przypadkach.
- **CI:** GitHub Actions: przy każdym pull requeście walidacja danych i build; po scaleniu z `main` publikacja.
- **Struktura repozytorium:**

```
data/
  wsie.csv  okresy.csv  zrodla.csv  roczniki.csv  warianty-nazwisk.csv
  plaucza-mala/  akty.csv  osoby.csv  wydarzenia.csv
  glinna/ ...
  plaucza-wielka/ ...
tools/
  import-inwentarz.mjs   walidator.mjs   generuj-indeksy.mjs
src/          (front, Astro)
docs/         (ten plan, instrukcja opracowania)
mockup/       (makieta)
```

- **Kopie zapasowe:** repozytorium Git jest kopią samo w sobie; skany nie są przechowywane w repozytorium, tylko linkowane do archiwów.
- **Prawa:** linkujemy do skanów w serwisach archiwów, nie kopiujemy ich. Przed ewentualnym publikowaniem fragmentów skanów trzeba sprawdzić warunki ponownego wykorzystania w danym archiwum.

### 2.7. Dane osobowe

Akta z lat 1700–1945 dotyczą w ogromnej większości osób zmarłych, ale część aktów urodzeń z lat 30. i 40. XX w. może dotyczyć osób żyjących. Proponuję zasadę: akty urodzeń młodsze niż 100 lat i akty małżeństw młodsze niż 80 lat pokazujemy tylko w postaci zanonimizowanej (rok, rodzaj, dom) do czasu decyzji właściciela projektu. Walidator może to wymuszać automatycznie.

---

## 3. Etapy prac

| Etap | Zakres | Wynik |
|---|---|---|
| **A. Wykaz źródeł Płauczy Małej** | Import inwentarzy 301 i 298, wybór jednostek, sprawdzenie skanów w Szukaj w Archiwach i w Archiwum we Lwowie, uzupełnienie `zrodla.csv` i `roczniki.csv` dla 1700–1945 | Pełna mapa materiału; strona może już pokazać widok Źródła i stan opracowania |
| **B. Szkielet danych i narzędzia** | Szablon arkusza, walidator, generator indeksów, instrukcja opracowania w `docs/` | Gotowy proces od skanu do JSON |
| **C. Pierwszy opracowany okres** | Opracowanie rocznika testowego (np. 1892, gdzie można zestawić oba obrządki), potem całego okresu 1836–1851 | Pierwsze domy i nazwiska; test procesu kontroli jakości |
| **D. Front pierwszej wersji** | Ekran wsi, oś czasu, lista i karta domu, wyszukiwarka, widok Źródła, puste wyniki, karta pożaru 1910 | Strona spełniająca warunki odbioru z punktu 7 specyfikacji |
| **E. Publikacja** | GitHub Pages, testy na telefonach, poprawki dostępności | Pierwsza wersja publiczna |
| **F. Kolejne okresy i wsie** | Opracowanie kolejnych roczników; dodanie Glinnej i Płauczy Wielkiej (tylko dane) | Rozbudowa bez zmian w kodzie |

Etapy A i B mogą iść równolegle. Etap D może zacząć się na danych przykładowych z makiety i przejść na prawdziwe, gdy skończy się etap C.

Sprawdzenie warunków odbioru (punkt 7 specyfikacji) w pierwszej wersji:

| Warunek | Jak spełniony |
|---|---|
| Wybór wsi, rozwinięcie osi, wybór okresu, karta domu bez przewijania w poziomie | Pionowa oś z `<details>`, układ jednokolumnowy, test automatyczny na szerokości 360 px |
| Domy sortowane liczbowo, każdy rok prowadzi do wpisu | Sortowanie po polu `dom` (liczba); walidator sprawdza, że każdy rok ma akt |
| Filtr obrządku i rocznika, wyszukiwanie w wielu okresach, wzmianki bez numeru | Filtry w widoku okresu; wyszukiwarka przeszukuje wszystkie lata; grupa „Bez numeru domu” |
| Pusty wynik wyjaśnia stan materiału | Komunikat budowany z `roczniki.csv` |
| Karta pożaru: oba zakresy i opis źródła | Wydarzenie z `podzial = tak` daje przejścia „Domy przed pożarem” (1896–1909) i „Domy od roku pożaru” (1910–1918) |
| Nowa wieś tylko przez dane | Kod nie zawiera nazw wsi; wszystko z `wsie.csv` |

---

## 4. Ryzyka i otwarte pytania

1. **Dostęp do skanów lwowskich.** Przeglądarka Archiwum we Lwowie bywa niedostępna lub zmienia adresy. Zapisujemy w danych sygnaturę (fond/opis/sprawa) obok linku, żeby link dało się odtworzyć.
2. **Numeracja domów.** Numery mogły się zmieniać (np. po pożarze 1910 r. lub przy nowych spisach). Model zachowuje numer źródłowy i nie łączy domów między okresami; do potwierdzenia, czy chcemy później dodać ręczne powiązania „dom X przed pożarem = dom Y po pożarze” jako osobną, udokumentowaną informację.
3. **Przynależność parafialna.** Płaucza Mała należała w różnych latach do różnych parafii (Kozłów, Budyłów, od 1932 r. własna parafia rzymskokatolicka). Wykaz źródeł musi to odzwierciedlać per rocznik; do ustalenia pełna lista parafii greckokatolickich.
4. **Data pożaru 1910.** Do czasu ustalenia dokładnej daty wpisy z 1910 r. są w widoku „Od roku pożaru” bez przypisania „przed/po”. Ustalenie daty z prasy jest osobnym zadaniem kwerendy.
5. **Kto opracowuje dane.** Plan zakłada jedną lub kilka osób przepisujących i drugą osobę do kontroli. Jeśli będzie tylko jedna osoba, kontrolę próbkową warto zrobić z odstępem czasu.
6. **Ochrona danych osobowych** (sekcja 2.7): do decyzji właściciela projektu.
