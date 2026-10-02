# The Sweeter app icon: a candy-pink bird whose wing carries a lollipop
# swirl, on a sky-blue macOS squircle (a superellipse, n = 5, 824 units
# across on a 1024 canvas). One light from the top left: a radial body
# gradient, occlusion along the bottom, a rim light, candy shine.
# Writes design/sweeter-icon.svg; scripts/icons.sh exports every PNG.
import math, sys

def f(v): return ('%.1f' % v).rstrip('0').rstrip('.')

def smooth(points, closed=True, t=0.5):
    """Catmull-Rom through the points, as cubic Beziers."""
    P = points
    n = len(P)
    d = 'M%s %s' % (f(P[0][0]), f(P[0][1]))
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = P[(i - 1) % n] if closed or i > 0 else P[0]
        p1 = P[i]; p2 = P[(i + 1) % n]
        p3 = P[(i + 2) % n] if closed or i + 2 < n else P[-1]
        c1 = (p1[0] + (p2[0] - p0[0]) * t / 3, p1[1] + (p2[1] - p0[1]) * t / 3)
        c2 = (p2[0] - (p3[0] - p1[0]) * t / 3, p2[1] - (p3[1] - p1[1]) * t / 3)
        d += ' C%s %s %s %s %s %s' % (f(c1[0]), f(c1[1]), f(c2[0]), f(c2[1]), f(p2[0]), f(p2[1]))
    return d + (' Z' if closed else '')

def squircle(cx=512, cy=512, r=412, n=5.0, steps=360):
    pts = []
    for i in range(steps):
        a = 2 * math.pi * i / steps
        c, s = math.cos(a), math.sin(a)
        x = cx + r * math.copysign(abs(c) ** (2 / n), c)
        y = cy + r * math.copysign(abs(s) ** (2 / n), s)
        pts.append('%s %s' % (f(x), f(y)))
    return 'M' + ' L'.join(pts) + ' Z'

def spiral(cx, cy, turns, r1, steps=420):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        a = t * turns * 2 * math.pi - math.pi / 2
        r = r1 * t
        pts.append('%s %s' % (f(cx + r * math.cos(a)), f(cy + r * math.sin(a))))
    return 'M' + ' L'.join(pts)

def leaf(base, tip, width, bend=0.0):
    """A tapered feather from base to tip."""
    bx, by = base; tx, ty = tip
    dx, dy = tx - bx, ty - by
    L = math.hypot(dx, dy); nx, ny = -dy / L, dx / L
    mx, my = bx + dx * .45 + nx * bend, by + dy * .45 + ny * bend
    a = (mx + nx * width, my + ny * width); b = (mx - nx * width, my - ny * width)
    return 'M%s %s Q%s %s %s %s Q%s %s %s %s Z' % (f(bx), f(by), f(a[0]), f(a[1]), f(tx), f(ty), f(b[0]), f(b[1]), f(bx), f(by))

def feather(base, tip, width, bend=0.0):
    """A feather with a rounded tip, as one smooth closed curve."""
    bx, by = base; tx, ty = tip
    dx, dy = tx - bx, ty - by
    L = math.hypot(dx, dy); ux, uy = dx / L, dy / L; nx, ny = -uy, ux
    def at(t, off):
        b = bend * math.sin(math.pi * t)
        return (bx + dx * t + nx * (off + b), by + dy * t + ny * (off + b))
    w = width
    pts = [at(0, w * .35), at(.35, w), at(.72, w * .8), at(.93, w * .38), (tx + ux * 4, ty + uy * 4),
           at(.93, -w * .38), at(.72, -w * .8), at(.35, -w), at(0, -w * .35)]
    return smooth(pts)

# ---- the bird (faces right), one continuous silhouette ----
BODY = smooth([
    (640, 232),   # crown
    (722, 256),
    (776, 318),   # forehead
    (796, 392),   # beak root
    (790, 456),
    (772, 520),   # chin
    (788, 600),   # chest
    (770, 684),
    (708, 750),   # belly
    (604, 790),
    (494, 796),
    (396, 766),   # under tail
    (326, 708),
    (292, 628),   # rump
    (300, 548),
    (346, 480),   # back
    (414, 438),   # shoulder
    (474, 414),   # neck: a slight dip under the head
    (520, 366),
    (542, 298),   # back of the head
    (584, 252),
])
BELLY = smooth([(718, 520), (760, 610), (730, 700), (660, 760), (566, 778), (540, 700), (588, 600), (650, 536)])
WING_C = (552, 590)
WING = smooth([(566, 486), (632, 530), (646, 604), (604, 672), (520, 710), (420, 718), (318, 704),
               (388, 666), (446, 610), (498, 536)])

