#!/usr/bin/env python3
"""Обновляет data/*.csv из Google-таблицы."""
import urllib.request
from pathlib import Path

SHEET = "1dqYgo6PI2ttiQgbF8QhLzOI19VSFSEdthK_xDX5Mk04"
TABS = {"60x60": "0", "60x120": "725867454"}

DATA = Path(__file__).parent / "data"
DATA.mkdir(exist_ok=True)

for name, gid in TABS.items():
    url = f"https://docs.google.com/spreadsheets/d/{SHEET}/export?format=csv&gid={gid}"
    text = urllib.request.urlopen(url, timeout=30).read().decode("utf-8")
    head, _, rest = text.partition("\n")
    assert "НАЗВАНИЯ" in head, f"{name}: таблица недоступна"
    head = "Артикулы" + head[head.index(","):]   # первую колонку в таблице переименовывают
    (DATA / f"{name}.csv").write_text(head + "\n" + rest, encoding="utf-8")
    print(f"{name}: {len(rest.splitlines())} строк")
