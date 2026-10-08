# -*- coding: utf-8 -*-
"""On-screen text, set in post as 02-shotliste.md asks. One template per kind of
graphic (stat card, source line, bullet list, chapter card, label, message bubble),
so a corrected number is a one-line change."""
import math

import cv2
import numpy as np

import config

from .common import (BLUE, GREY, H, INK, INK_DIM, W, draw_text, ease_out, fade, fill_polys, lin,
                     over_color, poly_lines, smooth, text_width)

MARGIN = 110
SRC_Y = H - 58


def shade_panel(img, x0, y0, x1, y1, alpha, strength=0.45, soft=60):
    """Soft dark gradient behind text so it reads on any picture."""
    if alpha <= 0:
        return img
    m = np.zeros((H, W), np.float32)
    cv2.rectangle(m, (int(x0), int(y0)), (int(x1), int(y1)), 1.0, -1)
    m = cv2.GaussianBlur(m, (0, 0), soft)
    img *= (1 - m * strength * alpha)[..., None]
    return img


def source(img, t, t0, t1, text, x=MARGIN):
    """«Kilde: … (år)» bottom left."""
    a = fade(t, t0, t0 + 0.6, t1 - 0.5, t1)
    if a > 0:
        shade_panel(img, x - 20, SRC_Y - 30, x + text_width(text, "mono_r", 21) + 20, SRC_Y + 12, a, 0.35, 30)
        draw_text(img, text, x, SRC_Y, name="mono_r", size=21, color=INK_DIM, alpha=a * 0.95, shadow=0.8)
    return img


def illustration(img, a=1.0):
    if a > 0:
        draw_text(img, "Illustrasjon", W - MARGIN + 30, SRC_Y, name="mono_r", size=19, color=INK_DIM,
                  alpha=0.75 * a, anchor="r", shadow=0.8)
    return img


def draft(img):
    if config.DRAFT:
        draw_text(img, config.DRAFT_TEXT, 40, 52, name="mono_r", size=19, color=(1.0, 0.82, 0.45),
                  alpha=0.85, shadow=1.0)
    return img


def stat(img, t, t0, t1, big, label, x=MARGIN, y=H - 250, blue=True, size=92, sub=None, panel=True):
    """Key number (Høyre blue) with a label line under it."""
    a = fade(t, t0, t0 + 0.7, t1 - 0.6, t1)
    if a <= 0:
        return img
    e = ease_out(lin(t, t0, t0 + 1.0))
    wbig = text_width(big, "sans_sb", size, 0.0)
    wl = text_width(label, "sans_m", 34, 0.01)
    if panel:
        shade_panel(img, x - 40, y - size - 20, x + max(wbig, wl) + 50, y + (90 if sub else 60), a, 0.5, 50)
    col = BLUE_TEXT if blue else INK
    draw_text(img, big, x, y + 12 * (1 - e), name="sans_sb", size=size, color=col, alpha=a, shadow=1.0)
    draw_text(img, label, x + 2, y + 50 + 8 * (1 - e), name="sans_m", size=34, tracking=0.01, color=INK,
              alpha=a, shadow=1.0)
    if sub:
        draw_text(img, sub, x + 2, y + 92 + 8 * (1 - e), name="sans", size=28, color=INK_DIM, alpha=a * 0.9, shadow=1.0)
    return img


def line_text(img, t, t0, t1, text, x, y, size=34, color=None, name="sans_m", anchor="l", panel=False):
    a = fade(t, t0, t0 + 0.6, t1 - 0.5, t1)
    if a <= 0:
        return img
    e = ease_out(lin(t, t0, t0 + 0.9))
    if panel:
        w_ = text_width(text, name, size)
        xa = x - w_ / 2 if anchor == "c" else x
        shade_panel(img, xa - 30, y - size - 10, xa + w_ + 30, y + 22, a, 0.45, 40)
    draw_text(img, text, x, y + 8 * (1 - e), name=name, size=size, color=INK if color is None else color,
              alpha=a, anchor=anchor, shadow=1.0)
    return img


def bullets(img, t, items, t_end, x=MARGIN, y=200, size=36, gap=64, title=None, marker=True):
    """items: [(time, text)]. Høyre policy points: blue marker, off-white text."""
    vis = [(ti, tx) for ti, tx in items if t >= ti - 0.05]
    if not vis:
        return img
    aend = 1 - smooth(lin(t, t_end - 0.6, t_end))
    if aend <= 0:
        return img
    wmax = max(text_width(tx, "sans_m", size) for _, tx in items)
    a0 = smooth(lin(t, items[0][0] - 0.1, items[0][0] + 0.5)) * aend
    yy = y
    if title:
        yy += 0
    shade_panel(img, x - 50, y - size - 40 - (50 if title else 0), x + wmax + 110,
                y + gap * (len(items) - 1) + 40, a0, 0.55, 60)
    if title:
        draw_text(img, title, x, y - 62, name="cond_sb", size=28, tracking=0.12, color=BLUE_TEXT, alpha=a0, shadow=1.0)
    for k, (ti, tx) in enumerate(items):
        a = smooth(lin(t, ti, ti + 0.5)) * aend
        if a <= 0:
            continue
        e = ease_out(lin(t, ti, ti + 0.8))
        yk = y + k * gap
        if marker:
            m = np.zeros((H, W), np.float32)
            s = 11
            cx, cy = x + 8, yk - size * 0.33
            fill_polys(m, [np.array([(cx - s / 2, cy - s / 2), (cx + s / 2, cy - s / 2), (cx + s / 2, cy + s / 2),
                                     (cx - s / 2, cy + s / 2)])])
            over_color(img, BLUE_TEXT, m * a)
        draw_text(img, tx, x + 36 + 14 * (1 - e), yk, name="sans_m", size=size, color=INK, alpha=a, shadow=1.0)
    return img


