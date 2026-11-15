import sys, json, struct, numpy as np
sys.path.insert(0,'/tmp'); from stl import read_stl
G=json.load(open('/tmp/groups.json'))
TARGET={'skin':90000,'brain':26000,'heart':12000,'lungs':16000,'eyes':2500,'blood':14000,'bones':60000}
H=1656.0; S=3.6/H
def to_three(P):  # mm, Z-up, face -Y  ->  three.js units, Y-up, face +Z, feet at y=-1.65
    out=np.empty_like(P); out[:,0]=P[:,0]*S; out[:,1]=(P[:,2]+14)*S-1.65; out[:,2]=-(P[:,1]+96)*S; return out
def cluster(T, cell):
    P=T.reshape(-1,3).astype(np.float64)
    fn=np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]).astype(np.float64)       # area-weighted face normals
    N=np.repeat(fn,3,axis=0)
    key=np.floor(P/cell).astype(np.int64)
    uk,inv=np.unique(key,axis=0,return_inverse=True); inv=inv.ravel()
    sums=np.zeros((len(uk),3)); np.add.at(sums,inv,P); cnt=np.bincount(inv,minlength=len(uk))[:,None]
    nsum=np.zeros((len(uk),3)); np.add.at(nsum,inv,N)
    V=sums/cnt; VN=nsum/(np.linalg.norm(nsum,axis=1,keepdims=True)+1e-12); F=inv.reshape(-1,3)
    ok=(F[:,0]!=F[:,1])&(F[:,1]!=F[:,2])&(F[:,0]!=F[:,2]); F=F[ok]
    Fs=np.sort(F,axis=1); _,keep=np.unique(Fs,axis=0,return_index=True); F=F[np.sort(keep)]
    # drop folded triangles: face normal must agree with the original surface normal
    a,b,c=V[F[:,0]],V[F[:,1]],V[F[:,2]]; n=np.cross(b-a,c-a); n/= (np.linalg.norm(n,axis=1,keepdims=True)+1e-12)
    ref=VN[F[:,0]]+VN[F[:,1]]+VN[F[:,2]]; ref/=(np.linalg.norm(ref,axis=1,keepdims=True)+1e-12)
    F=F[(n*ref).sum(1)>0.15]
    used=np.unique(F); remap=-np.ones(len(V),np.int64); remap[used]=np.arange(len(used))
    global LAST_N; LAST_N=VN[used].astype(np.float32)
    return V[used].astype(np.float32), remap[F].astype(np.uint32)
def decimate(T,target):
    lo,hi=0.2,40.0
    best=None
    for _ in range(22):
        mid=(lo*hi)**0.5; V,F=cluster(T,mid)
        if len(F)>target: lo=mid
        else: hi=mid; best=(V,F,LAST_N.copy())
        if best and abs(len(best[1])-target)/target<0.08: break
    if best is None: V,F=cluster(T,hi); best=(V,F,LAST_N.copy())
    return best
import scipy.sparse as sp
def taubin(V,F,it=10,lam=0.5,mu=-0.53):
    n=len(V); i=np.concatenate([F[:,0],F[:,1],F[:,2],F[:,1],F[:,2],F[:,0]]); j=np.concatenate([F[:,1],F[:,2],F[:,0],F[:,0],F[:,1],F[:,2]])
    A=sp.coo_matrix((np.ones(len(i)),(i,j)),shape=(n,n)).tocsr(); A.data[:]=1
    deg=np.asarray(A.sum(1)).ravel(); deg[deg==0]=1; Dinv=sp.diags(1/deg); L=Dinv@A
    V=V.astype(np.float64)
    for _ in range(it):
        V=V+lam*(L@V-V); V=V+mu*(L@V-V)
    return V.astype(np.float32)
