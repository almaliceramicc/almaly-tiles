#!/bin/bash
# Вернуть дизайн витрины, который был до редизайна 25.10.2026 (git-метка design-old-2026-10-25).
# Трогает только оформление: страницы, стили и скрипт. Фото, data.json, QR-коды и arts.txt не меняются.
set -e
cd "$(dirname "$0")"
git pull --rebase
git checkout design-old-2026-10-25 -- docs/index.html docs/tile.html docs/admin.html docs/app.js docs/style.css
git rm -q --cached docs/style-admin.css 2>/dev/null && rm -f docs/style-admin.css || true
git commit -m "Возврат старого дизайна витрины (метка design-old-2026-10-25)"
git push
echo "Старый дизайн вернётся на сайт через 1–2 минуты."
