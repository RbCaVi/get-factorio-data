/* jshint esversion: 11 */
import * as fsPromises from "node:fs/promises";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as child_process from "node:child_process";
import { fileURLToPath } from "node:url";

import * as file from "./file.mjs";
import * as download from "./download.mjs";
import * as retry from "./retry.mjs";
import * as unzip from "./unzip.mjs";

import {versionConstraint,anyVersion} from "./version.mjs";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//version is an upper and lower bound
//inclusive or exclusive
//either can be omitted for no limit
//resolve picks the newest version
//using a mods query
//explicitly specify the mods you want with one version constraint

async function resolveAllMap(ps){
  // ps is {key:promise ...}
  // returns a Promise that resolves to {key:promise value}
  // will reject with any error
  const values=new Map();
  await Promise.all([...ps.entries()].map(async ([k,p])=>{
    const data=await p;
    values.set(k,data);
  }));
  return values;
}

function geturl(mod,rversion,/*data*/){
  const version=rversion.version;
  //console.log(mod,version,data);
  let url,contentroot;

  if(mod=="core"||mod=="base"){
    url=`https://api.github.com/repos/wube/factorio-data/zipball/${rversion.ref}`;
    contentroot=`wube-factorio-data-${(""+rversion.ref).slice(0,7)}/${mod}`;
  }else{
    url=`https://mods-storage.re146.dev/${mod}/${version}.zip`;
    contentroot="";//`${mod}_${version}`;
  }
  const dest=`mods/${mod}-${version}`;

  return [url,dest,contentroot];
}

async function run(pack){
  const versions=new Map();

  for(const [mod,moddata] of Object.entries(pack.mods)){
    let version;
    if(moddata.version){
      version=versionConstraint(`${mod} = ${moddata.version}`,"__initial__");
    }else{
      version=anyVersion(mod,"__initial__");
    }
    versions.set(mod,version);
  }

  // make core and base share the same version
  let coreversion,baseversion;
  if(!versions.has("core")){
    coreversion=anyVersion("core","__initial__");
  }else{
    coreversion=versions.get("core");
  }
  if(!versions.has("base")){
    baseversion=anyVersion("base","__initial__");
  }else{
    baseversion=versions.get("base");
  }
  coreversion.mod="core+base";
  baseversion.mod="core+base";
  coreversion.intersect(baseversion);
  const mergedversion=coreversion;
  versions.set("base",mergedversion);
  versions.set("core",mergedversion);
  //versions.set('core+base',mergedversion);


  const resolvedVersions=new Map();
  for(const [mod,version] of versions){
    resolvedVersions.set(mod,version.resolve());
  }

  const resolved2Versions=await resolveAllMap(resolvedVersions);

  const errors=[];
  for(const [,resolvedVersion] of resolved2Versions){
    for(const [depmod,depversion] of resolvedVersion.deps){
      if(!depversion.incompatible&&!depversion.optional&&!resolved2Versions.has(depmod)){
        errors.push(`Unresolved dependency: ${depmod} - needs version ${depversion}`);
      }
      if(depversion.incompatible&&depversion.includes(resolved2Versions.get(depmod)?.version)){
        if(depmod=="base"){
          resolved2Versions.delete("base");
        }else{
          errors.push(`Incompatible version: ${depmod} - needs version ${depversion}`);
        }
      }
    }
  }
  if(errors.length>0){
    throw new Error(errors);
  }

  const modlocations=[];
  for(const [mod,resolvedVersion] of resolved2Versions){
    console.log(mod, "resolves to",resolvedVersion);
    const location=geturl(mod,resolvedVersion,pack.mods[mod]);
    modlocations.push([...location,mod,resolvedVersion.version]);
  }
  console.log("downloading",modlocations);
  return modlocations;
}

const packdata=await file.read("pack.json");
console.log(packdata);
const pack=JSON.parse(packdata);
const modlocations=await run(pack);
//let modlocationsdata=JSON.stringify(modlocations);
//await file.write('modlocations.json',modlocationsdata);

function getmoddata(mod) {
  return pack.mods[mod] ?? {"assets":true};
}

const factorioroot=(await file.read("factorioroot.txt")).trim();


// https://stackoverflow.com/a/63497965
async function toArray(asyncIterator){
  const arr=[];
  for await(const i of asyncIterator) arr.push(i);
  return arr;
}



const groupedmods=new Map();
for(const l of modlocations){
  if(!groupedmods.has(l[0])){
    groupedmods.set(l[0],[]);
  }
  groupedmods.get(l[0]).push(l);
}

