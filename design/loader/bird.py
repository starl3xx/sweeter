#!/usr/bin/env python3
"""starl3xx's Sweeter bird, flapping: the loading screen's eight poses,
built from the app icon's own painting (design/sweeter-icon-art.png).

The bird is cut off the icon's sky, then split into a body that never moves
and the swirl wing, which lifts from the shoulder in one arc. Four flight
feathers, cut from the icon's own tail and painted with the swirl's next
rings, fan out from under the wing as it rises. The resting pose is the
icon itself. Eight poses, 130 ms each, looped (styles.js .boot-bird).

  scripts/bird.sh            design/loader/sweeter-loader-sprite.png, then loader.sh
  scripts/bird.sh exports    every size and format, in build/bird/exports

Coordinates below are pixels on the 1254 px icon art.
"""
import os
import shutil
import subprocess
import sys
import tempfile

import cv2
import numpy as np
import scipy.sparse as sp
import scipy.sparse.linalg as spl
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ART = os.path.join(ROOT, 'design', 'sweeter-icon-art.png')
SPRITE = os.path.join(ROOT, 'design', 'loader', 'sweeter-loader-sprite.png')
EXPORTS = os.path.join(ROOT, 'build', 'bird', 'exports')

# The motion. theta: the wing's lift per pose (degrees, 0 = folded as in the
# icon); it rises over three poses, hangs a beat, comes down, overshoots a
# little and settles. The feather tips trail the shoulder by `lag` of the
# wing's speed; the shoulder rises by `lift` at the top; the body rises on
# the downstroke (`bob`, px in a 256 px cell, up is positive).
POSE = dict(
    pivot=(715, 705), r0=120, r1=380,
    theta=[0, 24, 58, 82, 72, 44, 12, -2], tmax=82, lag=0.22, lift=(-10, -70),
    bob=[0.2, -0.6, -1.2, -1.2, -0.4, 0.8, 1.6, 1.0], shadow=0.22,
    # Flight feathers: direction from the shoulder (degrees) and length, folded
    # under the wing (rest) and fanned out (open), back feather first.
    fan=dict(base=40, width=(55, 85), occl=0.16, stack_shadow=0.1,
             base_tint=(1.0, 0.975, 0.985), tint=(0.99, 0.965, 0.975),
             feathers=[((150, 230), (146, 360)), ((146, 215), (132, 340)),
                       ((142, 200), (118, 310)), ((138, 185), (104, 270))]),
)
MS = 130  # per pose

# Same size and place in the cell as the first sprite's resting pose: the
# bird 221 px wide at (20, 32) in a 256 px cell.
BX0, BY0, BX1 = 215, 212, 1109
S256 = 221 / (BX1 - BX0 + 1)
OX256, OY256 = 20 - BX0 * S256, 32 - BY0 * S256


# ---------------------------------------------------------------- helpers

def catmull(pts, n=12):
    """A closed Catmull-Rom curve through traced points."""
    p = np.array(pts, np.float64)
    out = []
    for i in range(len(p)):
        p0, p1, p2, p3 = p[i - 1], p[i], p[(i + 1) % len(p)], p[(i + 2) % len(p)]
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    return np.array(out)


def poly_mask(pts, shape, ss=4):
    h, w = shape
    big = np.zeros((h * ss, w * ss), np.uint8)
    cv2.fillPoly(big, [np.round(catmull(pts) * ss).astype(np.int32)], 255)
    return cv2.resize(big, (w, h), interpolation=cv2.INTER_AREA).astype(np.float32) / 255


def fill(img, valid, sigma):
    """Blur only the valid pixels (normalized convolution)."""
    v = valid.astype(np.float32)
    w = cv2.GaussianBlur(v, (0, 0), sigma)
    if img.ndim == 3:
        out = np.stack([cv2.GaussianBlur(img[..., c] * v, (0, 0), sigma) for c in range(img.shape[2])], -1)
        return out / np.maximum(w, 1e-6)[..., None]
    return cv2.GaussianBlur(img * v, (0, 0), sigma) / np.maximum(w, 1e-6)


def largest(mask):
    lab, n = ndi.label(mask)
    sizes = ndi.sum(mask, lab, range(1, n + 1))
    return lab == (1 + int(np.argmax(sizes)))


def shrink(rgba, size):
    """Area-downsample straight RGBA through premultiplied color."""
    a = rgba[..., 3:4]
    pm = np.concatenate([rgba[..., :3] * a, a], -1)
    small = cv2.resize(pm, (size, size), interpolation=cv2.INTER_AREA)
    sa = small[..., 3:4]
    return np.concatenate([np.where(sa > 1e-4, small[..., :3] / np.maximum(sa, 1e-4), 0), sa], -1).clip(0, 1)


