import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import * as file from './file.mjs';

let data=await file.read('modroots.json');
let mods=JSON.parse(data);

let factorioroot=await file.read('factorioroot.txt');
factorioroot=factorioroot.trim();

let localefiles={};

for(let [mod,root] of Object.entries(mods)){
  if(mod=='base'||mod=='core'){ // get locale from an installed factorio because they're not in factorio-data
    root=path.join(factorioroot,'data',mod);
  }
  const localedir = await fsPromises.opendir(path.join(root,'locale'));
  for await (const entry of localedir){
    if(!entry.isDirectory()){
      continue;
    }
    let lang=entry.name;
    if(!(lang in localefiles)){
      localefiles[lang]=[]
    }
    const localedir = await fsPromises.opendir(path.join(root,'locale',lang));
    for await (const entry of localedir){
      if(entry.name.endsWith('.cfg')){
        localefiles[lang].push(path.join(root,'locale',lang,entry.name));
      }
    }
  }
}

console.log(localefiles);

let locale={};

for(let [lang,langfiles] of Object.entries(localefiles)){
  locale[lang]={};
  for(let langfile of langfiles){
    let data=await file.read(langfile);

    let category;
    for(let line of data.split(/\r?\n/)){
      line=line.trim()
      if(line==''||line.startsWith(';')||line.startsWith('#')){
        continue;
      }
      if(line.startsWith('[')&&line.endsWith(']')){
        category=line.slice(1,-1);
      }else{
        let [key,value]=line.split('=',2)
        if(!category){
          locale[lang][key]=value;
        }else{
          locale[lang][category+'.'+key]=value;
        }
      }
    }
  }
}

let localedata=JSON.stringify(locale);
await file.write('locale.json',localedata);