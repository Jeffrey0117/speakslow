import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
C1 = np.array([74, 222, 128])   # 亮綠
C2 = np.array([5, 150, 105])    # 翡翠深綠

# 對角漸層底
yy, xx = np.mgrid[0:H, 0:W].astype(float)
t = (xx / W * 0.6 + yy / H * 0.4)
grad = (C1[None, None, :] * (1 - t[..., None]) + C2[None, None, :] * t[..., None]).astype("uint8")
img = Image.fromarray(grad, "RGB").convert("RGBA")

# 右側超大「聲」浮水印（低調）
wm_font = ImageFont.truetype("src/fonts/GenWanMin2TC-M.otf", 620)
wm = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(wm).text((W - 540, -40), "聲", font=wm_font, fill=(255, 255, 255, 26))
img = Image.alpha_composite(img, wm)

d = ImageDraw.Draw(img)
gen = lambda s: ImageFont.truetype("src/fonts/GenWanMin2TC-M.otf", s)
hun = lambda s: ImageFont.truetype("src/fonts/jf-openhuninn-2.1.ttf", s)

X = 80
# 品牌
d.text((X, 78), "聲聲慢", font=gen(96), fill=(255, 255, 255, 255))
d.text((X + 360, 128), "SpeakSlow", font=hun(40), fill=(255, 255, 255, 200))

# 主標語（兩行）
d.text((X, 246), "專為中文打造", font=hun(72), fill=(255, 255, 255, 255))
d.text((X, 344), "最快的本地語音輸入", font=hun(72), fill=(255, 255, 255, 255))

# 特色膠囊列
chips = ["免費開源", "100% 本機", "講完 0.2 秒出字", "不上雲"]
cx = X
cy = 488
cf = hun(30)
# 半透明膠囊要畫在獨立圖層再合成（ImageDraw 直畫 RGBA 不會混色）
layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ld = ImageDraw.Draw(layer)
for c in chips:
    tw = ld.textlength(c, font=cf)
    ld.rounded_rectangle([cx, cy, cx + tw + 44, cy + 56], radius=28,
                         fill=(255, 255, 255, 38), outline=(255, 255, 255, 110), width=2)
    ld.text((cx + 22, cy + 9), c, font=cf, fill=(255, 255, 255, 255))
    cx += tw + 44 + 16
img = Image.alpha_composite(img, layer)

img.convert("RGB").save("web/public/og-card.png", optimize=True)
print("og-card 1200x630 done")
