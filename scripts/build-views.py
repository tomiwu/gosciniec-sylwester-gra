#!/usr/bin/env python3
"""Crop and grade Uniejów backdrop views. Hotel photos: crop + overlay only."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ASPECT = 390 / 844
OUT_W, OUT_H = 780, 1688
CLOCK_CX_FRAC = 0.5
CLOCK_CY_FRAC = 298 / 844
CLOCK_R_FRAC = (356 / 2) / 844  # radius in height fraction
WIDE_W, WIDE_H = 1600, 900

OUT_DIR = Path("/workspace/gosciniec-sylwester-ui/public/assets")
TRIAL = Path("/tmp/view-trials")
TRIAL.mkdir(parents=True, exist_ok=True)


def clamp_box(x, y, cw, ch, w, h):
    cw, ch = min(cw, w), min(ch, h)
    x = min(max(0, x), w - cw)
    y = min(max(0, y), h - ch)
    return int(round(x)), int(round(y)), int(round(cw)), int(round(ch))


def crop_for_clock(im: Image.Image, fx: float, fy: float) -> Image.Image:
    """Portrait crop so (fx, fy) lands on the clock centre. Max size that fits."""
    w, h = im.size
    max_h = min(
        fy / CLOCK_CY_FRAC if CLOCK_CY_FRAC else h,
        (h - fy) / (1 - CLOCK_CY_FRAC),
        fx / (CLOCK_CX_FRAC * ASPECT),
        (w - fx) / ((1 - CLOCK_CX_FRAC) * ASPECT),
        h,
        w / ASPECT,
    )
    max_h = max(1, max_h)
    ch = max_h
    cw = ch * ASPECT
    x = fx - CLOCK_CX_FRAC * cw
    y = fy - CLOCK_CY_FRAC * ch
    x, y, cw, ch = clamp_box(x, y, cw, ch, w, h)
    return im.crop((x, y, x + cw, y + ch))


def resize_portrait(im: Image.Image) -> Image.Image:
    return im.resize((OUT_W, OUT_H), Image.Resampling.LANCZOS)


def vignette(im: Image.Image, strength: float = 0.45, inner: float = 0.35) -> Image.Image:
    """Dark edge overlay. Does not recolour midtones of the subject."""
    w, h = im.size
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = w / 2, h * CLOCK_CY_FRAC
    # elliptical distance, stretched to the frame
    rx, ry = w * 0.62, h * 0.55
    dist = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    fade = np.clip((dist - inner) / (1.35 - inner), 0, 1)
    fade = fade ** 1.15
    alpha = fade * strength
    arr = np.array(im).astype(np.float32)
    # multiply toward dark navy, no hue shift of the photo itself beyond a dark overlay
    overlay = np.array([8, 6, 10], dtype=np.float32)
    a = alpha[..., None]
    arr = arr * (1 - a) + overlay * a
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def dark_overlay(im: Image.Image, amount: float = 0.18) -> Image.Image:
    arr = np.array(im).astype(np.float32)
    overlay = np.array([10, 8, 12], dtype=np.float32)
    arr = arr * (1 - amount) + overlay * amount
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def night_gold(im: Image.Image) -> Image.Image:
    """Colour grade for openly licensed landmark photos only."""
    arr = np.array(im.convert("RGB")).astype(np.float32)
    h, w, _ = arr.shape
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    mx = arr.max(axis=2)
    mn = arr.min(axis=2)
    sat = np.where(mx > 1.0, (mx - mn) / np.maximum(mx, 1.0), 0.0)
    yy = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None]
    is_blue_sky = (b > r + 12) & (b > g - 4) & (lum > 70)
    is_grey_sky = (sat < 0.16) & (lum > 100) & (yy < 0.5)
    is_sky = is_blue_sky | is_grey_sky
    sky_w = np.clip(is_sky.astype(np.float32) * 0.88, 0, 1)
    # Soften the sky mask
    sky_img = Image.fromarray((sky_w * 255).astype(np.uint8), "L")
    sky_w = np.array(sky_img.filter(ImageFilter.GaussianBlur(radius=6)), dtype=np.float32) / 255.0
    horizon = np.clip((yy - 0.12) / 0.42, 0, 1)
    navy = np.array([10, 12, 32], dtype=np.float32)
    dusk = np.array([118, 74, 36], dtype=np.float32)
    sky = navy[None, None, :] * (1 - horizon[..., None] * 0.7) + dusk[None, None, :] * (
        horizon[..., None] * 0.7
    )
    # Architecture: darken, warm, keep detail
    body = (arr - 128.0) * 1.15 + 108.0
    body *= 0.72
    body[:, :, 0] = body[:, :, 0] * 1.10
    body[:, :, 1] = body[:, :, 1] * 0.96
    body[:, :, 2] = body[:, :, 2] * 0.78
    grade = body * (1 - sky_w[..., None]) + sky * sky_w[..., None]
    # Gold glow around the clock centre
    xs = np.linspace(0, 1, w, dtype=np.float32)[None, :]
    ys = yy
    glow = np.exp(-(((xs - 0.5) * 2.2) ** 2 + ((ys - 0.35) * 2.6) ** 2))
    gold = np.array([210, 168, 90], dtype=np.float32)
    grade = grade + glow[..., None] * gold * 0.10
    out = Image.fromarray(np.clip(grade, 0, 255).astype(np.uint8))
    return vignette(out, strength=0.50, inner=0.28)


def save_webp(im: Image.Image, path: Path, quality: int = 80) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", quality=quality, method=6)
    print(f"wrote {path.name} {im.size} {path.stat().st_size // 1024}KB")


def overlay_clock(im: Image.Image, label: str) -> Image.Image:
    vis = im.copy().convert("RGB")
    # scale down for review
    vis.thumbnail((390, 844), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(vis, "RGBA")
    w, h = vis.size
    cx, cy = w * CLOCK_CX_FRAC, h * CLOCK_CY_FRAC
    r = h * CLOCK_R_FRAC
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(201, 162, 77, 220), width=3)
    # horizon and floor hint
    hy = int(h * 470 / 844)
    draw.line((0, hy, w, hy), fill=(201, 162, 77, 120), width=1)
    draw.rectangle((0, 0, w - 1, h - 1), outline=(201, 162, 77, 160), width=1)
    draw.text((8, 8), label, fill=(243, 238, 230, 255))
    return vis


def hall() -> Image.Image:
    src = Image.open("/workspace/fb/nye-clean/warstwy/tlo/base-tlo-centralne.jpg").convert("RGB")
    w, h = src.size
    cw = h * ASPECT
    x = (w - cw) / 2
    crop = src.crop(clamp_box(x, 0, cw, h, w, h)[:2] + (
        clamp_box(x, 0, cw, h, w, h)[0] + clamp_box(x, 0, cw, h, w, h)[2],
        clamp_box(x, 0, cw, h, w, h)[1] + clamp_box(x, 0, cw, h, w, h)[3],
    ))
    # simplify
    box = clamp_box(x, 0, cw, h, w, h)
    crop = src.crop((box[0], box[1], box[0] + box[2], box[1] + box[3]))
    out = resize_portrait(crop)
    # overlay only — no colour grade
    out = dark_overlay(out, 0.16)
    out = vignette(out, strength=0.36, inner=0.4)
    return out


def hall_wide() -> Image.Image:
    src = Image.open("/workspace/fb/nye-clean/warstwy/tlo/base-tlo-centralne.jpg").convert("RGB")
    w, h = src.size
    # Crop a wide band centred on the LED portal (around y 900–2000)
    # 16:9 around the arch
    aspect = WIDE_W / WIDE_H
    ch = min(h, w / aspect)
    cw = ch * aspect
    # vertical: include arch top (~928) and floor (~2200)
    fy = 1500
    y = fy - ch * 0.45
    x = (w - cw) / 2
    box = clamp_box(x, y, cw, ch, w, h)
    crop = src.crop((box[0], box[1], box[0] + box[2], box[1] + box[3]))
    out = crop.resize((WIDE_W, WIDE_H), Image.Resampling.LANCZOS)
    out = dark_overlay(out, 0.2)
    out = vignette(out, strength=0.3, inner=0.45)
    return out


def church() -> Image.Image:
    src = Image.open("/tmp/uniejow-hi/church.jpg").convert("RGB")
    # west gable / entrance, upper facade in the clock
    w, h = src.size
    fx, fy = w * 0.30, h * 0.36
    crop = crop_for_clock(src, fx, fy)
    return night_gold(resize_portrait(crop))


def castle() -> Image.Image:
    src = Image.open("/tmp/uniejow-hi/castle-dusk.jpg").convert("RGB")
    w, h = src.size
    # tower left of centre
    fx, fy = w * 0.34, h * 0.38
    crop = crop_for_clock(src, fx, fy)
    return night_gold(resize_portrait(crop))


def termy() -> Image.Image:
    src = Image.open("/tmp/uniejow-hi/termy.jpg").convert("RGB")
    w, h = src.size
    # TERMY UNIEJÓW sign on the glass façade
    fx, fy = w * 0.36, h * 0.40
    crop = crop_for_clock(src, fx, fy)
    return night_gold(resize_portrait(crop))


def aerial() -> Image.Image:
    src = Image.open("/tmp/hotel-site/Lokalizacja_GU.jpg").convert("RGB")
    # Gold typography box is x=222–377, y=0–131. Crop below it.
    w, h = src.size
    top = 132
    avail_h = h - top
    cw = avail_h * ASPECT
    # Centre on the main roof mass (~ x=300, y=320)
    fx = 300
    x = fx - cw / 2
    box = clamp_box(x, top, cw, avail_h, w, h)
    crop = src.crop((box[0], box[1], box[0] + box[2], box[1] + box[3]))
    out = resize_portrait(crop)
    # overlay only — no colour grade of the hotel photo
    out = dark_overlay(out, 0.28)
    out = vignette(out, strength=0.48, inner=0.32)
    return out


def aerial_wide() -> Image.Image:
    src = Image.open("/tmp/hotel-site/Lokalizacja_GU.jpg").convert("RGB")
    # lower 78% to drop the typography, keep 600-wide then letterbox? 
    # Use a 16:9 crop of the lower portion — 600x337 starting y=131
    w, h = src.size
    top = 132
    ch = h - top  # 468
    aspect = WIDE_W / WIDE_H
    # 468 height => width 468*16/9=832 > 600, so use full width and as much height as 16:9 allows
    cw, ch2 = w, w / aspect  # 600 / 1.777 = 337.5
    y = top + 20
    box = clamp_box(0, y, cw, ch2, w, h)
    crop = src.crop((box[0], box[1], box[0] + box[2], box[1] + box[3]))
    out = crop.resize((WIDE_W, WIDE_H), Image.Resampling.LANCZOS)
    out = dark_overlay(out, 0.28)
    out = vignette(out, strength=0.4, inner=0.4)
    return out


def main():
    jobs = {
        "view-hall.webp": hall(),
        "view-church.webp": church(),
        "view-castle.webp": castle(),
        "view-termy.webp": termy(),
        "view-aerial.webp": aerial(),
        "view-hall-wide.webp": hall_wide(),
        "view-aerial-wide.webp": aerial_wide(),
    }
    for name, im in jobs.items():
        save_webp(im, OUT_DIR / name, quality=82)
        overlay_clock(im, name).save(TRIAL / name.replace(".webp", "-review.jpg"), quality=90)
    # contact of the five play views
    names = [
        "view-hall.webp",
        "view-church.webp",
        "view-castle.webp",
        "view-termy.webp",
        "view-aerial.webp",
    ]
    thumbs = [overlay_clock(jobs[n], n) for n in names]
    tw, th = thumbs[0].size
    sheet = Image.new("RGB", (tw * 5, th), (10, 8, 10))
    for i, t in enumerate(thumbs):
        sheet.paste(t, (i * tw, 0))
    sheet.save(TRIAL / "contact-five.jpg", quality=90)
    print("contact", sheet.size)


if __name__ == "__main__":
    main()