def save_png(rgba, path):
    mode = 'RGBA' if rgba.shape[-1] == 4 else 'RGB'
    Image.fromarray((np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8), mode).save(path)


# ---------------------------------------------------------------- the bird off the sky

def matte():
    """The bird with a clean alpha. The sky is estimated around the bird; a rim
    pixel's alpha is its projection onto the line from that sky color to the
    nearest solid bird color, so the painted sky rim light (bluish) drops out
    and white feathers keep their edge."""
    art = np.asarray(Image.open(ART).convert('RGB')).astype(np.float32) / 255
    k = art[..., 0] - art[..., 2]  # pink vs sky
    rough = ndi.binary_fill_holes(largest(ndi.binary_opening(k > 0.12, iterations=2)))
    sky = ~ndi.binary_dilation(rough, iterations=40)
    bg = art.copy()
    for s in (160, 80, 40, 20):
        est = fill(art, sky, s)
        ok = cv2.GaussianBlur(sky.astype(np.float32), (0, 0), s) > 0.02
        bg[~sky & ok] = est[~sky & ok]
    bg = cv2.GaussianBlur(bg, (0, 0), 4)
    bg[sky] = art[sky]

    dist = np.linalg.norm(art - bg, axis=-1)
    core = (k > 0.12) | ((k > -0.02) & (dist > 0.35))
    core = ndi.binary_fill_holes(largest(ndi.binary_opening(core, iterations=2)))
    solid = ndi.binary_erosion(core, iterations=4)
    _, (iy, ix) = ndi.distance_transform_edt(~solid, return_indices=True)
    near = cv2.GaussianBlur(art[iy, ix], (0, 0), 1.5)

    d = near - bg
    alpha = np.sum((art - bg) * d, -1) / np.maximum(np.sum(d * d, -1), 1e-4)
    alpha = np.clip(alpha, 0, 1)
    alpha[~ndi.binary_dilation(core, iterations=10)] = 0
    alpha[ndi.binary_erosion(core, iterations=3)] = 1
    # A slightly firmer edge: the fur fringe stays, the faint sky haze goes.
    alpha = np.clip((alpha - 0.12) / 0.8, 0, 1)

    a3 = alpha[..., None]
    unmixed = np.clip(bg + (art - bg) / np.maximum(a3, 1e-3), 0, 1)
    t = np.clip((alpha - 0.3) / 0.5, 0, 1)[..., None]
    fg = t * unmixed + (1 - t) * near
    fg[solid] = art[solid]
    return np.dstack([fg, alpha]).astype(np.float32)


# ---------------------------------------------------------------- wing and body

# The swirl wing's outline, traced on the icon art, clockwise from its tip.
WING = [(382, 860), (430, 830), (480, 800), (520, 775), (550, 755), (570, 725),
        (590, 685), (615, 650), (650, 620), (690, 605), (730, 607), (765, 625),
        (790, 655), (807, 690), (812, 730), (807, 770), (792, 800), (770, 825),
        (730, 850), (680, 870), (630, 882), (580, 887), (530, 885), (480, 880),
        (430, 870)]


def membrane(img, known, scale=0.5):
    """Fill the unknown pixels smoothly from the known ones around them
    (Laplace's equation, solved at half size)."""
    h, w = img.shape[:2]
    small = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    kn = cv2.resize(known.astype(np.float32), None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) > 0.999
    sh, sw = kn.shape
    idx = -np.ones((sh, sw), np.int64)
    ys, xs = np.nonzero(~kn)
    idx[ys, xs] = np.arange(len(ys))
    n = len(ys)
    rows, cols, vals = [], [], []
    b = np.zeros((n, small.shape[2]))
    for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        ny, nx = np.clip(ys + dy, 0, sh - 1), np.clip(xs + dx, 0, sw - 1)
        nb = idx[ny, nx]
        inside = nb >= 0
        rows += list(np.arange(n)[inside]); cols += list(nb[inside]); vals += [-1.0] * int(inside.sum())
        b[~inside] += small[ny[~inside], nx[~inside]]
    rows += list(range(n)); cols += list(range(n)); vals += [4.0] * n
    lu = spl.splu(sp.csr_matrix((vals, (rows, cols)), shape=(n, n)).tocsc())
    out = small.copy()
    out[ys, xs] = lu.solve(b)
    up = cv2.resize(out, (w, h), interpolation=cv2.INTER_CUBIC)
    return np.where(known[..., None], img, up)