let coreversion;

const tmpdir=await fsPromises.mkdtemp(path.join(os.tmpdir(), "factorio-data-"));
console.log("temp location for zips:",tmpdir);

function getrootname(p) {
  last=p;
  next=path.dirname(p);
  while(next!='.'&&next!='/'){
    last=next;
    next=path.dirname(last);
  }
  return last;
}

// only helps if i have builtin lua
/*
const tmpcounts2=new Map();
[...groupedmods.entries()].map(async ([url,v])=>{
  const firstmod=v[0][3];
  const count=tmpcounts2.get(firstmod)??0;
  const tempfile=path.join(tmpdir,`${firstmod}-${count}`); // get temp file name /tmp/space-exploration (2)
  tmpcounts2.set(firstmod,count+1);
  console.log(`getting ${tempfile} from ${url} for ${firstmod}`);
  await retry.retryifyAsync(download.downloadToFile)(url,tempfile);
  console.log(`downloaded ${tempfile} from ${url} for ${firstmod}`);
  await Promise.all(v.map(async ([,,vroot,mod,version])=>{
    console.log(`unzipping ${tempfile} for ${mod}`);
    let root=vroot;
    const defaultroot=mod+"_"+version;
    const entries=await unzip.getStreams(tempfile,root)
    console.log(`unzipped ${tempfile} for ${mod}`);
    if(root==""){
      console.log("unzip to");
      const files=entries.entries.values().map(getrootname)
      if(files.length==1){
        const file=files[0];
        const newentries=new Map();
        for(const fname of entries.entries.keys()){
          const newfname=fname.replace(file,defaultroot); // only replaces the first instance (should be root)
          newentries.set(newfname,entries.entries.get(fname));
        }
        entries.entries=newentries;
      }else if(files.includes(defaultroot));
      else{
        throw `mod from ${url} didn't have an identifiable mod root`;
      }
      root=defaultroot;
    }
    if(mod=="base"){
      const f=async ()=>fs.createReadStream(path.join(factorioroot,"data/base/menu-simulations/menu-simulations.lua"));
      entries.entries.set("menu-simulations/menu-simulations.lua",f); // add an entry for menu sims
    }
    if(mod=="core"){
      coreversion=version;
    }
  }));
})
*/

const tmpcounts=new Map();
await Promise.all([...groupedmods.entries()].map(async ([url,v])=>{
  const firstmod=v[0][3];
  const count=tmpcounts.get(firstmod)??0;
  const tempfile=path.join(tmpdir,`${firstmod}-${count}`); // get temp file name /tmp/space-exploration (2)
  tmpcounts.set(firstmod,count+1);
  console.log(`getting ${tempfile} from ${url} for ${firstmod}`);
  await retry.retryifyAsync(download.downloadToFile)(url,tempfile);
  console.log(`downloaded ${tempfile} from ${url} for ${firstmod}`);
  await Promise.all(v.map(async ([,unzipto,vroot,mod,version],i)=>{
    console.log(`unzipping ${tempfile} to ${unzipto} for ${mod}`);
    let root=vroot;
    const defaultroot=mod+"_"+version;
    fsPromises.mkdir(unzipto,{recursive:true});
    await unzip.unzip(tempfile,root,unzipto);
    console.log(`unzipped ${tempfile} to ${unzipto} for ${mod}`);
    if(root==""){
      const files=(await toArray(await fsPromises.opendir(unzipto))).map(dirent=>dirent.name);
      if(files.length==1){
        fsPromises.rename(path.join(unzipto,files[0]),path.join(unzipto,defaultroot));
      }else if(files.includes(defaultroot));
      else{
        throw `mod from ${url} didn't have an identifiable mod root`;
      }
      root=defaultroot;
      v[i][2]=defaultroot;
    }else{
      v[i][2]='';
    }
    if(mod=="base"){
      await fsPromises.mkdir(path.join(unzipto,"menu-simulations"),{recursive:true});
      await fsPromises.copyFile(
        path.join(factorioroot,"data/base/menu-simulations/menu-simulations.lua"),
        path.join(unzipto,"menu-simulations/menu-simulations.lua")
      );
    }
    if(mod=="core"){
      coreversion=version;
    }
  }));
}));

console.log("removing temp dir:",tmpdir);
await fsPromises.rm(tmpdir,{recursive:true});

const modroots={};
for(const [,unzipto,root,mod,version] of modlocations){
  modroots[mod]=unzipto+"/"+root;
}