SMOOTH={'skin':14,'brain':6,'heart':6,'lungs':8,'eyes':4,'blood':6,'bones':4}
from scipy.sparse.csgraph import connected_components
def outer_shell(T):
    P=T.reshape(-1,3); q=np.round(P*100).astype(np.int64)
    uk,inv=np.unique(q,axis=0,return_inverse=True); inv=inv.ravel(); F=inv.reshape(-1,3)
    n=len(uk); i=np.concatenate([F[:,0],F[:,1]]); j=np.concatenate([F[:,1],F[:,2]])
    A=sp.coo_matrix((np.ones(len(i)),(i,j)),shape=(n,n))
    nc,lab=connected_components(A,directed=False)
    flab=lab[F[:,0]]
    # pick the component with the largest bounding-box volume (the outermost surface)
    best=None;bv=-1
    for c in np.unique(flab):
        m=flab==c
        if m.sum()<1000: continue
        Q=T[m].reshape(-1,3); v=np.prod(Q.max(0)-Q.min(0))
        if v>bv: bv=v;best=m
    print(f'  skin components={nc}, kept {best.sum()} of {len(T)} tris', flush=True)
    return T[best]
meshes=[]
for g,ids in G.items():
    T=np.concatenate([read_stl(f'{i}.stl') for i in ids])
    if g=='skin': T=outer_shell(T)
    V,F,VN=decimate(T,TARGET[g]); V=taubin(V,F,SMOOTH[g]); V=to_three(V)
    VN=np.stack([VN[:,0],VN[:,2],-VN[:,1]],1).astype(np.float32)
    meshes.append((g,V,F,VN)); print(f'{g:6s} {len(T):8d} -> {len(F):6d} tris, {len(V):6d} verts', flush=True)
# ---- GLB writer ----
bin=bytearray(); views=[]; accs=[]; gmeshes=[]; nodes=[]
def add_view(b, target):
    while len(bin)%4: bin.append(0)
    off=len(bin); bin.extend(b); views.append({'buffer':0,'byteOffset':off,'byteLength':len(b),'target':target}); return len(views)-1
for g,V,F,VN in meshes:
    vi=add_view(V.astype('<f4').tobytes(),34962)
    accs.append({'bufferView':vi,'componentType':5126,'count':len(V),'type':'VEC3','min':V.min(0).tolist(),'max':V.max(0).tolist()})
    pa=len(accs)-1
    ni=add_view(VN.astype('<f4').tobytes(),34962); accs.append({'bufferView':ni,'componentType':5126,'count':len(VN),'type':'VEC3'}); na=len(accs)-1
    if len(V)<65536: ib=F.astype('<u2').tobytes(); ct=5123
    else: ib=F.astype('<u4').tobytes(); ct=5125
    ii=add_view(ib,34963); accs.append({'bufferView':ii,'componentType':ct,'count':int(F.size),'type':'SCALAR'}); ia=len(accs)-1
    gmeshes.append({'name':g,'primitives':[{'attributes':{'POSITION':pa,'NORMAL':na},'indices':ia,'mode':4}]})
    nodes.append({'name':g,'mesh':len(gmeshes)-1})
while len(bin)%4: bin.append(0)
gltf={'asset':{'version':'2.0','generator':'HALO build_glb.py','copyright':'BodyParts3D, (c) 2008 Life Science Integrated Database Center (DBCLS), CC BY-SA 2.1 Japan. Simplified for web by the HALO team.'},
 'scene':0,'scenes':[{'nodes':list(range(len(nodes)))}],'nodes':nodes,'meshes':gmeshes,'accessors':accs,'bufferViews':views,'buffers':[{'byteLength':len(bin)}]}
js=json.dumps(gltf,separators=(',',':')).encode(); 
while len(js)%4: js+=b' '
out=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(bin))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(bin),0x004E4942)+bytes(bin)
open('/tmp/claude-0/-home-claude/5aa2d039-953f-5422-86c4-fdb662fd63d6/scratchpad/human.glb','wb').write(out)
print('GLB bytes', len(out))
