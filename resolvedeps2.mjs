import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as process from 'node:process';

import {unzip} from './unzip.mjs'
import {downloadfile} from './download.mjs'
import * as progress from 'multi-progress';

let barmaker=new progress.default(process.stderr);

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
  var values=new Map();
  console.log(ps);
  return [...ps.entries()].map(
    ([k,p])=>p.then(data=>{values.set(k,data);})
  ).reduce(
    (p1,p2)=>p1.then(()=>p2)
  ).then(()=>values);
}

function resolveAllArr(ps){
  // ps is [promise ...]
  // returns a Promise that resolves to [promise value]
  // will reject with any error
  var values=[];
  console.log(ps);
  return ps.map(
    (p,i)=>p.then(data=>{values[i]=data;})
  ).reduce(
    (p1,p2)=>{return p1.then(()=>p2)}
  ).then(()=>values);
}

let gettempfile=(()=>{
  let gettmpdir=fsPromises.mkdtemp(path.join(os.tmpdir(), 'foo-'));
  let tempcount=0;

  function gettempfile() {
    return gettmpdir.then((tmpdir)=>{
      tempcount++;
      return path.join(tmpdir,`temp${tempcount}`)
    });
  }

  return gettempfile;
})()

let modpromises=new Map();

function downloadmod(mod,rversion,data){
  let version=rversion.version;
  console.log(mod,version,data);
  let url,contentroot,dest;
  
  if(mod=='core'||mod=='base'){
    url=`https://api.github.com/repos/wube/factorio-data/zipball/${rversion.ref}`;
    contentroot=`wube-factorio-data-${(''+rversion.ref).slice(0,7)}/${mod}`;
  }else{
    url=`https://mods-storage.re146.dev/${mod}/${version}.zip`;
    contentroot=`${mod}_${version}`;
  }
  dest=`mods/${mod}-${version}`;

  console.log(modpromises);

  let getmodfile;
  if(modpromises.has(url)){
    console.log('using cached',url);
    getmodfile=modpromises.get(url);
  }else{
    let m=(tempfile)=>{
      //let written=0;
      let bar;
      let p=downloadfile(url,tempfile,(length)=>{
        console.log(length);
        if(length){
          bar=barmaker.newBar(' [:bar] :current/:total :percent :elapseds :etas :mod',{total:+length,width:30,clear:true});
        }else{
          bar=barmaker.newBar(' :current :percent :elapseds :mod',{total:0,clear:true});
        }
      },(data,length,filename,url)=>{
        bar.tick(data.length,{mod:mod});
      },(length,filename,url)=>{
        bar.terminate();
      });
      console.log('getting',url,tempfile);
      modpromises.set(url,p.then(()=>tempfile).catch(()=>m(tempfile)));
      return modpromises.get(url);
    };
    getmodfile=gettempfile().then(m);
  }
  return getmodfile.then((filename)=>{
    console.log('unzipping',filename);
    return unzip(filename,contentroot,dest);
  });
}

function run(pack){
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

  return resolveAllMap(resolvedVersions).then((resolvedVersions)=>{
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
    return resolvedVersions;
  }).then((resolvedVersions)=>{
    let downloadingmods=[];
    for(let [mod,resolvedVersion] of resolvedVersions){
      console.log(mod, 'resolves to',resolvedVersion);
      let m=downloadmod(mod,resolvedVersion,pack.mods[mod]);
      downloadingmods.push(m);
    }
    console.log('downloading',downloadingmods);
    return resolveAllArr(downloadingmods);
  }).then(()=>{
    console.log('LUA!!!!!!!!!');
    // run the lua
  },(err)=>{
    console.log('fail:',err);
  });
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