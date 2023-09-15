import {download} from './download.mjs'

import * as fs from 'node:fs';

import * as path from 'node:path';

import * as yauzl from 'yauzl';

function unzipcallback(contentroot,dest,resolve,reject){
  console.log(contentroot,dest);
  function callback(err, zipfile) {
    if (err) throw err;
    let ncroot=path.normalize(contentroot);
    let contentrootlength=ncroot.split(path.sep).length;
    if(ncroot=='.'){
      ncroot='';
      contentrootlength=0;
    }
    zipfile.readEntry();
    zipfile.on("entry", function(entry) {
      if (/\/$/.test(entry.fileName)) {
        zipfile.readEntry();
      } else {
        console.log(path.normalize(entry.fileName),ncroot);
        if(!path.normalize(entry.fileName).startsWith(ncroot)){
          zipfile.readEntry();
          return;
        }
        const pathComponents = path.normalize(entry.fileName).split(path.sep);
        const fname=path.join(...pathComponents.slice(contentrootlength));
        // file entry
        zipfile.openReadStream(entry, function(err, readStream) {
          if (err) throw err;
          readStream.on("end", function() {
            zipfile.readEntry();
          });
          fs.mkdirSync(path.join(dest,path.dirname(fname)), { recursive: true });
          const stream=fs.createWriteStream(path.join(dest,fname));
          readStream.pipe(stream);
        });
      }
    });
    if(resolve){
      zipfile.on('end',resolve);
    }
    if(reject){
      zipfile.on('error',reject);
    }
  }
  return callback;
}

let downloadunzip=(url,contentroot,dest)=>download(url).then(buffer=>new Promise((resolve,reject)=>
  yauzl.fromBuffer(buffer, {lazyEntries: true}, unzipcallback(contentroot,dest,resolve,reject))
));

let unzip=(filename,contentroot,dest)=>new Promise((resolve,reject)=>
  yauzl.open(filename, {lazyEntries: true}, unzipcallback(contentroot,dest,resolve,reject))
)

export {downloadunzip,unzip};