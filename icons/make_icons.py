# Galactic Arcade icons: nested neon hexagons on full-bleed black.
# Logo stays inside the maskable 80% safe zone; black fills the square edge to edge.
from PIL import Image, ImageDraw, ImageFilter
import math, os, sys

BG = (0, 0, 0)
RINGS = [(0.38, (255, 43, 214)), (0.285, (34, 216, 255)), (0.195, (255, 165, 58))]

def hex_pts(cx, cy, r):
    # pointy-top hexagon
    return [(cx + r * math.cos(math.pi / 3 * k + math.pi / 6),
             cy + r * math.sin(math.pi / 3 * k + math.pi / 6)) for k in range(7)]

def make(size, name):
    im = Image.new('RGB', (size, size), BG)
    glow = Image.new('RGB', (size, size), BG)
    dg, d = ImageDraw.Draw(glow), ImageDraw.Draw(im)
    c = size / 2
    # soft outer glow, then crisp strokes on top
    for r, col in RINGS:
        pts = hex_pts(c, c, r * size)
        dg.line(pts, fill=col, width=max(8, size // 16))
    blur = glow.filter(ImageFilter.GaussianBlur(max(2, size / 22)))
    im = Image.composite(blur, im, blur.convert('L').point(lambda v: min(255, int(v * 1.4))))
    d = ImageDraw.Draw(im)
    for r, col in RINGS:
        pts = hex_pts(c, c, r * size)
        d.line(pts, fill=col, width=max(3, size // 26))
    # guarantee corners stay pure black (blur must not leak a non-black fringe that reads as a border)
    # Safe: glow is near-black at edges by construction (r=0.38 + blur). Verify and clamp near-black to black.
    px = im.load()
    for y in range(size):
        for x in range(size):
            p = px[x, y]
            if p[0] < 8 and p[1] < 8 and p[2] < 8:
                px[x, y] = BG
    im.save(name, 'PNG')

def build(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    make(192, os.path.join(out_dir, 'icon-192.png'))
    make(512, os.path.join(out_dir, 'icon-512.png'))
    make(512, os.path.join(out_dir, 'icon-maskable-512.png'))
    make(180, os.path.join(out_dir, 'apple-touch-icon.png'))
    # verify
    safe = 0.40
    for fn, sz in [('icon-192.png', 192), ('icon-512.png', 512), ('icon-maskable-512.png', 512), ('apple-touch-icon.png', 180)]:
        im = Image.open(os.path.join(out_dir, fn)).convert('RGB')
        assert im.size == (sz, sz), (fn, im.size)
        w, h = im.size
        corners = [im.getpixel((0, 0)), im.getpixel((w-1, 0)), im.getpixel((0, h-1)), im.getpixel((w-1, h-1))]
        assert all(p == BG for p in corners), (fn, corners)
        # core strokes should live inside the 80% square; glow may spill a little
        core = 0
        outside = 0
        lo, hi = int(w * 0.10), int(w * 0.90)
        for y in range(h):
            for x in range(w):
                p = im.getpixel((x, y))
                if p == BG:
                    continue
                # bright ink (not just dim glow)
                if max(p) >= 80:
                    core += 1
                    if x < lo or x >= hi or y < lo or y >= hi:
                        outside += 1
        assert core > 50, (fn, 'no logo', core)
        assert outside == 0, (fn, 'bright ink outside 80% safe zone', outside, core)
        print(f'  OK {fn} {sz}x{sz} core={core}')

if __name__ == '__main__':
    build(os.path.dirname(os.path.abspath(__file__)))
