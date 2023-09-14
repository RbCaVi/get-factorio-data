import * as https from 'node:https';
import * as fs from 'node:fs';

let headers={'User-Agent':'RbCaVi-SEJS'}

const download=(url,asString=false)=>new Promise((resolve,reject)=>
  https.get(url, {headers:headers}, (res) => {
    const data = [];
    res.on('data', (chunk) => {
      data.push(chunk);
    }).on('end', () => {
      if (!res.complete){
        reject('The connection was terminated while the message was still being sent');
      }
      if(asString){
        const string = data.join('');
        resolve(string);
      }else{
        const buffer = Buffer.concat(data);
        resolve(buffer);
      }
    });
  }).on('error', (err) => { reject(['download error:', err]); })
);

const downloadfile=(url,filename)=>new Promise((resolve,reject)=>
  https.get(url, {headers:headers}, (res) => {
    const file=fs.createWriteStream(filename);
    const data = [];
    res.pipe(file);
    res.on('end', () => {
      if (!res.complete){
        reject('The connection was terminated while the message was still being sent');
      }
    }).on('error', () => {
      file.end();
    });
    file.on('end',()=>{
      resolve();
    });
  }).on('error', (err) => { reject(['download error:', err]); })
);

export {download,downloadfile};