def clone_texture(img, valid, hole, shifts, sigma=12, feather=10):
    """Fur detail for the hole: band-pass copies of nearby body, blended softly."""
    hp = img - cv2.GaussianBlur(img, (0, 0), sigma)
    ref = hp[valid].std(0)
    acc = np.zeros_like(img)
    wsum = np.zeros(img.shape[:2], np.float32)
    for dx, dy in shifts:
        M = np.float32([[1, 0, dx], [0, 1, dy]])
        moved = cv2.warpAffine(hp, M, (img.shape[1], img.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        v = cv2.warpAffine(valid.astype(np.float32), M, (img.shape[1], img.shape[0]), flags=cv2.INTER_NEAREST)
        v = cv2.GaussianBlur(cv2.erode(v, np.ones((15, 15))), (0, 0), feather) ** 4
        acc += moved * v[..., None]
        wsum += v
    tex = acc / np.maximum(wsum, 1e-6)[..., None]
    got = tex[hole].std(0)
    return tex * (ref / np.maximum(got, 1e-6)).clip(1, 2.5)


def split(master):
    """The swirl wing, and the body with fur painted in where the wing was."""
    H, W, _ = master.shape
    rgb, a = master[..., :3], master[..., 3]
    wing_hard = ndi.binary_dilation(poly_mask(WING, (H, W)) > 0.5, iterations=5)
    wing_a = cv2.GaussianBlur(wing_hard.astype(np.float32), (0, 0), 2.0) * a

    # The body's outline without the wing: close the notch the wing tip leaves.
    solid = a > 0.5
    closed = cv2.morphologyEx((solid & ~wing_hard).astype(np.uint8), cv2.MORPH_CLOSE,
                              cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (91, 91))).astype(bool)
    closed = ndi.binary_fill_holes(closed)
    hole = ndi.binary_dilation(wing_hard, iterations=12) & closed
    # At rest only the wing's own footprint is replaced, so the rest pose is the icon.
    hole_rest = ndi.binary_dilation(wing_hard, iterations=4) & closed
    body_a = a.copy()
    notch = wing_hard & ~closed
    body_a[notch] = 0
    soft = cv2.GaussianBlur(closed.astype(np.float32), (0, 0), 1.6)
    near = ndi.binary_dilation(wing_hard, iterations=12) & ~ndi.binary_erosion(closed, iterations=3)
    body_a = np.where(near & ~solid | notch, soft * (~solid | notch), body_a)
    body_a[hole & ndi.binary_erosion(closed, iterations=2)] = 1

    # The body under the wing: a smooth fill of the body's own shading (wing
    # pixels left out), plus fur cloned from nearby body.
    valid = ~hole & solid
    base = fill(rgb, valid & (a > 0.99), 12)
    shading = membrane(base, ~hole | ~closed)
    tex = clone_texture(rgb, valid & (a > 0.99), hole, [(0, -200), (190, 10), (-150, -40), (40, 120)])
    # Cloned detail fades out at the outline, where it can pick up rim light.
    edge = cv2.GaussianBlur(ndi.binary_erosion(closed, iterations=8).astype(np.float32), (0, 0), 3)[..., None]
    painted = np.clip(shading + np.clip(tex, -0.2, 0.2) * edge, 0, 1)

    def seamed(h):
        sm = cv2.GaussianBlur(h.astype(np.float32), (0, 0), 2.5)
        sm = np.where(h, np.maximum(sm, 0.5) * 2 - 1, 0)[..., None]
        return sm * painted + (1 - sm) * rgb
    # Color only: the wing tip's white also sits on the soft rim outside the body.
    rim = ndi.binary_dilation(wing_hard, iterations=12)
    return dict(body=seamed(hole | rim), body_rest=seamed(hole_rest | (rim & ~closed)),
                body_a=body_a, wing=rgb, wing_a=wing_a)


# ---------------------------------------------------------------- flight feathers

# The icon's big left tail feather, cut where the next feather starts to
# cover it, and its tip and the middle of the cut.
TAIL = [(246.7, 504), (266.7, 506.7), (293, 517), (316.7, 533), (340, 557), (366.7, 586.7),
        (390, 613), (333, 640), (276.7, 648), (261.7, 626.7), (246.7, 600), (238, 573),
        (234, 543), (236.7, 520)]
TAIL_TIP, TAIL_CUT = (246.7, 504.0), (333.0, 637.0)
TIP_ROW = 8

# The swirl, measured on the icon art from the spiral's core: where its outer
# cream arm ends at each angle (degrees, y down), and the width of one pink
# and one cream band beyond it.
CORE = (696.0, 740.0)
ARM_DEG = [90, 120, 150, 180, 210, 240, 270, 300]
ARM_END = [65, 81, 110, 132, 120, 123, 132, 131]
PERIOD, CREAM = 70.0, 27.0


def tail_feather(master):
    """The tail feather upright (tip at the top), premultiplied RGBA."""
    H, W, _ = master.shape
    mask = cv2.GaussianBlur(poly_mask(TAIL, (H, W)), (0, 0), 1.0)
    # Close the little V where the next tail feather begins.
    a = cv2.morphologyEx(master[..., 3], cv2.MORPH_CLOSE,
                         cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))) * mask
    tip, cut = np.array(TAIL_TIP), np.array(TAIL_CUT)
    axis = (cut - tip) / np.linalg.norm(cut - tip)
    length = float(np.linalg.norm(cut - tip)) + 6
    width = 140
    M = cv2.getRotationMatrix2D((float(tip[0]), float(tip[1])), np.degrees(np.arctan2(axis[1], axis[0])) - 90, 1.0)
    M[0, 2] += width / 2 - tip[0]
    M[1, 2] += TIP_ROW - tip[1]
    pm = np.dstack([master[..., :3] * a[..., None], a]).astype(np.float32)
    spr = cv2.warpAffine(pm, M, (width, int(length) + 16), flags=cv2.INTER_LINEAR, borderValue=0)
    # Soften the cut end; it always sits under the wing.
    rows = np.arange(spr.shape[0], dtype=np.float32)[:, None]
    spr = spr * np.clip((spr.shape[0] - 10 - rows) / 18, 0, 1)[..., None]
    # Only the feathers' edges show in the fan, and the painting lights those
    # edges, so pull the light rims halfway back toward the feather's pink.
    sa = spr[..., 3:4]
    rgb = spr[..., :3] / np.maximum(sa, 1e-4)
    mean = rgb[spr[..., 3] > 0.95].mean(0)
    rgb = np.where(rgb > mean, mean + (rgb - mean) * 0.5, rgb)
    return np.concatenate([rgb * sa, sa], -1).astype(np.float32)


