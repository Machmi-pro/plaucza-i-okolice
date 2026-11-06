#!/usr/bin/env python3
"""Wczytuje data/<wies>/akty.csv i osoby.csv do makiety (mockup/index.html).

Wstawia wygenerowany kod JS między znaczniki REAL-DATA-START i REAL-DATA-END.
Sprawdza spójność danych i wypisuje ostrzeżenia. Użycie:
    python3 tools/wczytaj_do_makiety.py
"""
import csv, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / "mockup" / "index.html"
# wieś (katalog) -> id wsi w makiecie, obrządek i klucz źródła w makiecie
WSIE = {"plaucza-wielka": {"id": "pw", "rite": "gk", "src": "pw47"}}
ROLE = {"dziecko", "ojciec", "matka", "chrzestny", "chrzestna", "swiadek", "zmarly", "zmarla",
        "pan_mlody", "panna_mloda", "rodzic_pana_mlodego", "rodzic_panny_mlodej",
        "dziadek_matki", "maz_chrzestnej", "akuszerka", "kaplan", "inna"}
PEW = {"pewny", "niepewny", "nieczytelny", ""}
warn = []

def role_of(r):
    if r["rola"] != "inna":
        return r["rola"]
    u = r["uwagi"].lower()
    if u.startswith("ojciec matki"):
        return "dziadek_matki"
    if u.startswith("mąż chrzestnej"):
        return "maz_chrzestnej"
    return "inna"

def load(dirname, cfg):
    d = ROOT / "data" / dirname
    akty = list(csv.DictReader(open(d / "akty.csv", encoding="utf-8")))
    osoby = list(csv.DictReader(open(d / "osoby.csv", encoding="utf-8")))
    ids = [a["id"] for a in akty]
    if len(ids) != len(set(ids)):
        warn.append(f"{dirname}: powtórzone id aktu")
    by = {}
    for r in osoby:
        if None in r or len(r) != 13:
            warn.append(f"{dirname}: zła liczba kolumn w osobach: {r.get('akt')}")
        if r["akt"] not in ids:
            warn.append(f"{dirname}: osoba wskazuje nieistniejący akt {r['akt']}")
        if role_of(r) not in ROLE:
            warn.append(f"{dirname}: nieznana rola {r['rola']}")
        for k in ("pewnosc_nazwiska", "pewnosc_domu"):
            if r[k] not in PEW:
                warn.append(f"{dirname}: zła wartość {k}={r[k]}")
        by.setdefault(r["akt"], []).append(r)
    out = []
    for a in akty:
        rows = sorted(by.get(a["id"], []), key=lambda r: int(r["lp"]))
        if not rows:
            warn.append(f"{a['id']}: akt bez osób")
        father = next((r for r in rows if r["rola"] == "ojciec" and r["nazwisko"]), None)
        grand = next((r for r in rows if role_of(r) == "dziadek_matki" and r["nazwisko"]), None)
        people = []
        for r in rows:
            role = role_of(r)
            p = {"imie": r["imie"], "nazw": r["nazwisko"], "rola": role,
                 "dom": int(r["dom"]) if r["dom"].isdigit() else None,
                 "domSrc": r["dom_zrodlowy"], "miesz": r["mieszkaniec"] == "tak",
                 "pn": r["pewnosc_nazwiska"] or "pewny", "pd": r["pewnosc_domu"] or "pewny",
                 "pan": r["nazwisko_panienskie"], "note": r["uwagi"]}
            if role in ("dziadek_matki", "maz_chrzestnej"):
                p["note"] = ""                                          # rola już to mówi
            if role == "dziecko" and not p["nazw"] and father:
                p["nazw"], p["der"] = father["nazwisko"], True       # wyprowadzone z nazwiska ojca
            if role == "matka" and not p["pan"] and grand:
                p["pan"], p["panDer"] = grand["nazwisko"], True      # z wpisu o ojcu matki
            people.append(p)
        note = ""
        m = re.search(r"\d{4}-\d{2}-\d{2}", a["uwagi_odczytu"])
        if m and m.group(0) != a["data"]:
            note = f"Niezgodność dat w odczycie: w danych {a['data']}, w uwagach {m.group(0)}. Do sprawdzenia na skanie."
            warn.append(f"{a['id']}: {note}")
        elif a["uwagi_odczytu"] and not m:
            note = a["uwagi_odczytu"]
        elif a["uwagi_odczytu"].count(".") > 0 and "Illegitimi" in a["uwagi_odczytu"]:
            note = "Wpis w rubryce Illegitimi."
        out.append({"id": a["id"], "v": cfg["id"], "date": a["data"], "rite": cfg["rite"], "kind": a["rodzaj"],
                    "src": cfg["src"], "nr": a["nr_aktu"], "page": a["strona"], "scan": a["link_skan"],
                    "note": note, "unverified": True, "people": people})
    return out

acts = []
for dirname, cfg in WSIE.items():
    acts += load(dirname, cfg)
js = "\n".join("ACTS.push(" + json.dumps(a, ensure_ascii=False) + ");" for a in acts)
html = HTML.read_text(encoding="utf-8")
new, n = re.subn(r"/\*REAL-DATA-START\*/.*?/\*REAL-DATA-END\*/",
                 lambda m: "/*REAL-DATA-START*/\n" + js + "\n/*REAL-DATA-END*/", html, flags=re.S)
if n != 1:
    sys.exit("Brak znaczników REAL-DATA w mockup/index.html")
HTML.write_text(new, encoding="utf-8")
print(f"Wczytano {len(acts)} aktów, {sum(len(a['people']) for a in acts)} osób.")
for w in warn:
    print("OSTRZEŻENIE:", w)