const modrootsdata=JSON.stringify(modroots);
await file.write("modroots.json",modrootsdata);







const writestream=fs.createWriteStream("fdata.lua");

const writestreamfd=new Promise((res)=>writestream.on('open',res));

function writedefinesfromjson(defines,prefix,stream) {
  stream.write(`${prefix}={}\n`);
  for(const [name,value] of defines){
    const subprefix=prefix+"['"+name+"']";
    if(typeof value=="object"){
      writedefinesfromjson(value,subprefix,stream);
    }else{
      stream.write(`${subprefix}=value\n`);
    }
  }
}

function writedefinesfromapi(defines,prefix,stream) {
  //console.log("defines are",defines);
  for(const define of defines){
    const subprefix=prefix+"['"+define.name+"']";
    stream.write(`${subprefix}={}\n`);
    if("values" in define){
      for(const {name} of define.values){
        const valuename=subprefix+"['"+name+"']";
        stream.write(`${valuename}="${valuename}"\n`);
        // like i could do it in numeric order like the actual defines
        // but there are special cases i don't want to handle
        // this should be just a fallback
      }
    }else if("subkeys" in define){
      writedefinesfromapi(define.subkeys,subprefix,stream);
    }
  }
}

try{
  // first try json
  console.log("checking for defines.json");
  const defines=await read("defines.json").then(JSON.parse);

  writestream.write("local ");
  writedefinesfromjson(defines.defines,"defines",writestream);
  writestream.write("\n");
  console.log("defines.json found");
}catch{
  console.log("defines.json not found");
  try{
    console.log("checking for defines.lua");
    // try defines.lua
    // from /c game.write_file("defines.lua", "local defines = " .. serpent.block(defines, {indent="    "}))
    // (command from https://github.com/redruin1/factorio-draftsman/blob/main/draftsman/compatibility/defines.lua)
    await new Promise((resolve,reject)=>{
      const readstream=fs.createReadStream("defines.lua");
      readstream.on("end", function() {
        console.log("defines.lua found");
        resolve();
      }).on("error", async function(err) {
        console.log("defines.lua not found");
        reject(err);
      }).pipe(writestream,{end:false});
    });
    writestream.write("\n");
  }catch{
    console.log("fallback to factorio api");
    // error meaning defines.lua didn't work
    // so finally fall back to taking it from the factorio api
    console.log(`getting runtime api for version ${coreversion}`);
    const runtimeapi=await download.downloadjson(`https://lua-api.factorio.com/${coreversion}/runtime-api.json`);
    console.log(`got runtime api for version ${coreversion}`);

    writestream.write("local defines={}\n");
    writedefinesfromapi(runtimeapi.defines,"defines",writestream);
    writestream.write("\n");
  }
}

function writetypes(data,stream) {
  stream.write("local datatypes={\n");
  for(const prototype of data.prototypes){
    if(!prototype.abstract){
      stream.write(`  "${prototype.typename}",\n`);
    }
  }
  stream.write("}");
}

let res=await download.request(`https://lua-api.factorio.com/${coreversion}/prototype-api.json`);
if(!(res.statusCode>=200&&res.statusCode<300)){
  res=await download.request("https://lua-api.factorio.com/latest/prototype-api.json");
}

const parts=[];
const prototypedata=await new Promise((resolve,reject)=>
  res.on("data", (chunk) => {
    parts.push(chunk);
  }).on("end", () => {
    if (!res.complete){
      reject("The connection was terminated while the message was still being sent");
    }
    const string = parts.join("");
    resolve(string);
  })
);

writetypes(JSON.parse(prototypedata),writestream);

writestream.write("\nreturn {defines=defines,types=datatypes}");

fs.fsyncSync(await writestreamfd);

await new Promise((res,rej)=>{
  writestream.close(res);
})


// generate data.json
const savedluapath=process.env.LUA_PATH;

process.env.LUA_PATH=__dirname+'/?.lua;./?.lua';

//const luaproc=child_process.spawn("lua",[`${__dirname}/gen.lua`],{stdio:"inherit"});
const luaproc=child_process.spawnSync("lua",[`${__dirname}/gen.lua`],{stdio:"inherit"});
/*
await new Promise((res,rej)=>{
  luaproc.on('error',rej);
  luaproc.on('close',res);
})
*/
process.env.LUA_PATH=savedluapath;