class Feathers:
    """Four copies of the tail feather tucked under the wing that slide out and
    fan from its back edge as it lifts. Each is painted with the swirl's next
    rings where it lies with the fan fully open, so its bands meet the wing's
    own bands there and stay fixed to the feather as it moves."""

    def __init__(self, master, pivot, fan):
        self.spr = tail_feather(master)
        self.sh, self.sw = self.spr.shape[:2]
        self.length = self.sh - TIP_ROW
        self.pivot, self.fan = pivot, fan
        g = master[..., 1]
        ys, xs = np.mgrid[0:master.shape[0], 0:master.shape[1]]
        ring = (np.hypot(xs - CORE[0], ys - CORE[1]) > 30) & (np.hypot(xs - CORE[0], ys - CORE[1]) < 100) & (master[..., 3] > 0.99)
        self.pink = master[..., :3][ring & (g < 0.5)].mean(0).astype(np.float32)
        self.cream = master[..., :3][ring & (g > 0.8)].mean(0).astype(np.float32)
        # Soft random wobble for the band edges (fixed seed, so every build matches).
        noise = cv2.GaussianBlur(np.random.default_rng(7).standard_normal(master.shape[:2]).astype(np.float32), (0, 0), 3.5)
        self.noise = noise / noise.std()
        lum = master[..., :3].mean(-1)
        self.fluff = (lum - cv2.GaussianBlur(lum, (0, 0), 4)) / max(float(lum.mean()), 1e-3)
        self.paint = [self.painted(open_) for _, open_ in fan['feathers']]

    def rows(self, t, length):
        """Sprite row for a distance t from the tip: the tip end, which shows,
        stays near the painting's own scale; the hidden base takes the rest."""
        T1, k = 150.0, 1.15
        r1 = min(T1 / k, self.length * 0.85)
        return TIP_ROW + np.where(t < T1, t / T1 * r1, r1 + (t - T1) / max(length - T1, 1) * (self.length - r1))

    def painted(self, open_):
        spr, sh, sw = self.spr, self.sh, self.sw
        a = spr[..., 3]
        lum = (spr[..., :3] / np.maximum(a[..., None], 1e-4)).mean(-1)
        ang, length = np.deg2rad(open_[0]), open_[1]
        width = self.fan['width'][1]
        d = np.array([np.cos(ang), np.sin(ang)])
        nrm = np.array([-d[1], d[0]])
        base = np.array(self.pivot) + d * self.fan['base']
        # Where each sprite pixel lands with the fan open (inverse of rows()).
        T1, k = 150.0, 1.15
        r1 = min(T1 / k, self.length * 0.85)
        ys, xs = np.mgrid[0:sh, 0:sw].astype(np.float32)
        g = ys - TIP_ROW
        t = np.where(g < r1, g / r1 * T1, T1 + (g - r1) / (self.length - r1) * (length - T1))
        along, across = length - t, (xs - sw / 2) * width / (sw * 0.62)
        qx = (base[0] + along * d[0] + across * nrm[0]).astype(np.float32)
        qy = (base[1] + along * d[1] + across * nrm[1]).astype(np.float32)
        R = np.hypot(qx - CORE[0], qy - CORE[1])
        th = np.arctan2(qy - CORE[1], qx - CORE[0])
        R0 = np.interp(np.degrees(th) % 360, ARM_DEG, ARM_END)
        ph = np.mod(R - R0 + 3.5 * cv2.remap(self.noise, qx, qy, cv2.INTER_LINEAR), PERIOD)
        soft = 2.5
        cream = np.clip((ph - (PERIOD - CREAM) + soft) / (2 * soft), 0, 1) * np.clip((PERIOD - ph + soft) / (2 * soft), 0, 1)
        cream = np.maximum(cream, np.clip((soft - ph) / (2 * soft), 0, 1))
        col = self.pink * (1 - cream[..., None]) + self.cream * cream[..., None]
        # The swirl's own fluff: detail from the same band, one ring further in.
        rs = np.clip(R0 - PERIOD + ph, 20, 125)
        det = cv2.remap(self.fluff, (CORE[0] + rs * np.cos(th)).astype(np.float32),
                        (CORE[1] + rs * np.sin(th)).astype(np.float32), cv2.INTER_LINEAR)
        col = col * (1 + det)[..., None]
        # The tail feather's shaft and rounded shading.
        m = lum[a > 0.5].mean()
        hp = lum - cv2.GaussianBlur(lum, (0, 0), 2.5)
        form = np.clip(cv2.GaussianBlur(lum, (0, 0), 10) / m, 0.75, 1.2) ** 0.6
        col = np.clip(col * form[..., None] * (1 + 0.9 * hp / m)[..., None], 0, 1)
        return np.concatenate([col * a[..., None], a[..., None]], -1).astype(np.float32)

    def draw(self, xx, yy, f):
        """Premultiplied RGBA of the feathers at fan amount f (wing's frame)."""
        fan = self.fan
        px, py = self.pivot
        out = np.zeros(xx.shape + (4,), np.float32)
        n = len(fan['feathers'])
        for j, (rest, open_) in enumerate(fan['feathers']):
            ang = np.deg2rad(rest[0] + (open_[0] - rest[0]) * f)
            length = rest[1] + (open_[1] - rest[1]) * f
            width = fan['width'][0] + (fan['width'][1] - fan['width'][0]) * f
            d = np.array([np.cos(ang), np.sin(ang)], np.float32)
            nrm = np.array([-d[1], d[0]], np.float32)
            qx, qy = xx - (px + d[0] * fan['base']), yy - (py + d[1] * fan['base'])
            along = qx * d[0] + qy * d[1]
            across = qx * nrm[0] + qy * nrm[1]
            sy = self.rows(length - along, length)
            sx = self.sw / 2 + across / width * (self.sw * 0.62)
            piece = cv2.remap(self.paint[j], sx.astype(np.float32), sy.astype(np.float32), cv2.INTER_LINEAR,
                              borderMode=cv2.BORDER_CONSTANT, borderValue=0)
            # All of them sit in the wing's shade; deeper ones a little more.
            piece[..., :3] *= np.array(fan['base_tint'], np.float32) * np.array(fan['tint'], np.float32) ** (n - 1 - j)
            # The feather in front shades the one behind along its edge.
            sh = np.roll(np.roll(cv2.GaussianBlur(piece[..., 3], (0, 0), 6), 4, 0), 3, 1)
            out[..., :3] *= (1 - fan['stack_shadow'] * sh)[..., None]
            out = piece + out * (1 - piece[..., 3:4])
        return out


