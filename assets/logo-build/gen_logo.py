import numpy as np
from PIL import Image, ImageDraw, ImageFont

S = 1024
FONT = "src/fonts/GenWanMin2TC-M.otf"
CHAR = "聲"
C1 = np.array([79, 157, 255])   # 亮藍 #4F9DFF
C2 = np.array([109, 92, 246])   # 靛紫 #6D5CF6

# 對角漸層
yy, xx = np.mgrid[0:S, 0:S].astype(float)
t = (xx + yy) / (2 * (S - 1))
grad = (C1[None, None, :] * (1 - t[..., None]) + C2[None, None, :] * t[..., None]).astype("uint8")
img = Image.fromarray(grad, "RGB").convert("RGBA")

# 圓角遮罩（iOS squircle 風）
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=232, fill=255)
img.putalpha(mask)

# 疊「聲」字（白、置中）
draw = ImageDraw.Draw(img)
font = ImageFont.truetype(FONT, 680)
bbox = draw.textbbox((0, 0), CHAR, font=font)
w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
x = (S - w) / 2 - bbox[0]
y = (S - h) / 2 - bbox[1]
# 輕微陰影增加層次
draw.text((x + 6, y + 8), CHAR, font=font, fill=(40, 50, 120, 70))
draw.text((x, y), CHAR, font=font, fill=(255, 255, 255, 255))

img.save("assets/logo-build/icon-1024.png")
# 預覽用：貼到白底看實際效果
prev = Image.new("RGB", (S, S), (245, 245, 248))
prev.paste(img, (0, 0), img)
prev.save("assets/logo-build/preview.png")
print("done")
