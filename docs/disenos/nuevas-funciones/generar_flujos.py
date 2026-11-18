"""Genera láminas conceptuales PNG, galería HTML y dossier PDF de NexoDocs.

Requiere Python 3 y Pillow. No usa red, proveedores IA, datos de aplicación ni API.
Ejecutar: python docs/disenos/nuevas-funciones/generar_flujos.py
"""
from pathlib import Path
import html
import json
import os

from PIL import Image, ImageDraw, ImageFont, JpegImagePlugin  # registra JPEG para el PDF

ROOT = Path(__file__).resolve().parent
W, H = 1920, 1200
C = dict(bg="#f1f7f7", white="#ffffff", ink="#133743", muted="#526c78",
         teal="#087f80", dark="#092e2c", pale="#e3f5f2", line="#d4e3e7",
         blue="#eaf2ff", blueink="#235aa0", amber="#fff3db", amberink="#815600")
BOUNDS = []


def font(size, bold=False):
    paths = [Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts" /
             ("segoeuib.ttf" if bold else "segoeui.ttf"),
             Path("/usr/share/fonts/truetype/dejavu") /
             ("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf")]
    for p in paths:
        if p.exists():
            return ImageFont.truetype(str(p), size)
    raise RuntimeError("Instalar Segoe UI o DejaVu Sans para generar las láminas.")


def text(d, value, x, y, width, size=24, fill=None, bold=False, max_lines=None):
    f = font(size, bold)
    lines = []
    for paragraph in str(value).split("\n"):
        line = ""
        for word in paragraph.split():
            trial = (line + " " + word).strip()
            if d.textlength(trial, font=f) > width and line:
                lines.append(line)
                line = word
            else:
                line = trial
        lines.append(line)
    if max_lines is not None and len(lines) > max_lines:
        raise ValueError(f"Texto desborda {max_lines} líneas: {value}")
    for line in lines:
        d.text((x, y), line, font=f, fill=fill or C["ink"])
        y += size + 9
    BOUNDS.append(y)
    return y


def box(d, xy, fill=None, outline=None, radius=18):
    d.rounded_rectangle(xy, radius=radius, fill=fill or C["white"],
                        outline=outline or C["line"], width=2)


def badge(d, label, x, y, color=None):
    size = 18
    width = int(d.textlength(label, font=font(size, True))) + 28
    box(d, (x, y, x + width, y + 35), color or C["pale"], color or C["pale"], 12)
    text(d, label, x + 14, y + 4, width, size, C["teal"], True)


def base(module, page):
    im = Image.new("RGB", (W, H), C["bg"])
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 170), fill=C["white"])
    d.rectangle((0, 0, 16, 170), fill=C["teal"])
    text(d, "NexoDocs", 45, 24, 400, 32, bold=True)
    text(d, f"PROPUESTA {module['number']}  /  {module['title']}", 45, 77, 1400, 32, bold=True)
    badge(d, "DISEÑO PROPUESTO · NO IMPLEMENTADO", 1335, 32, C["amber"])
    text(d, f"LÁMINA {page}/5 · Datos ficticios · Referencia local c0c49ab · 17 nov 2026",
         45, 128, 1650, 20, C["muted"])
    d.line((35, 1144, 1885, 1144), fill=C["line"], width=2)
    text(d, "Las pantallas explican el flujo futuro. No son capturas reales ni resultados de pruebas.",
         45, 1160, 1800, 20, C["muted"])
    return im, d


def info(d, title, body, x, y, width, height, fill=None, size=24):
    box(d, (x, y, x + width, y + height), fill)
    bottom = text(d, title, x + 24, y + 18, width - 48, 23, bold=True)
    bottom = text(d, body, x + 24, bottom + 10, width - 48, size)
    if bottom > y + height - 8:
        raise ValueError(f"Panel desbordado: {title}")


def overview(module):
    im, d = base(module, 1)
    text(d, "El recorrido completo", 55, 198, 1200, 38, bold=True)
    text(d, module["story"], 55, 253, 1200, 24, C["muted"], max_lines=2)
    y = 340
    for i, (number, title, body) in enumerate(module["flow"]):
        box(d, (55, y, 1235, y + 112))
        d.ellipse((77, y + 25, 137, y + 85), fill=C["teal"])
        text(d, number, 91, y + 36, 50, 25, C["white"], True)
        text(d, title, 165, y + 14, 1010, 27, bold=True)
        text(d, body, 165, y + 58, 1010, 24, max_lines=1)
        if i < 5:
            d.line((106, y + 113, 106, y + 127), fill=C["teal"], width=4)
            d.polygon([(98, y + 122), (114, y + 122), (106, y + 130)], fill=C["teal"])
        y += 130
    info(d, "Quién participa", "\n".join("• " + a for a in module["actors"]),
         1280, 340, 580, 240, C["pale"])
    info(d, "Regla que no se puede romper", module["invariant"],
         1280, 605, 580, 205, C["blue"])
    info(d, "Si algo falla", module["failure"],
         1280, 835, 580, 275, C["amber"])
    return im


