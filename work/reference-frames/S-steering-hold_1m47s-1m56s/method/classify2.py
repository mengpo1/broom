import numpy as np, sys
from PIL import Image, ImageDraw
S=sys.argv[1]
a=np.load(S+'/wheel.npy')            # n, 76, 190, 3
n=len(a); H,W=a.shape[1:3]
label0=np.load(S+'/label.npy')
centre=np.isin(label0,[22,1])
g=a.astype(np.float32).mean(axis=3)
std=g[centre].std(axis=0)
cockpit=std<14                        # pixels that never change while the wheel is centred: the cockpit drawing, not the road
# the speed read-out and the rev lights change: leave them out
cockpit[38:62,96:140]=False
Image.fromarray((cockpit*255).astype(np.uint8)).resize((W*3,H*3),Image.NEAREST).save(S+'/mask.png')
print('cockpit pixels', int(cockpit.sum()), 'of', H*W)
light=(a.min(axis=3)>185)&cockpit[None]
gh,gw=4,5
hh,ww=H//gh*gh,W//gw*gw
feat=light[:, :hh, :ww].reshape(n,hh//gh,gh,ww//gw,gw).mean(axis=(2,4)).reshape(n,-1).astype(np.float32)
# frames where the picture is dark (fades) are set aside
dark=g.mean(axis=(1,2))<60
protos=[]; counts=[]; label=np.full(n,-1,dtype=np.int32)
TH=float(sys.argv[2]) if len(sys.argv)>2 else 14.0
for i in range(n):
    if dark[i]: continue
    f=feat[i]; best=-1; bd=1e9
    for k,p in enumerate(protos):
        d=np.abs(p-f).sum()
        if d<bd: bd=d; best=k
    if best<0 or bd>TH:
        protos.append(f.copy()); counts.append(1); label[i]=len(protos)-1
    else:
        label[i]=best; counts[best]+=1
        protos[best]=protos[best]*0.98+f*0.02
print('clusters', len(protos), 'dark frames', int(dark.sum()))
order=np.argsort(counts)[::-1]
np.save(S+'/label2.npy',label); np.save(S+'/feat2.npy',feat)
big=[k for k in order if counts[k]>=10]
print('clusters with at least 10 frames:', len(big), 'covering', sum(counts[k] for k in big), 'of', n-int(dark.sum()))
cols=6; rows=(len(big)+cols-1)//cols
sheet=Image.new('RGB',(cols*390,rows*185),(0,0,0)); d=ImageDraw.Draw(sheet)
for t,k in enumerate(big):
    idx=np.nonzero(label==k)[0]
    dd=np.abs(feat[idx]-protos[k]).sum(axis=1)
    j=idx[np.argmin(dd)]
    im=Image.fromarray(a[j]).resize((380,152),Image.NEAREST)
    x,y=(t%cols)*390,(t//cols)*185
    sheet.paste(im,(x+5,y+28)); d.text((x+8,y+8),f'{k}: {counts[k]} frames, frame {j} ({j/25:.2f} s)',fill=(255,255,0))
sheet.save(S+'/clusters2.png'); print(sheet.size)
for k in big: print(k, counts[k])
