#!/usr/bin/env python3
"""Wczytuje pliki CSV z katalogu data/ do makiety (mockup/index.html).

Wstawia wygenerowany kod JS między znaczniki REAL-DATA-START i REAL-DATA-END
oraz sprawdza spójność danych (ostrzeżenia na końcu). Użycie:
    python3 tools/wczytaj_do_makiety.py
"""
import csv, html, json, re, sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / "mockup" / "index.html"
NASZE_WSIE = {"pm", "pw", "gl"}
# katalog -> obrządek i klucz źródła w makiecie; "wies" = stała wieś albo None (z kolumny wies)
ZBIORY = [
    {"dir": "plaucza-wielka", "rite": "gk", "src": "pw47", "wies": "pw"},
    {"dir": "kozlow-1818-1819", "rite": "rz", "src": "cdial", "wies": None, "wies_domyslna": "pw"},
]
ROLE = {"dziecko", "ojciec", "matka", "chrzestny", "chrzestna", "swiadek", "zmarly", "zmarla",
        "pan_mlody", "panna_mloda", "rodzic_pana_mlodego", "rodzic_panny_mlodej",
        "dziadek_matki", "maz_chrzestnej", "akuszerka", "kaplan", "inna"}
PEW = {"pewny", "niepewny", "nieczytelny", ""}
# rola osoby -> rola rodzica, od którego można wyprowadzić brakujące nazwisko
RODZIC = {"dziecko": "ojciec", "zmarly": "ojciec", "zmarla": "ojciec",
          "pan_mlody": "rodzic_pana_mlodego", "panna_mloda": "rodzic_panny_mlodej"}
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

def d(s):
    return date.fromisoformat(s)

def load(cfg):
    dr = ROOT / "data" / cfg["dir"]
    akty = list(csv.DictReader(open(dr / "akty.csv", encoding="utf-8")))
    osoby = list(csv.DictReader(open(dr / "osoby.csv", encoding="utf-8")))
    ids = [a["id"] for a in akty]
    if len(ids) != len(set(ids)):
        warn.append(f"{cfg['dir']}: powtórzone id aktu")
    by = {}
    for r in osoby:
        if None in r or len(r) != 13:
            warn.append(f"{cfg['dir']}: zła liczba kolumn w osobach: {r.get('akt')}")
        if r["akt"] not in ids:
            warn.append(f"{cfg['dir']}: osoba wskazuje nieistniejący akt {r['akt']}")
        if role_of(r) not in ROLE:
            warn.append(f"{cfg['dir']}: nieznana rola {r['rola']}")
        for k in ("pewnosc_nazwiska", "pewnosc_domu"):
            if r[k] not in PEW:
                warn.append(f"{cfg['dir']}: zła wartość {k}={r[k]}")
        by.setdefault(r["akt"], []).append(r)
    out = []
    for a in akty:
        v = cfg["wies"] or a["wies"]
        note = html.unescape(a["uwagi_odczytu"])
        if not v:
            v = cfg["wies_domyslna"]
            msg = f"wieś aktu nie jest określona w odczycie; przypisano do sekcji księgi ({v})"
            note = f"Uwaga: {msg}. " + note
            warn.append(f"{a['id']}: {msg}")
        rows = sorted(by.get(a["id"], []), key=lambda r: int(r["lp"]))
        if not rows:
            warn.append(f"{a['id']}: akt bez osób")
        # data w uwagach a data w kolumnie: chrzest do 3 dni po urodzeniu jest normalny
        m = re.search(r"\d{4}-\d{2}-\d{2}", a["uwagi_odczytu"])
        if m and m.group(0) != a["data"]:
            diff = (d(m.group(0)) - d(a["data"])).days
            if not (0 < diff <= 3):
                msg = f"w danych {a['data']}, w uwagach {m.group(0)}"
                note = f"Niezgodność dat w odczycie: {msg}. Do sprawdzenia na skanie. " + note
                warn.append(f"{a['id']}: niezgodność dat ({msg})")
        people = []
        for r in rows:
            role = role_of(r)
            p = {"imie": r["imie"], "nazw": r["nazwisko"], "rola": role,
                 "dom": int(r["dom"]) if r["dom"].isdigit() else None,
                 "domSrc": r["dom_zrodlowy"], "miesz": r["mieszkaniec"] == "tak",
                 "pn": r["pewnosc_nazwiska"] or "pewny", "pd": r["pewnosc_domu"] or "pewny",
                 "pan": r["nazwisko_panienskie"], "note": html.unescape(r["uwagi"]), "wies": r["wies_zamieszkania"]}
            rw = r["wies_zamieszkania"]
            if p["miesz"] and rw and rw not in NASZE_WSIE:
                p["miesz"] = False        # numer domu dotyczy innej miejscowości
                p["note"] = (p["note"] + " " if p["note"] else "") + f"Zamieszkała w miejscowości „{rw}”, numer domu dotyczy tej miejscowości."
                warn.append(f"{a['id']}: osoba z miejscowości „{rw}” ma numer domu, pominięto ją na liście domów")
            elif p["miesz"] and rw in NASZE_WSIE and rw != v:
                warn.append(f"{a['id']}: osoba z {rw} w akcie dla {v}")
            if role in ("dziadek_matki", "maz_chrzestnej"):
                p["note"] = ""            # rola już to mówi
            people.append(p)
        # nazwiska wyprowadzone (oznaczone w danych, nie są odczytem)
        for p in people:
            rodzic_rola = RODZIC.get(p["rola"])
            if rodzic_rola and not p["nazw"]:
                rod = next((x for x in people if x["rola"] == rodzic_rola and x["nazw"]), None)
                if rod:
                    p["nazw"], p["der"] = rod["nazw"], True
                    if rod["pn"] != "pewny":
                        p["pn"] = rod["pn"]
            if p["rola"] == "matka" and not p["pan"]:
                dz = next((x for x in people if x["rola"] == "dziadek_matki" and x["nazw"]), None)
                if dz:
                    p["pan"], p["panDer"] = dz["nazw"], True
        out.append({"id": a["id"], "v": v, "date": a["data"], "rite": cfg["rite"], "kind": a["rodzaj"],
                    "src": cfg["src"], "nr": a["nr_aktu"], "page": a["strona"], "scan": a["link_skan"],
                    "note": note, "unverified": True, "people": people})
    return out

acts = []
for cfg in ZBIORY:
    acts += load(cfg)
js = "\n".join("ACTS.push(" + json.dumps(a, ensure_ascii=False) + ");" for a in acts)
src = HTML.read_text(encoding="utf-8")
new, n = re.subn(r"/\*REAL-DATA-START\*/.*?/\*REAL-DATA-END\*/",
                 lambda m: "/*REAL-DATA-START*/\n" + js + "\n/*REAL-DATA-END*/", src, flags=re.S)
if n != 1:
    sys.exit("Brak znaczników REAL-DATA w mockup/index.html")
HTML.write_text(new, encoding="utf-8")
print(f"Wczytano {len(acts)} aktów, {sum(len(a['people']) for a in acts)} osób.")
for w in warn:
    print("OSTRZEŻENIE:", w)