# ---------------------------------------------------------------- posing

class Rig:
    def __init__(self, pose=POSE):
        self.P = pose
        master = matte()
        self.L = split(master)
        H, W = self.L['body_a'].shape
        self.yy, self.xx = np.mgrid[0:H, 0:W].astype(np.float32)
        self.wing_pm = np.dstack([self.L['wing'] * self.L['wing_a'][..., None], self.L['wing_a']]).astype(np.float32)
        self.feathers = Feathers(master, pose['pivot'], pose['fan'])

    def wing(self, f):
        """The wing with its feathers fanned by f, in the icon's frame."""
        if f <= 0.02:
            return self.wing_pm
        fe = self.feathers.draw(self.xx, self.yy, f)
        # The wing shades the feathers just under its edge.
        sh = np.roll(np.roll(cv2.GaussianBlur(self.wing_pm[..., 3], (0, 0), 8), 6, 0), -4, 1)
        fe[..., :3] *= (1 - self.P['fan']['occl'] * sh)[..., None]
        return self.wing_pm + fe * (1 - self.wing_pm[..., 3:4])

    def lift(self, pm, theta, bend, lift):
        """Turn the wing about the shoulder; the tips trail by `bend`."""
        P = self.P
        px, py = P['pivot']
        dx, dy = self.xx - px, self.yy - py
        t = np.clip((np.sqrt(dx * dx + dy * dy) - P['r0']) / (P['r1'] - P['r0']), 0, 1)
        phi = np.deg2rad(theta + bend * t * t * (3 - 2 * t))
        c, s = np.cos(-phi), np.sin(-phi)
        dx, dy = dx - lift[0], dy - lift[1]
        out = cv2.remap(pm, (px + c * dx - s * dy).astype(np.float32), (py + s * dx + c * dy).astype(np.float32),
                        cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
        return out[..., :3], out[..., 3]

    def frame(self, i, cell=256, ss=4):
        """Pose i as straight RGBA floats in a cell px square."""
        P, L = self.P, self.L
        th = P['theta'][i]
        n = len(P['theta'])
        bend = -P['lag'] * (P['theta'][(i + 1) % n] - P['theta'][i - 1]) / 2
        u = np.clip(th / P['tmax'], 0, 1)
        u = u * u * (3 - 2 * u)
        wp, wa = self.lift(self.wing(u), th, bend, (P['lift'][0] * u, P['lift'][1] * u))
        # The wing's shadow on the body, only while it is off its resting spot.
        k = P['shadow'] * np.clip(abs(th) / 40, 0, 1)
        sh = np.roll(np.roll(cv2.GaussianBlur(wa, (0, 0), 14), 14, 0), 6, 1)
        # The crease the folded wing paints on the body fades as the wing lifts.
        w = np.clip(abs(th) / 25, 0, 1)
        plate = L['body_rest'] * (1 - w) + L['body'] * w
        bp = plate * (1 - k * sh)[..., None] * L['body_a'][..., None]
        pm = np.dstack([wp + bp * (1 - wa[..., None]), wa + L['body_a'] * (1 - wa)]).astype(np.float32)
        q = cell / 256
        s = S256 * q * ss
        M = np.float32([[s, 0, OX256 * q * ss], [0, s, (OY256 - P['bob'][i]) * q * ss]])
        big = cv2.warpAffine(pm, M, (cell * ss, cell * ss), flags=cv2.INTER_LINEAR, borderValue=0)
        small = cv2.resize(big, (cell, cell), interpolation=cv2.INTER_AREA)
        a = small[..., 3:4]
        rgb = np.where(a > 1e-4, small[..., :3] / np.maximum(a, 1e-4), 0)
        return np.dstack([np.clip(rgb, 0, 1), np.clip(a, 0, 1)])

    def frames(self, cell=256, ss=4):
        return [self.frame(i, cell, ss) for i in range(len(self.P['theta']))]


# ---------------------------------------------------------------- exports

# The loading screen's glow (ViewController.swift LaunchCoverView, styles.js
# .boot): the icon's sky and the bird's pink over the classic theme's
# background, sized to a 120 pt bird and centered as they fall around it.
GROUNDS = {
    'light': dict(bg=(0xFF, 0xFF, 0xFF), sky=0.30, pink=0.20),
    'dark': dict(bg=(0x26, 0x26, 0x26), sky=0.22, pink=0.18),
}
SKY, PINKGLOW = (0x7E, 0xC0, 0xFA), (0xEE, 0x5A, 0x8E)


def ground(w, h, box, look):
    """The glow behind a bird drawn in a box px square at the canvas center.
    In the app the glows are 240 and 220 pt circles centered (-40, -20.5) and
    (40, -0.5) pt from a 120 pt bird's center."""
    k = box / 120
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32) + 0.5
    cx, cy = w / 2, h / 2
    out = np.ones((h, w, 3), np.float32) * (np.array(look['bg'], np.float32) / 255)
    for color, op, r, ox, oy in ((SKY, look['sky'], 240, -40, -20.5), (PINKGLOW, look['pink'], 220, 40, -0.5)):
        d = np.hypot(xx - (cx + ox * k), yy - (cy + oy * k)) / (r * k)
        al = (op * np.clip(1 - d, 0, 1))[..., None]
        out = out * (1 - al) + (np.array(color, np.float32) / 255) * al
    return out


