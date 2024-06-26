import * as path from "node:path";

import {downloadjson} from "./download.mjs";

function versionConstraint(version,source) {
  // version is a string
  version=version.trim();

  let optional=false;
  if(version.startsWith("!")){
    version=version.slice(1).trim();
    return incompatible(version,[source]);
  }
  // regex time
  //               modifier (?), ?, ~     mod                       inequality              version
  const regex=/^\s*(\?|\(\s*\?\s*\)|~|)\s*([a-zA-Z0-9\-_. ]+?)\s*(?:([><=]=|=[><=]|[><=])\s*(\d+\.\d+(\.\d+)?))?\s*$/;
  const [,modifier,mod,ineq,versionnum]=regex.exec(version);

  if(modifier.includes("?")){
    optional=true;
  }
  console.log('versionConstraint',version,'from',source,'ineq',ineq);
  return constraint(mod,[source],ineq,versionnum,optional);
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
  if(ineq){
    if(ineq.includes("<")){
      top=version;
      topExc=!ineq.includes("=");
    }else if(ineq.includes(">")){
      bottom=version;
      bottomExc=!ineq.includes("=");
    }else{
      top=version;
      topExc=false;
      bottom=version;
      bottomExc=false;
    }
  }

  console.log('constraint',mod,ineq,version,'from',sources)

  return new VersionConstraint(mod,sources,bottom,top,bottomExc,topExc,optional,false);
}

class VersionConstraint{
  constructor(mod,sources,bottomVersion,topVersion,bottomExclude,topExclude,optional,isIncompatible){
    this.mod=mod;
    this.sources=sources;
    this.bottomVersion=bottomVersion;
    this.topVersion=topVersion;
    this.bottomExclude=bottomExclude;
    this.topExclude=topExclude;
    this.optional=optional;
    this.incompatible=isIncompatible; // different name to avoid eslint error
  }

  // intersect in place
  intersect(that){
    if(this.mod!=that.mod){
      throw new Error(`mod ${this.mod} not equal to ${that.mod}`);
    }
    if(this.incompatible&&that.incompatible){
      this.sources=this.sources.concat(that.sources);
      return;
    }
    if(this.incompatible&&!that.incompatible){
      throw new Error(`mod ${this.mod} from ${this.sources} incompatible with ${that.sources}`);
    }
    if((!this.incompatible)&&that.incompatible){
      throw new Error(`mod ${that.mod} from ${that.sources} incompatible with ${this.sources}`);
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

    //console.log('top',this.topVersion!=null&&cmpv(this.topVersion,version),'bottom',this.bottomVersion!=null&&cmpv(this.bottomVersion,version))

    if((this.topVersion!=null&&cmpv(this.topVersion,version)>0)||(this.bottomVersion!=null&&cmpv(this.bottomVersion,version)<0)){ // outside the range
      return false;
    }
    if((this.topVersion!=null&&cmpv(this.topVersion,version)==0)){ // equal to top
      return !this.topExclude;
    }
    if((this.bottomVersion!=null&&cmpv(this.bottomVersion,version)==0)){ // equal to bottom
      return !this.bottomExclude;
    }
    return true; // inside the range
  }

  async resolve(){
    let url;
    if(this.mod=="core"||this.mod=="base"||this.mod=="core+base"){
      url="https://api.github.com/repos/wube/factorio-data/git/refs/tags";
    }else{
      url=`https://mods.factorio.com/api/mods/${this.mod}/full`;
    }
    let data=await downloadjson(url);
    let mdata;
    if(this.mod=="core"||this.mod=="base"||this.mod=="core+base"){
      for(let {ref:version,object:{sha:ref}} of data){
        version=path.basename(version);
        if(this.includes(version)&&cmpv(version,mdata?.version??"0.0.0")<0){
          mdata={version:version,deps:[],ref:ref};
        }
      }
    }else{
      //console.log('releases',this.mod,data.releases) // really long
      for(let {version:version,info_json:{dependencies:deps}} of data.releases){
        //console.log('does',this,'include',version);
        //console.log(this.includes(version))
        if(this.includes(version)&&cmpv(version,mdata?.version??"0.0.0")<0){
          mdata={version:version,deps:deps};
        }
      }
    }
    var resolved={};
    resolved.deps=mdata.deps.map(dep=>versionConstraint(dep,this.mod)).map(v=>[v.mod,v]);
    resolved.version=mdata.version;
    resolved.ref=mdata.ref;
    // make into a resolvedversion object
    //console.log(this.mod,resolved.deps,resolved.version);
    return resolved;
  }

  toString(){
    if(this.incompatible){
      return `(! ${this.mod})`;
    }
    let s=`(${this.optional?"? ":""}${this.mod}`;
    if(this.topVersion){
      s+=` <${this.topExclude?"":"="} ${this.topVersion}`;
    }
    if(this.bottomVersion){
      s+=` >${this.bottomExclude?"":"="} ${this.bottomVersion}`;
    }
    s+=` (from ${this.sources.join(",")})`;
    return s+')';
  }
}

// cmpv=v2-v1

function cmpv(v1,v2) {
  let v1s=v1.split(".").map(x=>+x);
  let v2s=v2.split(".").map(x=>+x);
  for(let i=0;;i++){
    if(i>min(v1s.length,v2s.length)){
      return v2s.length-v1s.length;
    }
    if(v1s[i]>v2s[i]){
      return -1;
    }else if(v1s[i]<v2s[i]){
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