// https://stackoverflow.com/a/45130990
async function* getFiles(dir,basePath=".") {
  //console.log("getting files",dir,basePath);
  const dirents = await fsPromises.readdir(dir, { withFileTypes: true });
  for (const dirent of dirents) {
    const name=path.join(dir, dirent.name);
    //console.log("got file",name,path.join(basePath,dirent.name),dirent.isDirectory());
    if (dirent.isDirectory()) {
      //yield name;
      yield* getFiles(name,path.join(basePath,dirent.name));
    } else {
      yield path.join(basePath,dirent.name);
    }
  }
}

function isasset(filename) {
  return (
    filename.endsWith(".png")|| // images
    filename.endsWith(".ttf")   // fonts
  );
}

await Promise.all(modlocations.map(([,,,mod,version])=>({
  mod,
  version,
  modroot:(mod=="base"||mod=="core")?`${factorioroot}/data/${mod}`:modroots[mod]
})).map(async ({mod,version,modroot})=>{
  if(getmoddata(mod).assets == false) { // default true
    return;
  }
  const outdir=`assets/${mod}`; // sejs isn't built for mod_version yet
  //console.log("make dir",outdir);
  await fsPromises.mkdir(outdir,{recursive:true});
  for await(const name of getFiles(modroot)){
    if(isasset(name)){
      //console.log("make dir",path.dirname(`${outdir}/${name}`));
      await fsPromises.mkdir(path.dirname(`${outdir}/${name}`),{recursive:true});
      //console.log("copy",`${modroot}/${name}`,`${outdir}/${name}`);
      await fsPromises.copyFile(`${modroot}/${name}`,`${outdir}/${name}`);
    }
  }
}));












const localefiles={};
const localeinfos={};

for(const [mod,croot] of Object.entries(modroots)){
  let root=croot;
  if(mod=="base"||mod=="core"){ // get locale from an installed factorio because they're not in factorio-data
    root=path.join(factorioroot,"data",mod);
  }
  try{
    const localedir = await fsPromises.opendir(path.join(root,"locale"));
    for await (const langentry of localedir){
      if(!langentry.isDirectory()){
        continue;
      }
      const lang=langentry.name;
      if(!(lang in localefiles)){
        localefiles[lang]=[];
      }
      try{
        const localelangdir = await fsPromises.opendir(path.join(root,"locale",lang));
        for await (const localeentry of localelangdir){
          if(localeentry.name.endsWith(".cfg")){
            localefiles[lang].push(path.join(root,"locale",lang,localeentry.name));
          }
          if(localeentry.name=='info.json'){
            const data = await file.read(path.join(root,"locale",lang,localeentry.name));
            const localeinfo = JSON.parse(data);
            localeinfos[lang] = localeinfo;
          }
        }
      }catch{}
    }
  }catch{}
}

//console.log(localefiles);

const locale={};
const fonts={}

for(const [lang,langfiles] of Object.entries(localefiles)){
  locale[lang]={};
  fonts[lang]={};
  for(const langfile of langfiles){
    const data=await file.read(langfile);

    let category;
    for(const line of data.split(/\r?\n/)){
      const trimmedline=line.trim();
      if(trimmedline==""||trimmedline.startsWith(";")||trimmedline.startsWith("#")){
        continue;
      }
      if(trimmedline.startsWith("[")&&trimmedline.endsWith("]")){
        category=trimmedline.slice(1,-1);
      }else{
        const equalindex=trimmedline.indexOf('=');
        const key=trimmedline.slice(0,equalindex);
        const value=trimmedline.slice(equalindex+1);
        if(!category){
          locale[lang][key]=value;
        }else{
          locale[lang][category+"."+key]=value;
        }
      }
    }
  }
  // console.log(localeinfos[lang]);
  if(localeinfos[lang]?.font!=undefined){
    fonts[lang]=localeinfos[lang].font;
  }else{
    fonts[lang]={};
  }
  const fontkeys=Object.keys(locale[lang]).filter(x=>x.startsWith('font.')).map(x=>x.slice(5));
  for(const key of fontkeys){
    fonts[lang][key]=[locale[lang]['font.'+key]];
  }
}

const outdir=pack.name??'mod';

await fsPromises.mkdir(outdir);

const localedata=JSON.stringify(locale);
await file.write(path.join(outdir,"locale.json"),localedata);

const fontsdata=JSON.stringify(fonts);
await file.write(path.join(outdir,"fonts.json"),fontsdata);

fsPromises.rename('assets',path.join(outdir,'assets'));
fsPromises.rename('data.json',path.join(outdir,'data.json'));

// mkdir "$output"

// mv assets data.json locale.json "$output"