def svg():
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs>
  <clipPath id="sq"><path d="{squircle()}"/></clipPath>
  <clipPath id="body"><path d="{BODY}"/></clipPath>
  <clipPath id="wing"><path d="{WING}"/></clipPath>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#C8EBFF"/><stop offset=".55" stop-color="#7EC0FA"/><stop offset="1" stop-color="#4C93EE"/>
  </linearGradient>
  <radialGradient id="skyglow" cx=".28" cy=".16" r=".75"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".7"/><stop offset=".5" stop-color="#FFFFFF" stop-opacity=".12"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
  <radialGradient id="flesh" cx=".36" cy=".26" r=".85">
    <stop offset="0" stop-color="#FFC4D8"/><stop offset=".35" stop-color="#FF8FB5"/><stop offset=".75" stop-color="#EE5A8E"/><stop offset="1" stop-color="#C93E73"/>
  </radialGradient>
  <radialGradient id="bellyg" cx=".62" cy=".38" r=".75"><stop offset="0" stop-color="#FFE1EB" stop-opacity=".75"/><stop offset=".6" stop-color="#FFC6D8" stop-opacity=".3"/><stop offset="1" stop-color="#FFB9CF" stop-opacity="0"/></radialGradient>
  <linearGradient id="feather" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF9DC0"/><stop offset="1" stop-color="#D84A80"/></linearGradient>
  <linearGradient id="beakTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD978"/><stop offset="1" stop-color="#FFAA2C"/></linearGradient>
  <linearGradient id="beakBot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F5962A"/><stop offset="1" stop-color="#D9731A"/></linearGradient>
  <radialGradient id="eye" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#4A2D52"/><stop offset="1" stop-color="#150A18"/></radialGradient>
  <radialGradient id="wingshade" cx=".62" cy=".3" r=".85"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".25"/><stop offset=".5" stop-color="#7A1238" stop-opacity="0"/><stop offset="1" stop-color="#7A1238" stop-opacity=".42"/></radialGradient>
  <radialGradient id="cheek" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FF3B7C" stop-opacity=".55"/><stop offset="1" stop-color="#FF3B7C" stop-opacity="0"/></radialGradient>
  <filter id="blur6" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="blur14" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="blur24" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="24"/></filter>
</defs>

<!-- ground -->
<path d="{squircle()}" fill="url(#sky)"/>
<path d="{squircle()}" fill="url(#skyglow)"/>
<g clip-path="url(#sq)">
  <ellipse cx="520" cy="830" rx="250" ry="40" fill="#1D4E9E" opacity=".32" filter="url(#blur24)"/>
</g>

<!-- tail feathers (behind the body) -->
<g fill="url(#feather)">
  <path d="{feather((356, 640), (196, 540), 44, -8)}" opacity=".9"/>
  <path d="{feather((362, 606), (210, 436), 48, -12)}"/>
  <path d="{feather((388, 574), (292, 368), 40, -12)}" opacity=".96"/>
</g>

<!-- crest -->
<g fill="url(#feather)">
  <path d="{feather((612, 262), (668, 196), 30, 26)}"/>
</g>

<!-- body -->
<path d="{BODY}" fill="url(#flesh)"/>
<g clip-path="url(#body)">
  <path d="{BELLY}" fill="url(#bellyg)" filter="url(#blur24)"/>
  <!-- ambient occlusion along the bottom, rim light along the back -->
  <path d="{BODY}" fill="none" stroke="#8C1C4E" stroke-opacity=".42" stroke-width="54" filter="url(#blur24)" transform="translate(-14 -30)"/>
  <path d="{BODY}" fill="none" stroke="#FFFFFF" stroke-opacity=".6" stroke-width="14" filter="url(#blur14)" transform="translate(12 16)"/>
  <!-- cast shadow of the wing on the body -->
  <path d="{WING}" fill="#8C1C4E" opacity=".38" filter="url(#blur14)" transform="translate(6 20)"/>
</g>

<!-- lollipop wing: a teardrop pointing back, printed with the swirl -->
<g clip-path="url(#wing)">
  <path d="{WING}" fill="#FFF6F9"/>
  <path d="{spiral(WING_C[0], WING_C[1], 3.6, 230)}" fill="none" stroke="#FF4C88" stroke-width="{230 / 3.6 / 2:.1f}" stroke-linecap="round"/>
  <path d="{WING}" fill="url(#wingshade)"/>
  <path d="{WING}" fill="none" stroke="#FFFFFF" stroke-opacity=".9" stroke-width="16" filter="url(#blur6)" transform="translate(8 10)"/>
</g>
<path d="{WING}" fill="none" stroke="#A8285C" stroke-opacity=".35" stroke-width="3"/>

<!-- candy shine on the head and back -->
<g clip-path="url(#body)" fill="#FFFFFF">
  <ellipse cx="610" cy="292" rx="58" ry="26" opacity=".55" transform="rotate(-28 610 292)" filter="url(#blur6)"/>
  <ellipse cx="420" cy="486" rx="44" ry="18" opacity=".4" transform="rotate(-34 420 486)" filter="url(#blur6)"/>
</g>

<!-- cheek, eye -->
<ellipse cx="726" cy="474" rx="46" ry="30" fill="url(#cheek)"/>
<circle cx="700" cy="386" r="35" fill="url(#eye)"/>
<ellipse cx="712" cy="372" rx="12.5" ry="11.5" fill="#FFFFFF"/>
<circle cx="688" cy="401" r="4.5" fill="#FFFFFF" opacity=".8"/>

<!-- beak: upper and lower -->
<path d="M780 392 C814 394 856 410 886 428 C856 434 816 438 784 442 Z" fill="url(#beakTop)"/>
<path d="M784 442 C814 442 844 440 866 436 C846 454 814 466 788 468 Z" fill="url(#beakBot)"/>
<path d="M794 401 C820 403 846 412 866 423" fill="none" stroke="#FFFFFF" stroke-opacity=".6" stroke-width="5" stroke-linecap="round"/>

<!-- the squircle's own edge light -->
<g clip-path="url(#sq)">
  <path d="{squircle()}" fill="none" stroke="#FFFFFF" stroke-opacity=".35" stroke-width="4"/>
</g>
</svg>'''

import os
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sweeter-icon.svg')
open(out, 'w').write(svg())
