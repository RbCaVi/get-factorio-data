import * as fs from 'node:fs';

import {versionConstraint,incompatible,anyVersion,constraint,VersionConstraint} from './version.mjs';

//version is an upper and lower bound
//inclusive or exclusive
//either can be omitted for no limit
//resolve picks the newest version
//using a mods query
//explicitly specify the mods you want with one version constraint

function resolveAllMap(ps){
  // ps is {key:promise ...}
  // returns a Promise that resolves to {key:promise value}
  // will reject with any error
  let values=new Map();
  console.log(ps);
  return [...ps.entries()].map(
    ([k,p])=>p.then(data=>{values.set(k,data);})
  ).reduce(
    (p1,p2)=>p1.then(()=>p2)
  ).then(()=>values);
}

function geturl(mod,rversion,data){
  let version=rversion.version;
  //console.log(mod,version,data);
  let url,contentroot,dest;
  
  if(mod=='core'||mod=='base'){
    url=`https://api.github.com/repos/wube/factorio-data/zipball/${rversion.ref}`;
    contentroot=`wube-factorio-data-${(''+rversion.ref).slice(0,7)}/${mod}`;
  }else{
    url=`https://mods-storage.re146.dev/${mod}/${version}.zip`;
    contentroot=`${mod}_${version}`;
  }
  dest=`mods/${mod}-${version}/${contentroot}`;

  return [url,dest];
}

async function run(pack){
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

  // make core and base share the same version
  let coreversion,baseversion;
  if(!versions.has('core')){
    coreversion=anyVersion('core','__initial__');
  }else{
    coreversion=versions.get('core');
  }
  if(!versions.has('base')){
    baseversion=anyVersion('base','__initial__');
  }else{
    baseversion=versions.get('base');
  }
  coreversion.mod='core+base';
  baseversion.mod='core+base';
  coreversion.intersect(baseversion);
  let mergedversion=coreversion;
  versions.set('base',mergedversion);
  versions.set('core',mergedversion);
  //versions.set('core+base',mergedversion);


  let resolvedVersions=new Map();
  for(let [mod,version] of versions){
    resolvedVersions.set(mod,version.resolve());
  }

  resolvedVersions=await resolveAllMap(resolvedVersions);

  let errors=[];
  for(let [mod,resolvedVersion] of resolvedVersions){
    for(let [depmod,depversion] of resolvedVersion.deps){
      if(!depversion.incompatible&&!depversion.optional&&!resolvedVersions.has(depmod)){
        errors.push(`Unresolved dependency: ${depmod} - needs version ${depversion}`)
      }
      if(depversion.incompatible&&depversion.includes(resolvedVersions.get(depmod)?.version)){
        if(depmod=='base'){
          resolvedVersions.delete('base');
        }else{
          errors.push(`Incompatible version: ${depmod} - needs version ${depversion}`)
        }
      }
    }
  }
  if(errors.length>0){
    throw new Error(errors);
  }

  let modlocations=[];
  let finishedmods={};
  for(let [mod,] of resolvedVersions){
    finishedmods[mod]=false;
  }
  for(let [mod,resolvedVersion] of resolvedVersions){
    console.log(mod, 'resolves to',resolvedVersion);
    let [url,contentroot,dest]=geturl(mod,resolvedVersion,pack.mods[mod]);
    modlocations.push([url,contentroot,dest]);
  }
  console.log('downloading',modlocations);
  return modlocations;
}

let read=filename=>new Promise((resolve,reject)=>{
  let s='';
  let f=fs.createReadStream(filename);
  f.on('data',data=>{console.log(data);s+=data;});
  f.on('end',()=>{resolve(s)});
  f.on('error',reject);
});

let tee=x=>(console.log(x),x);

read('pack.json').then(tee).then(JSON.parse).then(run);