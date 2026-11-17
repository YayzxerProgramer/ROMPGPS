import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUTPUT_DIR = os.path.abspath("FrontEnd/public")
os.makedirs(OUTPUT_DIR, exist_ok=True)

ACCENT_COLOR = (178, 206, 168, 255)  # #b2cea8
DARK_BG = (13, 15, 13, 255)          # #0d0f0d
WHITE = (255, 255, 255, 255)
MUTED_TEXT = (160, 175, 160, 255)
CARD_BG = (22, 27, 22, 230)
CARD_BORDER = (45, 55, 45, 255)

def render_logo(size, bg_radius_ratio=0.25, bg_color=DARK_BG):
    scale = 4
    s = size * scale
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    
    if bg_color:
        r = int(s * bg_radius_ratio)
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=r, fill=bg_color)
    
    cx, cy = s / 2, s / 2
    ring_r = s * 0.25
    stroke_w = max(2, int(s * 0.073))
    
    d.ellipse([cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r], outline=ACCENT_COLOR, width=stroke_w)
    
    pad_out = s * 0.104
    pad_in = s * 0.23
    
    d.line([(cx, pad_out), (cx, pad_in)], fill=ACCENT_COLOR, width=stroke_w)
    d.line([(cx, s - pad_in), (cx, s - pad_out)], fill=ACCENT_COLOR, width=stroke_w)
    d.line([(pad_out, cy), (pad_in, cy)], fill=ACCENT_COLOR, width=stroke_w)
    d.line([(s - pad_in, cy), (s - pad_out, cy)], fill=ACCENT_COLOR, width=stroke_w)
    
    center_r = s * 0.083
    d.ellipse([cx - center_r, cy - center_r, cx + center_r, cy + center_r], fill=ACCENT_COLOR)
    
    return im.resize((size, size), Image.Resampling.LANCZOS)

def generate_icons():
    print("Generating Favicons and Icons...")
    # Sizes
    sizes = {
        "favicon-16x16.png": 16,
        "favicon-32x32.png": 32,
        "favicon-48x48.png": 48,
        "apple-touch-icon.png": 180,
        "android-chrome-192x192.png": 192,
        "android-chrome-512x512.png": 512,
    }
    
    rendered_images = {}
    for filename, size in sizes.items():
        img = render_logo(size)
        path = os.path.join(OUTPUT_DIR, filename)
        img.save(path, format="PNG", optimize=True)
        rendered_images[size] = img
        print(f" Saved: {path} ({size}x{size})")
        
    # Generate multi-resolution favicon.ico
    ico_path = os.path.join(OUTPUT_DIR, "favicon.ico")
    ico_16 = rendered_images[16]
    ico_32 = rendered_images[32]
    ico_48 = rendered_images[48]
    ico_16.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f" Saved: {ico_path}")

