import * as fs from "node:fs";

let read=filename=>new Promise((resolve,reject)=>{
  let s="";
  let f=fs.createReadStream(filename);
  f.on("data",data=>{s+=data;});
  f.on("end",()=>{resolve(s);});
  f.on("error",reject);
});

let write=(filename,data)=>new Promise((resolve,)=>{
  let f=fs.createWriteStream(filename);
  f.write(data,resolve);
  f.close();
});

export {read,write};