#!/usr/bin/env python3
"""Generate an original self-promotional motion background for OFUQ TV.
The advertisement title/branding are overlaid as readable HTML, not burned into footage.
"""
from PIL import Image, ImageDraw
from pathlib import Path
import math, random, subprocess

root = Path(__file__).resolve().parents[1]
out = root / "ofuq-tv" / "ads"
out.mkdir(parents=True, exist_ok=True)
tmp = out / ".render"
tmp.mkdir(exist_ok=True)
w,h=960,540
img=Image.new("RGB",(w,h))
pix=img.load()
for y in range(h):
    for x in range(w):
        glow=math.exp(-((x-490)**2/(410**2)+(y-230)**2/(270**2))*1.7)
        pix[x,y]=(int(4+12*glow),int(16+49*glow),int(30+68*glow))
d=ImageDraw.Draw(img,"RGBA")
for x in range(0,w,54): d.line((x,0,x,h),fill=(73,184,199,17),width=1)
for y in range(0,h,54): d.line((0,y,w,y),fill=(73,184,199,16),width=1)
rng=random.Random(20261030)
for _ in range(180):
    x=rng.randrange(w);y=rng.randrange(h)
    a=rng.randrange(25,105)
    d.ellipse((x,y,x+2,y+2),fill=(170,235,245,a))
for k in range(6):
    pad=60+k*55
    d.arc((-pad,-pad,w+pad,h+pad),start=215,end=325,fill=(82,190,207,max(13,70-k*8)),width=2)
img.save(tmp/"background.png")

s=430
globe=Image.new("RGBA",(s,s),(0,0,0,0))
g=ImageDraw.Draw(globe,"RGBA")
margin=26
g.ellipse((margin,margin,s-margin,s-margin),fill=(7,45,67,205),outline=(95,216,233,210),width=4)
for t in (0.3,0.54,0.75):
    a=int((s-2*margin)*t)
    left=(s-a)/2
    g.ellipse((left,margin,s-left,s-margin),outline=(114,222,232,113),width=3)
for f in (0.22,0.36,0.5,0.64,0.78):
    y0=int(s*f)
    half=int(((s/2-margin)**2-(y0-s/2)**2)**0.5) if abs(y0-s/2)<s/2-margin else 0
    g.ellipse((s/2-half,y0-18,s/2+half,y0+18),outline=(102,214,230,102),width=2)
for i in range(4):
    pad=10+i*7
    g.arc((pad,pad,s-pad,s-pad),start=220,end=333,fill=(127,244,242,160-i*22),width=2)
globe.save(tmp/"globe.png")

dest=out/"ofuq-promo.mp4"
vf="[1:v]format=rgba,rotate=a='0.075*t':ow=550:oh=550:c=none[orb];[0:v][orb]overlay=x='(W-w)/2+90*sin(t/4)':y='(H-h)/2':shortest=1:format=auto,format=yuv420p[v]"
command=["ffmpeg","-hide_banner","-loglevel","error","-y",
 "-loop","1","-framerate","20","-i",str(tmp/"background.png"),
 "-loop","1","-framerate","20","-i",str(tmp/"globe.png"),
 "-filter_complex",vf,"-map","[v]","-t","12","-r","20",
 "-c:v","libx264","-pix_fmt","yuv420p","-preset","veryfast",
 "-crf","25","-movflags","+faststart","-an",str(dest)]
subprocess.run(command,check=True,timeout=180)
if dest.stat().st_size<10000: raise RuntimeError("Video is unexpectedly small")
subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1",str(dest)],check=True)
print(f"Created original OFUQ motion-ad video: {dest.stat().st_size:,} bytes.")
