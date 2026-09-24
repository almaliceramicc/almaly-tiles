#!/usr/bin/env python3
"""Собирает сайт-каталог плитки и QR-коды.

Как добавить фото: положить файлы в photos/<АРТИКУЛ>/ и запустить `python3 build.py`.
Порядок фото — по имени файла (01, 02, ...). Первое фото становится обложкой.
"""
import csv, hashlib, json, shutil, textwrap, unicodedata
from pathlib import Path

import qrcode
from qrcode.constants import ERROR_CORRECT_H
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).parent
SITE, QR = ROOT / "docs", ROOT / "qr"
PHOTOS = ROOT / "photos"
CFG = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
BASE = CFG["base_url"].rstrip("/")

FULL_W, THUMB_W = 1600, 700
EXT = {".jpg", ".jpeg", ".png", ".webp"}
FONT = next(f for f in ("/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
                        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
            if Path(f).exists())

SURFACE = {"ГЛ": "Глянец", "MT": "Матовая", "МТ": "Матовая", "САТИН": "Сатин",
           "КАРВИНГ": "Карвинг", "ПАНЧ КАРВИНГ": "Панч-карвинг"}


def norm(s):
    return " ".join(unicodedata.normalize("NFC", s).upper().replace("Ё", "Е").split())


def num(v):
    """«174,96» / «1 328,4» / пусто -> float."""
    try:
        return float(v.replace("\xa0", "").replace(" ", "").replace(",", "."))
    except (ValueError, AttributeError):
        return 0.0


# Кириллические буквы-двойники в артикулах: «VHF600085С» и «VHF600085C» — одна плитка.
CYR = str.maketrans("АВЕКМНОРСТУХ", "ABEKMHOPCTYX")


def wanted_arts(path):
    """Список артикулов для каталога из arts.txt (по одному в строке, # — комментарий)."""
    lines = path.read_text(encoding="utf-8").splitlines()
    return {a.strip().upper().translate(CYR) for a in lines if a.strip() and not a.startswith("#")}


def catalog():
    """Только артикулы из arts.txt; данные и остатки — из таблицы."""
    want = wanted_arts(ROOT / "arts.txt")
    tiles = []
    for f in sorted((ROOT / "data").glob("*.csv")):
        for row in csv.DictReader(f.open(encoding="utf-8")):
            art, name = row["Артикулы"].strip(), norm(row["НАЗВАНИЯ"])
            status = row["Статус арт."].strip().lower()
            if not name or art.upper().translate(CYR) not in want:
                continue
            fmt = norm(row["ФОРМАТ"]).replace("Х", "X").replace("X", "×")
            stock = {k: num(row[c]) for k, c in (
                ("msk", "СКЛАД Москва"), ("tver", "СКЛАД Тверь"),
                ("msk_res", "РЕЗЕРВ Москва"), ("tver_res", "РЕЗЕРВ Тверь"))}
            tiles.append({
                "art": art,
                "name": name.title(),
                "format": fmt,
                "surface": SURFACE.get(norm(row["ПОКРЫТИЕ"]), row["ПОКРЫТИЕ"].strip().title()),
                "packing": row["ПАКИНГ"].strip(),
                "pallet": row["ПАЛЛЕТ М2/КГ"].strip(),
                "stock": stock,
                "url": f"{BASE}/tile.html?a={art}",
                "is_new": status == "new",
            })
    tiles.sort(key=lambda t: (t["format"], t["name"]))
    lost = want - {t["art"].upper().translate(CYR) for t in tiles}
    if lost:
        print("Нет в таблице (карточки не будет):", ", ".join(sorted(lost)))
    return tiles


def make_images(tile):
    """Ресайз фото артикула в docs/img/<арт>/. В имени файла — хеш исходника,
    поэтому после замены или перестановки фото меняется адрес и кэш не показывает старое."""
    src_dir = PHOTOS / tile["art"]
    src_dir.mkdir(parents=True, exist_ok=True)          # чтобы было куда класть фото
    out_dir = SITE / "img" / tile["art"]
    names, keep = [], set()
    for i, src in enumerate(sorted(p for p in src_dir.iterdir() if p.suffix.lower() in EXT), 1):
        out_dir.mkdir(parents=True, exist_ok=True)
        base = f"{i:02d}.{hashlib.sha1(src.read_bytes()).hexdigest()[:8]}"
        full, thumb = out_dir / f"{base}.jpg", out_dir / f"{base}_t.jpg"
        keep |= {full.name, thumb.name}
        if not full.exists() or not thumb.exists():
            im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
            big = im.copy(); big.thumbnail((FULL_W, FULL_W), Image.LANCZOS)
            big.save(full, "JPEG", quality=82, optimize=True, progressive=True)
            small = im.copy(); small.thumbnail((THUMB_W, THUMB_W), Image.LANCZOS)
            small.save(thumb, "JPEG", quality=78, optimize=True, progressive=True)
        names.append(base)
    for stale in (p for p in out_dir.iterdir() if p.name not in keep) if out_dir.is_dir() else ():
        stale.unlink()                                   # картинки удалённых фото
    return names


def make_qr(tile):
    """QR с названием модели в центре — артикул на код не выносим."""
    qr = qrcode.QRCode(version=None, error_correction=ERROR_CORRECT_H, box_size=16, border=2)
    qr.add_data(tile["url"]); qr.make(fit=True)
    img = qr.make_image(fill_color="#111111", back_color="white").convert("RGB")
    w, h = img.size

    box_w, box_h = int(w * 0.34), int(h * 0.20)
    x0, y0 = (w - box_w) // 2, (h - box_h) // 2
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([x0, y0, x0 + box_w, y0 + box_h], radius=box_h // 6,
                        fill="white", outline="#111111", width=max(2, w // 300))

    lines = (textwrap.wrap(tile["name"].upper(), width=14) or [""])[:3]
    size = int(box_h / (len(lines) + 0.8))
    while True:
        font = ImageFont.truetype(FONT, size)
        if max(d.textlength(t, font=font) for t in lines) <= box_w * 0.86 or size <= 8:
            break
        size -= 2
    fonts = [font] * len(lines)
    gap = int(size * 0.28)
    total = sum(f.size for f in fonts) + gap * (len(lines) - 1)
    y = y0 + (box_h - total) // 2
    for text, f in zip(lines, fonts):
        d.text((w // 2, y), text, font=f, fill="#111111", anchor="ma")
        y += f.size + gap

    QR.mkdir(exist_ok=True)
    img.resize((1000, 1000), Image.LANCZOS).save(QR / f"{tile['art']}.png", "PNG")


def main():
    tiles = catalog()
    # Таблицу правят вручную: переименованная колонка артикулов однажды уже оставила
    # сайт с пустым каталогом. Лучше уронить прогон, чем стереть живой сайт.
    was = len(json.loads((SITE / "data.json").read_text(encoding="utf-8"))["tiles"]) if (SITE / "data.json").exists() else 0
    if len(tiles) < max(1, was // 2):
        raise SystemExit(f"Отказ: из таблицы собралось {len(tiles)} карточек вместо {was}. "
                         "data.json не тронут — проверьте колонку «Артикулы» и arts.txt.")
    for t in tiles:
        t["photos"] = make_images(t)
        make_qr(t)
    tiles.sort(key=lambda t: (not t["photos"], t["format"], t["name"]))   # с фото — первыми
    (SITE / "data.json").write_text(
        json.dumps({"base": BASE, "tiles": tiles}, ensure_ascii=False, indent=1), encoding="utf-8")
    shutil.copytree(QR, SITE / "qr", dirs_exist_ok=True)   # QR доступны и с сайта

    with_photo = sum(1 for t in tiles if t["photos"])
    print(f"Плиток: {len(tiles)} | с фото: {with_photo} | без фото: {len(tiles) - with_photo} "
          f"| в наличии (Москва): {sum(1 for t in tiles if t['stock']['msk'] > 0)}")
    empty = [t["art"] for t in tiles if not t["photos"]]
    if empty:
        print("Ждут фото (папки созданы в photos/):", ", ".join(empty))


if __name__ == "__main__":
    main()
