import {downloadunzip} from './unzip.mjs'

import {versionConstraint,incompatible,anyVersion,constraint,VersionConstraint} from './version.mjs';

//version is an upper and lower bound
//inclusive or exclusive
//either can be omitted for no limit
//resolve picks the newest version
//using a mods query
//explicitly specify the mods you want with one version constraint

var pack={
  mods:{
    ["minimal-no-base-mod"]:{},
  }
}

let versions=new Map();

for(let [mod,moddata] of Object.entries(pack.mods)){
  let version;
  if(moddata.version){
    version=versionConstraint('____ = '+moddata.version,mod,'__initial__');
  }else{
    version=anyVersion(mod,'__initial__');
  }
  versions.set(mod,version);
}

let resolvedVersions=new Map();
for(let [mod,version] of versions){
  resolvedVersions.set(mod,version.resolve());
}

function resolveAll(ps){
  // ps is {key:promise ...}
  // returns a Promise that resolves to {key:promise value}
  // will reject with any error
  var values=new Map();
  console.log(ps);
  return [...ps.entries()].map(
    ([k,p])=>p.then(data=>{values.set(k,data);})
  ).reduce(
    (p1,p2)=>p1.then(()=>p2)
  ).then(()=>values);
}

function downloadmod(mod,version,data){
  let url=`https://mods-storage.re146.dev/${mod}/${version}.zip`;
  let contentroot=`${mod}_${version}`;
  let dest=`mods/${mod}-${version}`;

  let temp=gettempfile();

  downloadunzip(url,contentroot,dest)
}

resolveAll(resolvedVersions).then((resolvedVersions)=>{
  let errors=[];
  for(let [mod,resolvedVersion] of resolvedVersions){
    for(let [depmod,depversion] of resolvedVersion.deps){
      if(!depversion.incompatible&&!resolvedVersions.has(depmod)){
        errors.push(`Unresolved dependency: ${depmod} - needs version ${depversion}`)
      }
      if(depversion.incompatible&&!depversion.includes(resolvedVersions.get(depmod).version)){
        if(depmod=='base'){
          resolvedVersions.remove('base');
        }else{
          errors.push(`Incompatible version: ${depmod} - needs version ${depversion}`)
        }
      }
    }
  }
  if(errors.length>0){
    throw new Error(errors);
  }
  return resolvedVersions;
}).then((resolvedVersions)=>{
  for(let [mod,resolvedVersion] of resolvedVersions){
    downloadmod(mod,resolvedVersion.version,pack.mods[mod]);
  }
})