def generate_og_image():
    print("Generating Open Graph Image (og-image.png)...")
    W, H = 1200, 630
    img = Image.new('RGBA', (W, H), DARK_BG)
    
    # 1. Subtle radial gradient glow on right side
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_cx, glow_cy = 880, 315
    for r in range(400, 0, -10):
        alpha = int(45 * (1 - r / 400))
        glow_draw.ellipse([glow_cx - r, glow_cy - r, glow_cx + r, glow_cy + r], fill=(40, 95, 45, alpha))
    glow = glow.filter(ImageFilter.GaussianBlur(30))
    img = Image.alpha_composite(img, glow)
    
    d = ImageDraw.Draw(img)
    
    # 2. Tactical grid
    grid_color = (22, 28, 22, 180)
    for x in range(0, W, 48):
        d.line([(x, 0), (x, H)], fill=grid_color, width=1)
    for y in range(0, H, 48):
        d.line([(y, 0), (W, y)], fill=grid_color, width=1)

    # 3. Fonts
    font_title = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 52)
    font_brand = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 26)
    font_badge = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 15)
    font_desc = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 22)
    font_pill = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 16)
    font_stat_title = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 20)
    font_stat_val = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 24)
    font_stat_sub = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 14)

    # 4. Top Brand Header
    logo_icon = render_logo(44)
    img.paste(logo_icon, (70, 65), logo_icon)
    
    d.text((128, 68), "ROMP GPS", fill=WHITE, font=font_brand)
    
    # Category badge
    badge_text = "TELEMÉTRICA INDUSTRIAL · PROTOCOLO GT06 · RED 4G"
    d.rounded_rectangle([290, 68, 800, 102], radius=6, fill=(24, 34, 24, 255), outline=(50, 75, 50, 255), width=1)
    d.text((310, 75), badge_text, fill=ACCENT_COLOR, font=font_badge)

    # 5. Main Hero Title
    d.text((70, 145), "EL CAMINO DE LA", fill=WHITE, font=font_title)
    d.text((70, 210), "PRECISIÓN TOTAL.", fill=ACCENT_COLOR, font=font_title)

    # 6. Description
    desc_lines = [
        "Rastreo satelital en tiempo real sin latencia, apagado",
        "remoto de motor, sensores inerciales y telemetría avanzada",
        "para flotas de transporte y vehículos de alto valor."
    ]
    cur_y = 295
    for line in desc_lines:
        d.text((70, cur_y), line, fill=MUTED_TEXT, font=font_desc)
        cur_y += 32

    # 7. Value proposition pills
    pills = [
        "⚡ Precisión Quirúrgica 0.5m",
        "🛡️ Protección Anti-Jammer",
        "🔴 Corte de Motor Remoto"
    ]
    pill_x = 70
    pill_y = 425
    for pill in pills:
        bbox = font_pill.getbbox(pill)
        pill_w = (bbox[2] - bbox[0]) + 30
        d.rounded_rectangle([pill_x, pill_y, pill_x + pill_w, pill_y + 38], radius=8, fill=CARD_BG, outline=CARD_BORDER, width=1)
        d.text((pill_x + 15, pill_y + 8), pill, fill=WHITE, font=font_pill)
        pill_x += pill_w + 14

    # 8. Bottom verification and URL bar
    d.line([(70, 520), (620, 520)], fill=(35, 45, 35, 255), width=1)
    d.text((70, 545), "🌐 rompgps.com", fill=ACCENT_COLOR, font=font_brand)
    d.text((310, 552), "·   Disponibilidad Nacional Colombia", fill=MUTED_TEXT, font=font_desc)

    # 9. Device render on the right
    device_path = "FrontEnd/public/models/previews/gps-device.webp"
    if os.path.exists(device_path):
        dev = Image.open(device_path).convert("RGBA")
        # Resize nicely to fit in the right half
        dev = dev.resize((480, 480), Image.Resampling.LANCZOS)
        img.paste(dev, (670, 75), dev)

    # 10. Floating Telemetry Card over device
    card_x, card_y = 820, 410
    card_w, card_h = 320, 160
    d.rounded_rectangle([card_x, card_y, card_x + card_w, card_y + card_h], radius=14, fill=CARD_BG, outline=ACCENT_COLOR, width=2)
    
    # Pulse dot + status
    d.ellipse([card_x + 20, card_y + 22, card_x + 32, card_y + 34], fill=(34, 197, 94, 255))
    d.text((card_x + 42, card_y + 17), "SISTEMA EN LÍNEA · ACTIVO", fill=WHITE, font=font_stat_title)
    d.line([(card_x + 18, card_y + 48), (card_x + card_w - 18, card_y + 48)], fill=CARD_BORDER, width=1)
    
    # Stats inside card
    d.text((card_x + 22, card_y + 60), "VELOCIDAD", fill=MUTED_TEXT, font=font_stat_sub)
    d.text((card_x + 22, card_y + 80), "58.4 km/h", fill=ACCENT_COLOR, font=font_stat_val)
    
    d.text((card_x + 175, card_y + 60), "SEÑAL SATÉLITE", fill=MUTED_TEXT, font=font_stat_sub)
    d.text((card_x + 175, card_y + 80), "99.8% 4G", fill=WHITE, font=font_stat_val)
    
    d.text((card_x + 22, card_y + 122), "LAT: 10.4285° N  ·  LNG: 75.5512° O", fill=MUTED_TEXT, font=font_stat_sub)

    # Save og-image.png
    og_path = os.path.join(OUTPUT_DIR, "og-image.png")
    img.save(og_path, format="PNG", optimize=True)
    print(f" Saved: {og_path} ({W}x{H})")

if __name__ == "__main__":
    generate_icons()
    generate_og_image()
    print("All SEO images generated successfully!")
