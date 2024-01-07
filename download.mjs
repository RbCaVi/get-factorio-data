import * as https from "node:https";
import * as fs from "node:fs";

let headers={"User-Agent":"RbCaVi-SEJS"};

const request=url=>new Promise((resolve,reject)=>{
  https.get(url,{headers:headers},resolve).on("error", reject);
});

const requestRedirect=url=>request(url).then(res=>{
  if(res.statusCode==301||res.statusCode==302||res.statusCode==307||res.statusCode==308){
    console.log("redirected",url,res.statusCode,res.headers.location);
    return requestRedirect(res.headers.location);
  }
  return res;
});

const download=(url,asString=false)=>new Promise((resolve,reject)=>
  requestRedirect(url).then((res) => {
    const data = [];
    res.on("data", (chunk) => {
      data.push(chunk);
    }).on("end", () => {
      if (!res.complete){
        reject("The connection was terminated while the message was still being sent");
      }
      if(asString){
        const string = data.join("");
        resolve(string);
      }else{
        const buffer = Buffer.concat(data);
        resolve(buffer);
      }
    });
  },reject)
);

const downloadToFile=(url,filename)=>new Promise((resolve,reject)=>
  requestRedirect(url).then((res) => {
    const file = fs.createWriteStream(filename);
    res.pipe(file);
    file.on("finish", () => {
      if (!res.complete){
        reject("The connection was terminated while the message was still being sent");
      }
      resolve();
    });
  },reject)
);

const downloadjson=(url)=>download(url,true).then(data=>JSON.parse(data));

export {request,requestRedirect,download,downloadjson,downloadToFile};