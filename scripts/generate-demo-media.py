"""Reproducible illustrative animations and synthesized audio, not field recordings."""
from PIL import Image, ImageDraw
import numpy as np
import math, subprocess, wave
from pathlib import Path
out=Path('public/demo');out.mkdir(parents=True,exist_ok=True)
w,h=640,360;fps=16;duration=10
for thermal in [False,True]:
 name='thermal' if thermal else 'camera'
 pipe=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{w}x{h}','-framerate',str(fps),'-i','-','-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',str(out/f'{name}.mp4')],stdin=subprocess.PIPE)
 for f in range(fps*duration):
  t=f/fps;im=Image.new('RGB',(w,h),(13,21,39) if thermal else (19,39,31));d=ImageDraw.Draw(im)
  d.rectangle((0,195,w,h),fill=(20,27,63) if thermal else (34,49,29))
  for j,x in enumerate([20,85,145,220,320,405,485,560,625]):
   top=40+(j*19)%65;d.rectangle((x-5,top+30,x+5,260),fill=(27,30,79) if thermal else (56,57,38));d.polygon([(x,top),(x-48,top+135),(x+48,top+135)],fill=(31,42,99) if thermal else (28,67+(j%3)*9,46))
  d.polygon([(205,360),(370,180),(410,180),(390,360)],fill=(32,35,75) if thermal else (82,76,52))
  x=int(130+t*20);y=229;body=(255,170,32) if thermal else (151,186,194)
  d.ellipse((x-8,y-42,x+8,y-26),fill=body);d.line((x,y-25,x,y+8),fill=body,width=13);step=int(8*math.sin(t*7));d.line((x,y+5,x-10-step,y+37),fill=body,width=6);d.line((x,y+5,x+10+step,y+37),fill=body,width=6);d.line((x-17,y-10,x+17,y-6),fill=body,width=5)
  d.rectangle((x-28,y-53,x+28,y+43),outline=(151,225,108),width=2);d.text((x-28,y-67),'PERSON - SIMULATED',fill=(190,237,159))
  if t>=4:
   for j in range(7):
    xx=490+j*7;yy=250+int(6*math.sin(t*8+j));d.polygon([(xx-9,283),(xx,yy-25),(xx+12,283)],fill=(255,65+22*j,15))
   d.rectangle((474,210,552,288),outline=(255,147,65),width=2);d.text((430,195),'FIRE - SIMULATED',fill=(255,183,92))
  d.rectangle((0,0,w,30),fill=(9,15,18));d.text((15,10),f'VANDOOT | {name.upper()} DEMO | ANIMATION - NOT LIVE',fill=(204,224,210));d.text((15,337),f'ILLUSTRATIVE OVERLAYS / NO AI INFERENCE     {t:04.1f}s',fill=(200,211,207))
  if thermal:d.text((425,310),'ILLUSTRATIVE COLORS / NOT TEMPERATURES',fill=(200,211,207))
  if f==fps*6:im.save(out/f'{name}-poster.jpg')
  pipe.stdin.write(im.tobytes())
 pipe.stdin.close();assert pipe.wait()==0
rate=22050;rng=np.random.default_rng(17);t=np.arange(rate*8)/rate
for name in ['forest','motor','chopping']:
 if name=='forest':
  x=.03*rng.normal(size=len(t))
  for start in [0.5,1.7,3,4.6,6.4]:
   z=t-start;env=np.exp(-((z-.16)/.1)**2);x+=.18*env*np.sin(2*np.pi*(2200*z+900*z*z))
 elif name=='motor':x=.22*(np.sin(2*np.pi*95*t)+.3*np.sin(2*np.pi*190*t))*(.7+.3*np.sin(2*np.pi*2*t))+.06*rng.normal(size=len(t))
 else:
  x=np.zeros(len(t))
  for start in [0.6,1.8,3,4.2,5.4,6.6]:
   z=np.maximum(t-start,0);env=np.where(t>=start,np.exp(-z*35),0);x+=env*(.5*rng.normal(size=len(t))+.3*np.sin(2*np.pi*140*z))
 x=np.clip(x,-.8,.8)
 with wave.open(str(out/f'{name}.wav'),'wb') as wf:wf.setnchannels(1);wf.setsampwidth(2);wf.setframerate(rate);wf.writeframes((x*32767).astype('<i2').tobytes())
print('Created two 10-second animations and three 8-second synthesized audio clips.')
