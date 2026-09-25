# -*- coding: utf-8 -*-
"""Förbereder foton (motiv/bakgrund för 2.5D-parallax) och videoklipp (25 fps-rutor)."""
import os
import subprocess

import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
M = os.path.join(HERE, "media")
B = os.path.join(HERE, "build/media")
PHOTOS = ["cafe", "vacuum", "portrait", "steps", "pointer"]


def segment():
    from rembg import new_session, remove
    sess = new_session("isnet-general-use")
    for name in PHOTOS:
        out = os.path.join(B, f"{name}_mask.png")
        if os.path.exists(out):
            continue
        im = Image.open(os.path.join(M, f"{name}.jpg")).convert("RGB")
        m = remove(im, session=sess, only_mask=True, post_process_mask=True)
        m.save(out)
        print("mask", name, flush=True)


def plates():
    """Bakgrundsplatta där motivet är bortmålat (för parallax)."""
    for name in PHOTOS:
        img = cv2.imread(os.path.join(M, f"{name}.jpg"))
        m = cv2.imread(os.path.join(B, f"{name}_mask.png"), cv2.IMREAD_GRAYSCALE)
        h, w = m.shape
        s = 0.5
        small = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
        ms = cv2.resize(m, small.shape[1::-1], interpolation=cv2.INTER_AREA)
        hole = (ms > 20).astype(np.uint8) * 255
        hole = cv2.dilate(hole, np.ones((25, 25), np.uint8))
        filled = cv2.inpaint(small, hole, 12, cv2.INPAINT_TELEA)
        # mjuka upp det bortmålade området så det inte drar blicken
        blur = cv2.GaussianBlur(filled, (0, 0), 9)
        hm = cv2.GaussianBlur(hole.astype(np.float32) / 255, (0, 0), 8)[..., None]
        filled = (filled * (1 - hm) + blur * hm).astype(np.uint8)
        filled = cv2.resize(filled, (w, h), interpolation=cv2.INTER_CUBIC)
        # behåll originalet utanför hålet
        big = cv2.resize(hm[..., 0], (w, h))[..., None]
        plate = (img * (1 - big) + filled * big).astype(np.uint8)
        cv2.imwrite(os.path.join(B, f"{name}_plate.jpg"), plate, [cv2.IMWRITE_JPEG_QUALITY, 94])
        print("plate", name, flush=True)


def frames():
    for name, src in (("fiddle", "fiddle.mov"), ("shh", "shh.mov")):
        d = os.path.join(B, name)
        os.makedirs(d, exist_ok=True)
        if os.listdir(d):
            continue
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(M, src),
                        "-vf", "fps=25,scale=720:1280:flags=lanczos", "-q:v", "2",
                        os.path.join(d, "%04d.jpg")], check=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(M, src), "-vn", "-ac", "2",
                        "-ar", "48000", os.path.join(B, f"{name}.wav")], check=True)
        print("frames", name, len(os.listdir(d)), flush=True)


if __name__ == "__main__":
    os.makedirs(B, exist_ok=True)
    frames()
    segment()
    plates()
