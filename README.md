# Płaucza i okolice

Strona „Domy i mieszkańcy”: historia mieszkańców Płauczy Małej, Glinnej i Płauczy Wielkiej (1700–1945) na podstawie akt metrykalnych obu obrządków i innych źródeł.

**Strona:** https://machmi-pro.github.io/plaucza-i-okolice/ (makieta: `/makieta/`)

- Strona ([index.html](index.html), `app.js`, `style.css` w katalogu głównym): statyczny HTML/JS, który przy otwarciu czyta dane z katalogu `data/`. Nie wymaga budowania. Publikuje ją workflow `.github/workflows/pages.yml` po każdej zmianie na `main`.
- [Plan działania](docs/plan-dzialania.md): pozyskiwanie i opracowanie danych z akt, architektura, etapy prac.
- [Makieta mobilna](mockup/index.html): statyczny plik HTML, do otwarcia w przeglądarce (najlepiej w trybie telefonu). Dane w makiecie są przykładowe, wygląd jasny i mobilny.
- [Dane](data/): pliki CSV z opracowanych aktów (odczyt AI, do sprawdzenia): Płaucza Wielka 1847 oraz księga Kozłowa 1818–1819. Wczytanie do makiety: `python3 tools/wczytaj_do_makiety.py`.

## Jak dodać dane

1. Nowe akty: katalog w `data/` z plikami `akty.csv` i `osoby.csv` (format jak w istniejących katalogach).
2. W `data/zrodla.json` dopisz źródło z polem `katalog_danych` wskazującym ten katalog (oraz obrządkiem, parafią, sygnaturą i linkiem).
3. Stan roczników: `data/stan-rocznikow.csv` (późniejsze wiersze nadpisują wcześniejsze). Wsie: `data/wsie.json`, okresy: `data/okresy.json`, wydarzenia: `data/wydarzenia.json`, warianty nazwisk: `data/warianty-nazwisk.json` (`{"grupa": ["Wariant1", "Wariant2"]}`).

Podgląd lokalny: `python3 -m http.server` w katalogu repozytorium i adres http://localhost:8000/ (strona nie działa otwarta wprost z dysku, bo wczytuje pliki CSV).
