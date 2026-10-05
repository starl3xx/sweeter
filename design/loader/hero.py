#!/usr/bin/env python3
"""The hero: the loading screen's bird flaps on nothing, folds its wing on
the third (smaller) flap, and the icon's squircle opens behind it, so the
last frame is the app icon itself (design/icon-1024.png). For the top of
starl3xx.fun/sweeter and the About window. Plays once and holds.

  scripts/bird.sh hero    build/bird/hero: WebM and HEVC with alpha, an
                          animated WebP, start and end stills, at 224, 296
                          and 444 px, and a 1024 px ProRes 4444 master

The bird stays exactly where the icon has it (the same zoom and offset as
design/sweeter-icon.swift). Its flap is the loader's eight key poses eased
through at 30 fps rather than stepped.
"""
import os
import shutil
import subprocess
import sys
import tempfile

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bird  # noqa: E402

ICON = os.path.join(bird.ROOT, 'design', 'icon-1024.png')
OUT = os.path.join(bird.ROOT, 'build', 'bird', 'hero')

FPS = 30
POSE_S = bird.MS / 1000
# design/sweeter-icon.swift draws the 1254 px art into the 824 px squircle
# zoomed 1.12, centered on the 1024 canvas: art px -> icon px.
ZOOM = 824 * 1.12 / 1254
OFF = 100 - 824 * 0.06
CYCLES = (1.0, 1.0, 0.72)          # the third flap is smaller: it settles
BLOOM_AT = 2 * 1.04 + 4 * POSE_S    # 2.6 s: as the last downstroke begins
BLOOM = 0.62                        # the squircle opening, in seconds
HOLD = 0.45                         # on the icon at the end
CELL_TO_ICON = ZOOM / bird.S256     # the rig's bob is in 256 px cell px
SIZES = (224, 296, 444)             # the About window's 112 pt at 2x; the page's 148 pt at 2x and 3x


def keys():
    th, bob = [], []
    for amp in CYCLES:
        th += [v * amp for v in bird.POSE['theta']]
        bob += [v * amp for v in bird.POSE['bob']]
    return np.array(th + [0.0] * 4), np.array(bob + [0.0] * 4)


def catmull(vals, p):
    """Catmull-Rom through evenly spaced keys at position p: value and slope."""
    n = len(vals)
    i = int(np.floor(p))
    t = p - i
    g = lambda k: vals[min(max(k, 0), n - 1)]
    p0, p1, p2, p3 = g(i - 1), g(i), g(i + 1), g(i + 2)
    a, b, c = -p0 + p2, 2 * p0 - 5 * p1 + 4 * p2 - p3, -p0 + 3 * p1 - 3 * p2 + p3
    return 0.5 * (2 * p1 + a * t + b * t * t + c * t ** 3), 0.5 * (a + 2 * b * t + 3 * c * t * t)


