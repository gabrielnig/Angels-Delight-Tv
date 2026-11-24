#!/usr/bin/env python3
"""Writes apps/web/src/fonts/coverage.json: for each shipped WOFF2 file, its sha256 and which of the
code points the language sets need it contains. The font test verifies the hashes, so the manifest
cannot go stale. Needs fontTools (pip install fonttools brotli). Run: python3 scripts/font-coverage.py"""
import hashlib, json, pathlib, unicodedata
from fontTools.ttLib import TTFont

root = pathlib.Path(__file__).resolve().parent.parent
fonts = root / "apps/web/src/fonts"
SETS = {
    "yoruba": "ọ ẹ ṣ ọ̀ ẹ̀ ń ǹ ḿ à á è é ì í ò ó ù ú Ọ Ẹ Ṣ",
    "igbo": "ị ụ ṅ ị̄ ụ̄ Ị Ụ Ṅ",
    "hausa": "ɓ ɗ ƙ ƴ ʼ Ɓ Ɗ Ƙ Ƴ",
    "naira": "₦",
}
wanted = set()
for chars in SETS.values():
    for word in chars.split():
        wanted.update(ord(c) for c in word)
        wanted.update(ord(c) for c in unicodedata.normalize("NFD", word))
out = {"sets": SETS, "files": {}}
for path in sorted(fonts.glob("*.woff2")):
    cmap = TTFont(str(path)).getBestCmap()
    out["files"][path.name] = {
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "codepoints": sorted(cp for cp in wanted if cp in cmap),
    }
(fonts / "coverage.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print("wrote", len(out["files"]), "files")
