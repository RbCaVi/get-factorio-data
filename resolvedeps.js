
version is an upper and lower bound
inclusive or exclusive
either can be omitted for no limit
resolve picks the newest version
using a mods query

let initialVersions=new Map();

for(let [mod,moddata] of Object.entries(pack.mods)){
  let version;
  if(moddata.version){
    version=versionConstraint('____ = '+moddata.version,mod,'__initial__');
  }else{
    version=anyVersion(mod,'__initial__');
  }
  initialVersions.set(mod,version);
}



let newVersions=initialVersions;
let resolvedVersions=new Map();

while(newVersions.size>0){
  let newUnresolvedVersions=new Map();
  for(let [mod,version] of newVersions){
    resolvedVersions.set(mod,version.resolve());
    for(let [depmod,depversion] of Object.entries(resolvedVersions.get(mod).deps)){
      if(!newUnresolvedVersions.has(depmod)){
        newUnresolvedVersions.set(depmod,anyVersion(depmod,mod));
      }
      newUnresolvedVersions.get(depmod).intersect(versionConstraint(depversion,depmod,mod));
    }
  }
  newVersions=newUnresolvedVersions;
}

function versionConstraint(version,mod,source) {
  // version is a string

  let parts=version.split(' ');
  let optional=false;
  switch(parts[0]){
  case '!':
    return incompatible(mod,[source]);
  case '?':
  case '(?)':
    optional=true;
  case '~':
    parts=parts.slice(1);
  default:
  }
  return constraint(mod,[source],parts[2],parts[3],optional);
}

function incompatible(mod,sources){
  return new VersionConstraint(mod,sources,null,null,null,null,null,true);
}

function anyVersion(mod,sources){
  return new VersionConstraint(mod,sources,null,null,null,null,true,false);
}

function constraint(mod,sources,ineq,version,optional){
  let bottom=null;
  let top=null;
  let bottomExc=null;
  let topExc=null;
  if(ineq.contains('<')){
    top=version;
    topExc=!ineq.contains('=');
  }else if(ineq.contains('>')){
    bottom=version;
    bottomExc=!ineq.contains('=');
  }else{
    top=version;
    topExc=false;
    bottom=version;
    bottomExc=false;
  }

  return new VersionConstraint(mod,sources,bottom,top,bottomExc,topExc,optional,false);
}

class VersionConstraint{
  constructor(mod,sources,bottomVersion,topVersion,bottomExclude,topExclude,optional,incompatible){
    this.mod=mod;
    this.sources=sources;
    this.bottomVersion=bottomVersion;
    this.topVersion=topVersion;
    this.bottomExclude=bottomExclude;
    this.topExclude=topExclude;
    this.optional=optional;
    this.incompatible=incompatible;
  }

  // intersect in place
  intersect(that){
    if(this.mod!=that.mod){
      throw new Error(`mod ${this.mod} not equal to ${that.mod}`)
    }
    if(this.incompatible&&that.incompatible){
      return;
    }
    if(this.incompatible&&!that.incompatible){
      throw new Error(`mod ${this.mod} from ${this.sources} incompatible with ${that.sources}`)
    }
    if((!this.incompatible)&&that.incompatible){
      throw new Error(`mod ${that.mod} from ${that.sources} incompatible with ${this.sources}`)
    }
    [this.bottomVersion,this.bottomExclude]=maxv([this.bottomVersion,this.bottomExclude],[that.bottomVersion,that.bottomExclude]);
    [this.topVersion,this.topExclude]=minv([this.topVersion,this.topExclude],[that.topVersion,that.topExclude]);
    this.optional&&=that.optional;
  }

  includes(version){
    if(cmpv(top,version)>0||cmpv(bottom,version)<0){ // outside the range
      return false;
    }
    if(cmpv(top,version)==0){ // equal to top
      return !this.topExclude;
    }
    if(cmpv(bottom,version)==0){ // equal to bottom
      return !this.bottomExclude;
    }
    return true; // inside the range
  }

  resolve()
}

// cmpv=v2-v1

function cmpv(v1,v2) {
  let v1s=v1.split('.').map(x=>+x);
  let v2s=v2.split('.').map(x=>+x);
  for(let i=0;;i++){
    if(i>min(v1s.length,v2s.length)){
      return v2s.length-v1s.length;
    }
    if(v1s[i]>v2s[i]){
      return -1;
    }else if(v1s[i]>v2s[i]){
      return 1;
    }
  }
}

function minv([v1,exc1],[v2,exc2]) {
  if(v1==null){
    return [v2,exc2];
  }
  if(v2==null){
    return [v1,exc1];
  }
  let cmp=cmpv(v1,v2);
  if(cmp>0){
    return [v1,exc1];
  }else if(cmp<0){
    return [v2,exc2];
  }else{
    return [v1,exc1||exc2];
  }
}

function maxv([v1,exc1],[v2,exc2]) {
  if(v1==null){
    return [v2,exc2];
  }
  if(v2==null){
    return [v1,exc1];
  }
  let cmp=cmpv(v1,v2);
  if(cmp<0){
    return [v1,exc1];
  }else if(cmp>0){
    return [v2,exc2];
  }else{
    return [v1,exc1||exc2];
  }
}