def squircle(size, r, n=5.0):
    """The icon's superellipse (n = 5) of radius r on the canvas center, with a 1 px soft edge."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) + 0.5
    x, y = np.abs(xx - size / 2) / r, np.abs(yy - size / 2) / r
    f = (x ** n + y ** n) ** (1 / n)
    gx = np.maximum(x, 1e-6) ** (n - 1) * f ** (1 - n) / r
    gy = np.maximum(y, 1e-6) ** (n - 1) * f ** (1 - n) / r
    return np.clip(0.5 - (f - 1) / np.maximum(np.hypot(gx, gy), 1e-6), 0, 1)


def ease_out_back(x, c):
    x = np.clip(x, 0, 1)
    return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2


def frames(folder):
    """The 1024 px frames, as PNGs f001.png...; returns how many."""
    rig = bird.Rig()
    P, L = rig.P, rig.L
    # The sky with the bird lifted out, for inside the squircle while it opens.
    master = bird.matte()
    art = np.asarray(Image.open(bird.ART).convert('RGB')).astype(np.float32) / 255
    clear = master[..., 3] < 0.02
    sky = art.copy()
    for s in (120, 60, 30, 12):
        est = bird.fill(art, clear, s)
        ok = cv2.GaussianBlur(clear.astype(np.float32), (0, 0), s) > 0.02
        sky[~clear & ok] = est[~clear & ok]
    sky[clear] = art[clear]
    SS, C = 2, 2048
    M = np.float32([[ZOOM * SS, 0, OFF * SS], [0, ZOOM * SS, OFF * SS]])
    sky = cv2.resize(cv2.warpAffine(sky, M, (C, C), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE),
                     (1024, 1024), interpolation=cv2.INTER_AREA)
    icon = np.asarray(Image.open(ICON).convert('RGBA')).astype(np.float32) / 255
    end = np.dstack([icon[..., :3] * icon[..., 3:4], icon[..., 3:4]])

    th_k, bob_k = keys()
    n = int(round((BLOOM_AT + BLOOM + HOLD) * FPS))
    for fi in range(n):
        t = fi / FPS
        th, dth = catmull(th_k, t / POSE_S)
        bob, _ = catmull(bob_k, t / POSE_S)
        u = np.clip(th / P['tmax'], 0, 1)
        u = u * u * (3 - 2 * u)
        wp, wa = rig.lift(rig.wing(u), th, -P['lag'] * dth, (P['lift'][0] * u, P['lift'][1] * u))
        # As Rig.frame: the raised wing's shadow on the body, and the folded
        # wing's crease fading as it lifts.
        k = P['shadow'] * np.clip(abs(th) / 40, 0, 1)
        sh = np.roll(np.roll(cv2.GaussianBlur(wa, (0, 0), 14), 14, 0), 6, 1)
        w = np.clip(abs(th) / 25, 0, 1)
        plate = L['body_rest'] * (1 - w) + L['body'] * w
        bp = plate * (1 - k * sh)[..., None] * L['body_a'][..., None]
        pm = np.dstack([wp + bp * (1 - wa[..., None]), wa + L['body_a'] * (1 - wa)]).astype(np.float32)
        Mb = M.copy()
        Mb[1, 2] -= bob * CELL_TO_ICON * SS
        out = cv2.resize(cv2.warpAffine(pm, Mb, (C, C), flags=cv2.INTER_LINEAR, borderValue=0),
                         (1024, 1024), interpolation=cv2.INTER_AREA)
        # The squircle opens from just larger than the bird, a little past its
        # size and back, fading in; the sky inside it stays put.
        x = (t - BLOOM_AT) / BLOOM
        if x > 0:
            a = squircle(1024, 412 * (0.78 + 0.22 * ease_out_back(x, 1.6))) * (1 - (1 - np.clip(x / 0.55, 0, 1)) ** 3)
            out = out + np.dstack([sky * a[..., None], a]) * (1 - out[..., 3:4])
        # The last few frames ease into the icon file, so the end is exact.
        e = np.clip((t - (BLOOM_AT + BLOOM * 0.8)) / (BLOOM * 0.2), 0, 1)
        out = out * (1 - e) + end * e
        a = out[..., 3:4]
        rgba = np.concatenate([np.where(a > 1e-4, out[..., :3] / np.maximum(a, 1e-4), 0), a], -1)
        bird.save_png(rgba, os.path.join(folder, f'f{fi + 1:03d}.png'))
    return n


def main():
    for tool in ('ffmpeg', 'img2webp'):
        if not shutil.which(tool):
            sys.exit(f'{tool} is missing (brew install ffmpeg webp)')
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    tmp = tempfile.mkdtemp(prefix='hero-')
    try:
        big = os.path.join(tmp, '1024')
        os.makedirs(big)
        n = frames(big)
        names = [f'f{i + 1:03d}.png' for i in range(n)]
        bird.run(['ffmpeg', '-y', '-framerate', str(FPS), '-i', os.path.join(big, 'f%03d.png'), '-c:v', 'prores_ks',
                  '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-vendor', 'apl0', os.path.join(OUT, 'sweeter-hero-1024-prores.mov')])
        for size in SIZES:
            d = os.path.join(tmp, str(size))
            os.makedirs(d)
            for nm in names:
                f = np.asarray(Image.open(os.path.join(big, nm))).astype(np.float32) / 255
                bird.save_png(bird.shrink(f, size), os.path.join(d, nm))
            seq = os.path.join(d, 'f%03d.png')
            base = os.path.join(OUT, f'sweeter-hero-{size}')
            bird.run(['ffmpeg', '-y', '-framerate', str(FPS), '-i', seq, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
                      '-crf', '22', '-b:v', '0', '-row-mt', '1', '-auto-alt-ref', '0', base + '.webm'])
            bird.run(['ffmpeg', '-y', '-framerate', str(FPS), '-i', seq, '-c:v', 'hevc_videotoolbox', '-alpha_quality', '0.9',
                      '-q:v', '72', '-tag:v', 'hvc1', '-pix_fmt', 'bgra', base + '-hevc.mov'])
            # Animated WebP that plays once and stays on the icon: 33, 33, 34 ms.
            cmd = ['img2webp', '-loop', '1', '-min_size']
            for i, nm in enumerate(names):
                cmd += ['-d', '34' if i % 3 == 2 else '33', '-lossy', '-q', '88', '-m', '6', os.path.join(d, nm)]
            bird.run(cmd + ['-o', base + '.webp'])
            # Stills: the start (the bird alone, for a poster) and the end (the icon).
            for which, nm in (('start', names[0]), ('end', names[-1])):
                f = np.asarray(Image.open(os.path.join(d, nm)))
                Image.fromarray(f, 'RGBA').save(f'{base}-{which}.webp', quality=90, method=6)
                shutil.copy(os.path.join(d, nm), f'{base}-{which}.png')
            print('hero', size)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f'{n} frames at {FPS} fps ({n / FPS:.2f} s) in', OUT)


if __name__ == '__main__':
    main()
