import * as https from 'node:https';
import * as fs from 'node:fs';
import * as streamPromises from 'node:stream/promises'

let headers={'User-Agent':'RbCaVi-SEJS'}

const request=url=>new Promise((resolve,reject)=>{
  https.get(url,{headers:headers},resolve).on('error', reject)
});

const requestRedirect=url=>request(url).then(res=>{
  if(res.statusCode==301||res.statusCode==302||res.statusCode==307||res.statusCode==308){
    console.log('redirected',url,res.statusCode,res.headers.location)
    return requestRedirect(res.headers.location);
  }
  return res;
})

const download=(url,asString=false)=>new Promise((resolve,reject)=>
  requestRedirect(url).then((res) => {
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
  },reject)
);

const downloadfile=(url,filename,startcallback,callback,endcallback)=>{
  console.log('aaa11',url,filename);
  const file=fs.createWriteStream(filename);
  return new Promise((resolve,reject)=>
    requestRedirect(url).then((res) => {
      let length=res.headers['content-length'];
      if(startcallback){
        startcallback(length,filename,url);
      }
      let error;
      if(callback){
        res.on('data', data => {
          // https://stackoverflow.com/questions/56944300/how-can-track-write-progress-when-piping-with-node-js
          file.write(data, () => {
            callback(data,length,filename,url);
          });
        });
        res.on('end',()=>{
          file.end();
          if (!res.complete){
            error='The connection was terminated while the message was still being sent';
          }
        });
        res.on('error',()=>{
          error='download error';
          file.end();
        });
      }else{
        res.pipe(file);
        res.on('end',()=>{
          if (!res.complete){
            error='The connection was terminated while the message was still being sent';
          }
        });
      }
      if(endcallback){
        file.on('end',()=>{endcallback(length,filename,url)});
      }
      streamPromises.finished(file).then(()=>{
        if(error){
          reject(error);
        }else{
          resolve();
        }
      });
    },reject)
  );
};

export {download,downloadfile};