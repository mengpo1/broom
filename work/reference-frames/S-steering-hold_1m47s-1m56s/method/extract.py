import subprocess, sys, numpy as np
V=sys.argv[1]; out=sys.argv[2]
X0,Y0,W,H=180,284,190,76          # wheel, hands and forearms
cmd=['ffmpeg','-v','error','-i',V,'-vf',f'crop={W}:{H}:{X0}:{Y0}','-r','25','-fps_mode','cfr','-f','rawvideo','-pix_fmt','rgb24','-']
p=subprocess.Popen(cmd,stdout=subprocess.PIPE)
frames=[]
while True:
    raw=p.stdout.read(W*H*3)
    if len(raw)<W*H*3: break
    frames.append(np.frombuffer(raw,dtype=np.uint8).reshape(H,W,3))
p.wait()
a=np.stack(frames); print(a.shape)
np.save(out,a)
