import * as path from 'node:path'

import {downloadjson} from './downloadjson.mjs'

function versionConstraint(version,mod,source) {
  // version is a string

  let parts=version.split(' ');
  let optional=false;
  switch(parts[0]){
  case '!':
    return incompatible(mod??parts[1],[source]);
  case '?':
  case '(?)':
    optional=true;
  case '~':
    parts=parts.slice(1);
  default:
  }
  return constraint(mod??parts[0],[source],parts[1],parts[2],optional);
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
  if(ineq.includes('<')){
    top=version;
    topExc=!ineq.includes('=');
  }else if(ineq.includes('>')){
    bottom=version;
    bottomExc=!ineq.includes('=');
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
    this.sources=this.sources.concat(that.sources);
  }

  includes(version){
    if(!version){
      return false;
    }
    if(this.incompatible){
      return false;
    }

    if((this.top!=null&&cmpv(this.top,version)>0)||(this.bottom!=null&&cmpv(this.bottom,version)<0)){ // outside the range
      return false;
    }
    if((this.top!=null&&cmpv(this.top,version)==0)){ // equal to top
      return !this.topExclude;
    }
    if((this.bottom!=null&&cmpv(this.bottom,version)==0)){ // equal to bottom
      return !this.bottomExclude;
    }
    return true; // inside the range
  }

  resolve(){
    let url;
    if(this.mod=='core'||this.mod=='base'||this.mod=='core+base'){
      url='https://api.github.com/repos/wube/factorio-data/git/refs/tags';
    }else{
      url=`https://mods.factorio.com/api/mods/${this.mod}/full`;
    }
    return downloadjson(url).then((data)=>{
      let mdata;
      if(this.mod=='core'||this.mod=='base'||this.mod=='core+base'){
        //console.log(data);
        for(let {ref:version,object:{sha:ref}} of data){
          version=path.basename(version);
          if(this.includes(version)&&cmpv(version,mdata?.version??'0.0.0')<0){
            mdata={version:version,deps:[],ref:ref};
          }
        }
      }else{
        for(let {version:version,info_json:{dependencies:deps}} of data.releases){
          if(this.includes(version)&&cmpv(version,mdata?.version??'0.0.0')<0){
            mdata={version:version,deps:deps};
          }
        }
      }
      var resolved={};
      resolved.deps=mdata.deps.map(dep=>versionConstraint(dep,null,this.mod)).map(v=>[v.mod,v]);
      resolved.version=mdata.version;
      resolved.ref=mdata.ref;
      // make into a resolvedversion object
      console.log(this.mod,resolved.deps,resolved.version)
      return resolved;
    });
  }

  toString(){
    if(this.incompatible){
      return `! ${this.mod}`;
    }
    let s=`${this.optional?'? ':''}${this.mod}`;
    if(this.topVersion){
      s+=` <${this.topExclude?'':'='} ${this.topVersion}`;
    }
    if(this.bottomVersion){
      s+=` >${this.bottomExclude?'':'='} ${this.bottomVersion}`;
    }
    return s;
  }
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

function min(x,y){
  return x<y?x:y;
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

export {versionConstraint,incompatible,anyVersion,constraint,VersionConstraint};