def screen(module, data, page):
    im, d = base(module, page)
    box(d, (25, 198, 246, 1122), C["dark"], C["dark"])
    text(d, "NexoDocs", 45, 221, 170, 27, C["white"], True)
    text(d, "Organización\nde ejemplo", 45, 285, 170, 22, "#bce6df", True)
    menu = ["Inicio", "Documentos", "Expedientes", "Digitalización", "Workflows", "Auditoría"]
    if data.get("external"):
        menu = ["Portal externo", "Verificación", "Documento"]
    y = 407
    for label in menu:
        active = (label == module["nav"].split(" /")[0] or
                  data.get("external") and label == "Verificación")
        if active:
            box(d, (36, y - 4, 235, y + 44), C["teal"], C["teal"], 10)
        text(d, label, 47, y + 3, 180, 22, C["white"])
        y += 66
    text(d, data["role"], 45, 1018, 170, 21, "#bce6df", max_lines=3)
    text(d, data["steps"] + " · " + module["nav"], 280, 202, 1100, 20, C["teal"], True)
    text(d, data["title"], 280, 243, 1545, 38, bold=True, max_lines=1)
    text(d, data["lead"], 280, 300, 1010, 23, C["muted"], max_lines=2)
    badge(d, data["state"], 1335, 300)
    for i, (label, value) in enumerate(data["fields"]):
        x = 280 + (i % 2) * 515
        y = 390 + (i // 2) * 111
        box(d, (x, y, x + 495, y + 97))
        text(d, label, x + 18, y + 10, 460, 19, C["muted"], True)
        text(d, value, x + 18, y + 38, 460, 22, max_lines=2)
    box(d, (280, 738, 1290, 1010))
    text(d, data["section"], 302, 755, 960, 26, bold=True)
    y = 805
    for row in data["rows"]:
        d.ellipse((305, y + 10, 315, y + 20), fill=C["teal"])
        y = text(d, row, 332, y, 930, 22, max_lines=2) + 13
    if y > 1005:
        raise ValueError(f"Lista demasiado alta en {data['title']}")
    box(d, (280, 1030, 1290, 1100), C["teal"], C["teal"])
    text(d, data["action"], 305, 1046, 950, 25, C["white"], True, max_lines=1)
    info(d, "Qué hace el sistema", "\n".join("• " + s for s in data["system"]),
         1330, 390, 550, 280, C["blue"], size=22)
    info(d, "Resultado esperado", data["result"], 1330, 690, 550, 185, C["pale"], size=23)
    info(d, "Error / alternativa", data["error"], 1330, 895, 550, 215, C["amber"], size=22)
    return im


def gallery(modules, assets):
    nav = "".join(f'<a href="#{m["id"]}">{html.escape(m["number"] + ". " + m["title"])}</a>' for m in modules)
    sections = []
    for m in modules:
        figures = []
        for item in assets[m["id"]]:
            p, title = item
            figures.append(f'<figure><figcaption>{html.escape(title)}</figcaption>'
                           f'<button class="open" data-src="{p}" data-title="{html.escape(title, quote=True)}" '
                           f'aria-label="Ampliar: {html.escape(title, quote=True)}">'
                           f'<img src="{p}" alt="{html.escape(title, quote=True)}" loading="lazy"></button>'
                           f'<a href="{p}" target="_blank" rel="noopener">Abrir PNG completo</a></figure>')
        sections.append(f'<section id="{m["id"]}"><h2>{html.escape(m["number"] + ". " + m["title"])}</h2>'
                        f'<p>{html.escape(m["story"])}</p>' + "".join(figures) + '</section>')
    content = '''<!doctype html><html lang="es"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>NexoDocs · Cuatro flujos propuestos</title>
<style>
*{box-sizing:border-box}body{margin:0;font:17px/1.6 system-ui,sans-serif;color:#133743;background:#f1f7f7}
header,main{max-width:1320px;margin:auto;padding:30px}header{background:white;border-bottom:5px solid #087f80}
h1{line-height:1.2}nav{display:flex;gap:12px;flex-wrap:wrap}a{color:#087173}nav a,.pdf{background:#e3f5f2;padding:10px 14px;border-radius:10px}
.notice{background:#fff3db;padding:14px;border-radius:12px}section{padding-top:24px;scroll-margin-top:10px}
figure{background:white;margin:24px 0;padding:18px;border:1px solid #d4e3e7;border-radius:16px}
figcaption{font-weight:700;font-size:22px;margin-bottom:12px}.open{display:block;width:100%;border:0;background:none;padding:0;cursor:zoom-in}
img{display:block;width:100%;height:auto;border-radius:8px}figure>a{display:inline-block;margin-top:10px}
dialog{width:98vw;max-width:none;height:97vh;padding:12px;border:0;border-radius:12px;background:#f1f7f7}
dialog::backdrop{background:#001b24dd}.toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
.toolbar button{padding:10px 18px;border:1px solid #087f80;background:white;border-radius:8px;cursor:pointer}
.scroll{overflow:auto;height:calc(100% - 65px)}dialog img{width:auto;max-width:none;height:auto}dialog img.fit{width:100%;max-width:1920px}
@media print{nav,dialog,.open+ a{display:none}figure{break-inside:avoid}header,main{padding:0}section{break-before:page}}
</style>
<header><p>NEXODOCS · PROPUESTA FUNCIONAL</p><h1>Cuatro módulos, veinte láminas paso a paso</h1>
<p class="notice">Diseños conceptuales no implementados. Todos los datos son ficticios. No son capturas reales de la aplicación.</p>
<p>Referencia: c0c49ab más cambios locales · 17 noviembre 2026. Selecciona una imagen para ampliarla.</p>
<p><a class="pdf" href="flujos-nexodocs.pdf">Descargar dossier PDF · 20 páginas</a> ·
<a href="../../wiki/07-propuestas/README.md">Documentación funcional y técnica</a></p><nav>''' + nav + '</nav></header><main>' + "".join(sections) + '''</main>
<dialog id="viewer"><div class="toolbar"><button id="previous">← Anterior</button><button id="next">Siguiente →</button><button id="zoom">Tamaño real / ajustar</button><button id="close">Cerrar</button><strong id="title"></strong></div><div class="scroll"><img id="full" class="fit" alt=""></div></dialog>
<script>
const items=[...document.querySelectorAll('.open')],viewer=document.getElementById('viewer'),full=document.getElementById('full');let current=0;
function show(i){current=(i+items.length)%items.length;full.src=items[current].dataset.src;full.alt=items[current].dataset.title;document.getElementById('title').textContent=(current+1)+'/20 · '+full.alt;document.querySelector('.scroll').scrollTo(0,0)}
items.forEach((b,i)=>b.onclick=()=>{show(i);viewer.showModal()});document.getElementById('close').onclick=()=>viewer.close();document.getElementById('next').onclick=()=>show(current+1);document.getElementById('previous').onclick=()=>show(current-1);document.getElementById('zoom').onclick=()=>full.classList.toggle('fit');
viewer.addEventListener('keydown',e=>{if(e.key==='ArrowRight')show(current+1);if(e.key==='ArrowLeft')show(current-1)});
</script></html>'''
    (ROOT / "galeria.html").write_text(content, encoding="utf-8")


def main():
    modules = json.loads((ROOT / "flujos.json").read_text(encoding="utf-8"))
    pages, assets = [], {}
    for m in modules:
        folder = ROOT / m["id"]
        folder.mkdir(exist_ok=True)
        assets[m["id"]] = []
        entries = [("01-flujo", "Flujo completo", overview(m))]
        entries += [(s["file"], s["steps"] + " · " + s["title"], screen(m, s, i + 2))
                    for i, s in enumerate(m["screens"])]
        for name, title, im in entries:
            target = folder / (name + ".png")
            im.save(target, optimize=True)
            assets[m["id"]].append((m["id"] + "/" + target.name, title))
            pages.append(im)
    pages[0].save(ROOT / "flujos-nexodocs.pdf", save_all=True, append_images=pages[1:],
                  resolution=150, quality=95, title="NexoDocs - Cuatro propuestas documentales",
                  author="NexoDocs - Diseno conceptual", subject="Propuesta no implementada; datos ficticios")
    gallery(modules, assets)
    if max(BOUNDS) > H:
        raise ValueError("Hay texto fuera del lienzo")
    print(f"Generadas {len(pages)} imágenes de {W}x{H}, galería HTML y PDF de {len(pages)} páginas.")


if __name__ == "__main__":
    main()
