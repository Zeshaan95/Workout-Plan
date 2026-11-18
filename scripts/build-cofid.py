"""Convert the UK CoFID 2021 spreadsheet into src/data/cofid.json for the food diary.

Source: McCance and Widdowson's Composition of Foods Integrated Dataset 2021
(Public Health England), Open Government Licence v3.0:
https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid

Usage: python3 scripts/build-cofid.py path/to/McCance_Widdowsons_..._2021..xlsx

Output rows: [code, name, group, kcal, protein, fat, carbs, fibre] per 100 g
(per 100 ml for drinks in group Q). "Tr" (trace) becomes 0; unknown values ("N") become 0
except energy, where the food is skipped. Fibre is AOAC fibre (as on UK labels), or NSP if AOAC is missing.
"""
import json
import sys

import openpyxl

COLS = {"code": 0, "name": 1, "group": 3, "protein": 9, "fat": 10, "carbs": 11, "kcal": 12, "nsp": 24, "aoac": 25}


def num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if s.lower() in ("tr", "trace"):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return None


def main(path, out="src/data/cofid.json"):
    ws = openpyxl.load_workbook(path, read_only=True)["1.3 Proximates"]
    rows = []
    for i, r in enumerate(ws.iter_rows(values_only=True)):
        if i < 3 or not r[COLS["code"]] or not r[COLS["name"]]:
            continue
        kcal = num(r[COLS["kcal"]])
        if kcal is None:
            continue
        fibre = num(r[COLS["aoac"]])
        if fibre is None:
            fibre = num(r[COLS["nsp"]]) or 0.0
        one = lambda k: round(num(r[COLS[k]]) or 0.0, 1)
        rows.append([
            str(r[COLS["code"]]).strip(),
            " ".join(str(r[COLS["name"]]).split()),
            str(r[COLS["group"]] or "").strip(),
            round(kcal),
            one("protein"),
            one("fat"),
            one("carbs"),
            round(fibre, 1),
        ])
    meta = {
        "source": "McCance and Widdowson's Composition of Foods Integrated Dataset 2021 (Public Health England)",
        "licence": "Contains public sector information licensed under the Open Government Licence v3.0",
        "fields": ["code", "name", "group", "kcal", "protein", "fat", "carbs", "fibre"],
    }
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "foods": rows}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(rows)} foods -> {out}")


if __name__ == "__main__":
    main(*sys.argv[1:])