def on_ground(frame, w, h, box, look, g=None):
    g = ground(w, h, box, look) if g is None else g
    f = shrink(frame, box)
    x0, y0 = (w - box) // 2, (h - box) // 2
    out = g.copy()
    a = f[..., 3:4]
    out[y0:y0 + box, x0:x0 + box] = f[..., :3] * a + out[y0:y0 + box, x0:x0 + box] * (1 - a)
    # A little noise keeps 8-bit gradients from banding.
    out += (np.random.default_rng(1).random(out.shape, np.float32) - 0.5) / 255
    return out


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def write_seq(frames, folder, cycles=1):
    """PNGs f001.png... for ffmpeg: the poses repeated `cycles` times."""
    os.makedirs(folder, exist_ok=True)
    n = 0
    paths = []
    for i, f in enumerate(frames):
        p = os.path.join(folder, f'pose{i}.png')
        save_png(f, p)
        paths.append(p)
    for _ in range(cycles):
        for p in paths:
            n += 1
            os.link(p, os.path.join(folder, f'f{n:03d}.png'))
    return paths


FPS_POSE = f'1000/{MS}'      # one frame per pose
FPS_VIDEO = f'4000/{MS}'     # 30.77 fps: each pose held exactly four frames
CYCLES = 6                   # 6.24 s, so a video plays well where it can't loop