def chapter(img, t, t0, t1, num, title):
    a = fade(t, t0, t0 + 0.5, t1 - 0.5, t1)
    if a <= 0:
        return img
    e = ease_out(lin(t, t0, t0 + 1.2))
    cy = H - 250
    shade_panel(img, W / 2 - 560, cy - 130, W / 2 + 560, cy + 90, a, 0.55, 80)
    draw_text(img, f"KAPITTEL {num}", W / 2, cy - 50, name="cond_sb", size=34, tracking=0.3,
              color=INK_DIM, alpha=a, anchor="c", shadow=1.0)
    draw_text(img, title, W / 2, cy + 40 + 10 * (1 - e), name="sans_sb", size=80 if len(title) < 12 else 62,
              tracking=0.08, color=INK, alpha=a, anchor="c", shadow=1.2)
    m = np.zeros((H, W), np.float32)
    L = 70 * e
    poly_lines(m, [np.array([(W / 2 - L, cy - 22), (W / 2 + L, cy - 22)])], 2)
    over_color(img, BLUE_TEXT, m * a)
    return img


def label_at(img, cam, P, text, a, size=30, dy=-30, color=None, name="sans_m", w=W, h=H):
    """Text label above a world point."""
    if a <= 0:
        return img
    p = cam.project(np.asarray(P, float)[None], w, h)[0]
    if p[2] <= 0:
        return img
    draw_text(img, text, p[0], p[1] + dy, name=name, size=size, color=INK if color is None else color,
              alpha=a, anchor="c", shadow=1.3)
    return img


def bubble(img, t, t0, x, y, sender, text, t1=1e9):
    """Neutral white chat bubble (not Høyre blue)."""
    a = fade(t, t0, t0 + 0.35, t1 - 0.5, t1)
    if a <= 0:
        return img
    e = ease_out(lin(t, t0, t0 + 0.6), 4)
    size = 38
    tw = text_width(text, "sans_m", size)
    bw, bh = tw + 64, 116
    x0, y0 = x, y + 18 * (1 - e)
    m = np.zeros((H, W), np.float32)
    r = 26
    cv2.rectangle(m, (int(x0 + r), int(y0)), (int(x0 + bw - r), int(y0 + bh)), 1, -1)
    cv2.rectangle(m, (int(x0), int(y0 + r)), (int(x0 + bw), int(y0 + bh - r)), 1, -1)
    for cx, cy in ((x0 + r, y0 + r), (x0 + bw - r, y0 + r), (x0 + r, y0 + bh - r), (x0 + bw - r, y0 + bh - r)):
        cv2.circle(m, (int(cx), int(cy)), r, 1, -1, cv2.LINE_AA)
    tail = np.array([(x0 + 18, y0 + bh - 12), (x0 + 6, y0 + bh + 18), (x0 + 48, y0 + bh - 2)])
    fill_polys(m, [tail])
    m = cv2.GaussianBlur(m, (0, 0), 0.8)
    sh = cv2.GaussianBlur(m, (0, 0), 14)
    img *= (1 - np.roll(sh, 8, 0) * 0.45 * a)[..., None]
    over_color(img, (0.97, 0.97, 0.96), m * a)
    draw_text(img, sender, x0 + 32, y0 + 38, name="sans_m", size=24, color=(0.45, 0.46, 0.48), alpha=a)
    draw_text(img, text, x0 + 32, y0 + 88, name="sans_m", size=size, color=(0.12, 0.13, 0.15), alpha=a)
    return img


def counter(img, value, x, y, a, digits=3, size=110):
    """Mechanical counter display (white digits on dark tiles)."""
    if a <= 0:
        return img
    s = f"{int(value):0{digits}d}"
    cw = size * 0.68
    m = np.zeros((H, W), np.float32)
    for i in range(digits):
        cx = x + i * (cw + 10)
        cv2.rectangle(m, (int(cx), int(y - size)), (int(cx + cw), int(y + 20)), 1, -1)
    img *= (1 - cv2.GaussianBlur(m, (0, 0), 3) * 0.75 * a)[..., None]
    for i, ch in enumerate(s):
        cx = x + i * (cw + 10) + cw / 2
        draw_text(img, ch, cx, y, name="mono_r", size=size, color=INK, alpha=a, anchor="c")
    return img


def fade_black(img, k):
    if k > 0:
        img *= (1 - k)
    return img


# Høyre blue tuned for legibility on dark pictures (same hue, a little lighter for text)
def _text_blue():
    b = np.asarray(BLUE, np.float32)
    return np.clip(b + (1 - b) * 0.18, 0, 1)


BLUE_TEXT = _text_blue()
