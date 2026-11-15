"""Makes all icon and splash images. Run: python3 scripts/generate-icons.py"""
import os, math
from PIL import Image, ImageDraw
BG1, BG2, AMB = (15,42,51), (23,60,71), (255,184,77)
OV = "android-overlay/res"
S = 2048  # supersample canvas

def reel(size, scale=1.0):
    im = Image.new("RGBA", (S, S), (0,0,0,0)); d = ImageDraw.Draw(im); c = S/2
    r = S*0.27*scale
    d.ellipse([c-r, c-r, c+r, c+r], fill=AMB)
    for i in range(5):
        a = math.radians(-90 + i*72); hx, hy, hr = c+math.cos(a)*r*0.56, c+math.sin(a)*r*0.56, r*0.2
        d.ellipse([hx-hr, hy-hr, hx+hr, hy+hr], fill=BG1+(255,))
    hr = r*0.14; d.ellipse([c-hr, c-hr, c+hr, c+hr], fill=BG1+(255,))
    return im.resize((size, size), Image.LANCZOS)

def gradient(size):
    im = Image.new("RGB", (size, size)); px = im.load()
    for y in range(size):
        for x in range(size):
            t = (x+y)/(2*size); px[x,y] = tuple(int(BG2[i]*(1-t)+BG1[i]*t) for i in range(3))
    return im.convert("RGBA")

def save(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True); im.save(path)

legacy = {"mdpi":48,"hdpi":72,"xhdpi":96,"xxhdpi":144,"xxxhdpi":192}
fg = {"mdpi":108,"hdpi":162,"xhdpi":216,"xxhdpi":324,"xxxhdpi":432}
for k,v in legacy.items():
    g = gradient(v); m = Image.new("L",(v,v),0); ImageDraw.Draw(m).rounded_rectangle([0,0,v-1,v-1], radius=int(v*0.22), fill=255)
    sq = Image.new("RGBA",(v,v),(0,0,0,0)); sq.paste(g,(0,0),m); sq.alpha_composite(reel(v,1.25))
    save(sq, f"{OV}/mipmap-{k}/ic_launcher.png")
    m2 = Image.new("L",(v,v),0); ImageDraw.Draw(m2).ellipse([0,0,v-1,v-1], fill=255)
    rd = Image.new("RGBA",(v,v),(0,0,0,0)); rd.paste(g,(0,0),m2); rd.alpha_composite(reel(v,1.2))
    save(rd, f"{OV}/mipmap-{k}/ic_launcher_round.png")
for k,v in fg.items():
    save(reel(v,1.0), f"{OV}/mipmap-{k}/ic_launcher_foreground.png")
save(reel(512,1.6), f"{OV}/drawable-nodpi/splash_logo.png")
big = gradient(1024); big.alpha_composite(reel(1024,1.6)); save(big, "assets/icon-1024.png")
print("ok")