def video(seq, out, alpha):
    src = ['ffmpeg', '-y', '-framerate', FPS_POSE, '-i', os.path.join(seq, 'f%03d.png'), '-vf', f'fps={FPS_VIDEO}']
    ext = os.path.splitext(out)[1]
    if ext == '.mp4':
        run(src[:-2] + ['-vf', f'fps={FPS_VIDEO},format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
                        '-tune', 'animation', '-movflags', '+faststart', out])
    elif ext == '.webm':
        run(src + ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p' if alpha else 'yuv420p', '-crf', '24', '-b:v', '0',
                   '-row-mt', '1', '-auto-alt-ref', '0', out])
    elif out.endswith('-hevc.mov'):
        run(src + ['-c:v', 'hevc_videotoolbox', '-alpha_quality', '0.9', '-q:v', '70', '-tag:v', 'hvc1',
                   '-pix_fmt', 'bgra', out])
    elif out.endswith('-prores.mov'):
        run(src + ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-vendor', 'apl0', out])


def gif(seq, out, alpha):
    pal = 'palettegen=reserve_transparent=1:stats_mode=full' if alpha else 'palettegen=stats_mode=full'
    use = 'paletteuse=alpha_threshold=128:dither=sierra2_4a' if alpha else 'paletteuse=dither=sierra2_4a'
    run(['ffmpeg', '-y', '-framerate', FPS_POSE, '-i', os.path.join(seq, 'f%03d.png'),
         '-filter_complex', f'[0:v]split[a][b];[a]{pal}[p];[b][p]{use}', '-loop', '0', out])


def apng(seq, out):
    run(['ffmpeg', '-y', '-framerate', FPS_POSE, '-i', os.path.join(seq, 'f%03d.png'), '-plays', '0', '-f', 'apng', out])


def webp(paths, out):
    cmd = ['img2webp', '-loop', '0', '-min_size']
    for p in paths:
        cmd += ['-d', str(MS), '-lossy', '-q', '90', '-m', '6', p]
    run(cmd + ['-o', out])


README = """Sweeter bird, flapping
======================

starl3xx's Sweeter bird from the loading screen: eight poses, {ms} ms each,
looped ({cycle} ms a flap). Built from the app icon's painting by
design/loader/bird.py (scripts/bird.sh exports).

transparent/   the bird alone, with soft alpha
  sprite/      every pose in a row (8 cells), PNG, at each size
  frames/      one PNG per pose
  *.apng       animated PNG, full alpha (browsers; rename to .png if a tool wants it)
  *.webp       animated WebP, full alpha (browsers, Android)
  *.gif        GIF: its transparency is on or off per pixel, so the soft edge
               is cut at half; prefer APNG or WebP where alpha matters
  *.webm       VP9 video with alpha (Chrome, Firefox, Edge)
  *-hevc.mov   HEVC video with alpha (Safari, iOS, macOS apps)
  *-prores.mov ProRes 4444 with alpha, one flap, for editing (Final Cut,
               Premiere, Keynote, Motion)

light/, dark/  the bird on the loading screen's glow (classic theme)
  square and 16:9, as MP4, GIF, APNG, WebP and a still of the resting pose;
  ground-*.png is the glow alone

Sizes are the square cell in px; the bird fills about 86% of its width.
120, 240 and 360 are the loading screen's 120 pt at 1x, 2x and 3x.
Videos hold each pose exactly four frames at 30.77 fps and play the flap
{cycles} times ({secs} s), except ProRes (once); set them to loop.
"""


def exports():
    for tool in ('ffmpeg', 'img2webp'):
        if not shutil.which(tool):
            sys.exit(f'{tool} is missing (brew install ffmpeg webp)')
    if os.path.isdir(EXPORTS):
        shutil.rmtree(EXPORTS)
    T = os.path.join(EXPORTS, 'transparent')
    for d in ('sprite', 'frames'):
        os.makedirs(os.path.join(T, d))
    rig = Rig()
    big = rig.frames(1024, 2)
    tmp = tempfile.mkdtemp(prefix='bird-')
    try:
        for size in (1024, 512, 360, 256, 240, 128, 120, 64):
            fs = big if size == 1024 else [shrink(f, size) for f in big]
            save_png(np.concatenate(fs, 1), os.path.join(T, 'sprite', f'sweeter-bird-sprite-{size}.png'))
            if size in (1024, 512, 256):
                d = os.path.join(T, 'frames', str(size))
                os.makedirs(d)
                for i, f in enumerate(fs):
                    save_png(f, os.path.join(d, f'sweeter-bird-{size}-{i + 1}.png'))
            name = os.path.join(T, f'sweeter-bird-{size}')
            if size in (512, 256, 128, 64):
                one = os.path.join(tmp, f't{size}')
                paths = write_seq(fs, one)
                apng(one, name + '.apng')
                webp(paths, name + '.webp')
                gif(one, name + '.gif', alpha=True)
            if size in (1024, 512, 256):
                many = os.path.join(tmp, f'tv{size}')
                write_seq(fs, many, CYCLES)
                video(many, name + '.webm', alpha=True)
                video(many, name + '-hevc.mov', alpha=True)
                if size == 1024:
                    # One flap: editors loop it, and ProRes is large.
                    one = os.path.join(tmp, 'prores')
                    write_seq(fs, one)
                    video(one, name + '-prores.mov', alpha=True)
            print('transparent', size)

        canvases = [('square', 1080, 1080), ('square', 512, 512), ('wide', 1920, 1080), ('wide', 1280, 720)]
        for look_name, look in GROUNDS.items():
            G = os.path.join(EXPORTS, look_name)
            os.makedirs(G)
            for shape, w, h in canvases:
                box = int(round(h * 0.42 / 2)) * 2
                g = ground(w, h, box, look)
                save_png(np.clip(g, 0, 1), os.path.join(G, f'ground-{look_name}-{w}x{h}.png'))
                fs = [np.clip(on_ground(f, w, h, box, look, g), 0, 1) for f in big]
                name = os.path.join(G, f'sweeter-bird-{look_name}-{w}x{h}')
                save_png(fs[0], name + '-still.png')
                seq = os.path.join(tmp, f'{look_name}{w}')
                paths = write_seq(fs, seq, CYCLES)
                video(seq, name + '.mp4', alpha=False)
                if (w, h) in ((512, 512), (1280, 720)):
                    one = os.path.join(tmp, f'{look_name}{w}one')
                    write_seq(fs, one)
                    gif(one, name + '.gif', alpha=False)
                    apng(one, name + '.apng')
                    webp(paths, name + '.webp')
                print(look_name, shape, w, h)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    cycle = MS * len(POSE['theta'])
    with open(os.path.join(EXPORTS, 'README.txt'), 'w') as fh:
        fh.write(README.format(ms=MS, cycle=cycle, cycles=CYCLES, secs=f'{CYCLES * cycle / 1000:.2f}'))
    print('exports in', EXPORTS)


def sprite():
    frames = Rig().frames(256, 4)
    save_png(np.concatenate(frames, 1), SPRITE)
    print('wrote', os.path.relpath(SPRITE, ROOT))


if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'sprite'
    {'sprite': sprite, 'exports': exports}[what]()
