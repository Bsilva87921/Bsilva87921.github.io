#!/usr/bin/env python3
"""Subset the Inter faces to the characters the app uses and write src/fonts.css
with the faces inlined as data: URIs, so every viewer sees the same type."""
import base64, io
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
FONT_DIR = Path("/usr/share/fonts/opentype/inter")
FACES = [
    ("PA Display", 700, "InterDisplay-Bold.otf"),
    ("PA Display", 800, "InterDisplay-ExtraBold.otf"),
    ("PA Text", 400, "Inter-Regular.otf"),
    ("PA Text", 700, "Inter-Bold.otf"),
]

def used_text():
    chars = set()
    for f in SRC.iterdir():
        if f.suffix in (".js", ".html", ".css") and f.name != "fonts.css":
            chars.update(f.read_text(encoding="utf-8"))
    chars.update(chr(c) for c in range(0x20, 0x7F))   # all of basic Latin
    chars.update(chr(c) for c in range(0xA0, 0x100))  # Latin-1 for names
    return "".join(sorted(c for c in chars if ord(c) >= 0x20))

def subset_face(path, text):
    opts = subset.Options()
    opts.flavor = "woff"
    opts.layout_features = ["kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk", "tnum", "case", "frac", "numr", "dnom", "sups"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.hinting = False
    font = TTFont(str(path))
    s = subset.Subsetter(options=opts)
    s.populate(text=text)
    s.subset(font)
    buf = io.BytesIO()
    font.flavor = "woff"
    font.save(buf)
    return buf.getvalue()

def main():
    text = used_text()
    rules = ["/* Inter by Rasmus Andersson, SIL Open Font License 1.1. Subset and inlined by tools/make_fonts.py */"]
    total = 0
    for family, weight, fname in FACES:
        data = subset_face(FONT_DIR / fname, text)
        total += len(data)
        b64 = base64.b64encode(data).decode("ascii")
        rules.append(f'@font-face{{font-family:"{family}";font-style:normal;font-weight:{weight};font-display:block;src:url(data:font/woff;base64,{b64}) format("woff")}}')
        print(f"{family} {weight}: {len(data)/1024:.1f} KB")
    (SRC / "fonts.css").write_text("\n".join(rules) + "\n", encoding="utf-8")
    print(f"total {total/1024:.1f} KB woff, {len(text)} characters")

if __name__ == "__main__":
    main()
