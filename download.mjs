import * as https from 'node:https';

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

const downloadjson=(url)=>download(url,true).then(data=>JSON.parse(data));

export {download,downloadjson};