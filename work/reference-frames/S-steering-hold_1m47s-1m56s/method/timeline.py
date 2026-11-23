import numpy as np, json, sys
S=sys.argv[1]
lab=np.load(S+'/label2.npy')
MAP={1:0,7:0,0:1,2:2,5:3,3:-1,4:-2,6:-3,9:-3}
lev=np.array([MAP.get(int(k),99) for k in lab])
# dark or unclassified frames: keep the previous level
for i in range(len(lev)):
    if lev[i]==99: lev[i]=lev[i-1] if i else 0
# single-frame flickers of the classification: median of three
f=lev.copy()
for i in range(1,len(lev)-1):
    s=sorted((lev[i-1],lev[i],lev[i+1])); f[i]=s[1]
lev=f
np.save(S+'/level.npy',lev)
FPS=25
print('frames by level:', {int(k):int((lev==k).sum()) for k in range(-3,4)})
# runs
runs=[]; start=0
for i in range(1,len(lev)+1):
    if i==len(lev) or lev[i]!=lev[start]:
        runs.append((start,i-start,int(lev[start]))); start=i
print('runs', len(runs))
# transitions
from collections import Counter
tr=Counter((runs[i][2],runs[i+1][2]) for i in range(len(runs)-1))
print('transitions between different levels:'); 
for (a,b),c in sorted(tr.items()): print(f'  {a:+d} -> {b:+d}: {c}', '' if abs(a-b)==1 else '   <-- not neighbours')
# episodes: maximal stretches away from the centre on one side
eps=[]; i=0
while i<len(runs):
    if runs[i][2]==0: i+=1; continue
    sign=1 if runs[i][2]>0 else -1; j=i
    while j<len(runs) and runs[j][2]*sign>0: j+=1
    seq=runs[i:j]
    t0=seq[0][0]; peak=max(abs(r[2]) for r in seq)
    first={}
    for r in seq:
        a=abs(r[2])
        if a not in first: first[a]=r[0]
    ep={'start':t0,'t':round(t0/FPS,2),'side':'right' if sign>0 else 'left','peak':peak,'seconds':round((seq[-1][0]+seq[-1][1]-t0)/FPS,2),
        'levels':[(abs(r[2]),round(r[1]/FPS,2)) for r in seq]}
    if 2 in first: ep['toLevel2']=round((first[2]-t0)/FPS,2)
    if 3 in first:
        ep['toLevel3']=round((first[3]-t0)/FPS,2)
        # time spent at level 2 just before the first level 3
        k=[n for n,r in enumerate(seq) if r[0]==first[3]][0]
        ep['atLevel2Before3']=round(seq[k-1][1]/FPS,2) if k>0 and abs(seq[k-1][2])==2 else 0
        ep['atLevel3']=round(sum(r[1] for r in seq if abs(r[2])==3)/FPS,2)
    eps.append(ep); i=j
print('episodes', len(eps), 'by peak:', Counter(e['peak'] for e in eps))
def stats(v): 
    v=sorted(v); return f'n={len(v)} min {v[0]} median {v[len(v)//2]} max {v[-1]}' if v else 'none'
print('time from the first movement to level 2:', stats([e['toLevel2'] for e in eps if 'toLevel2' in e]))
print('time from the first movement to level 3:', stats([e['toLevel3'] for e in eps if 'toLevel3' in e]))
print('time spent at level 2 just before level 3:', stats([e['atLevel2Before3'] for e in eps if 'toLevel3' in e]))
print('time spent at level 3:', stats([e['atLevel3'] for e in eps if 'toLevel3' in e]))
# how long does level 2 last when it does NOT lead to level 3
l2=[r[1]/FPS for n,r in enumerate(runs) if abs(r[2])==2 and not (n+1<len(runs) and abs(runs[n+1][2])==3)]
print('stays at level 2 that end by going back:', stats([round(x,2) for x in l2]))
l1=[r[1]/FPS for n,r in enumerate(runs) if abs(r[2])==1 and n+1<len(runs) and abs(runs[n+1][2])==2 and (n==0 or runs[n-1][2]==0)]
print('stays at level 1 on the way up to level 2:', stats([round(x,2) for x in l1]))
l1b=[r[1]/FPS for n,r in enumerate(runs) if abs(r[2])==1 and n+1<len(runs) and runs[n+1][2]==0 and n>0 and runs[n-1][2]==0]
print('stays at level 1 alone (centre before and after):', stats([round(x,2) for x in l1b]))
# way back from level 3
back=[]
for e in eps:
    if e['peak']==3:
        lv=e['levels']; k=max(n for n,(a,d) in enumerate(lv) if a==3)
        back.append((round(sum(d for a,d in lv[k+1:]),2), [a for a,d in lv[k+1:]]))
print('way back from level 3 to the centre (seconds, levels):', back)
json.dump({'fps':FPS,'episodes':eps,'runs':[list(map(int,r)) for r in runs]},open(S+'/timeline.json','w'))
for e in eps:
    if e['peak']==3: print(e['t'], e['side'], e['seconds'], e['levels'])
