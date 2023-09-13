import {download} from './download.mjs'

import * as fs from 'node:fs';

import * as path from 'node:path';

import * as yauzl from 'yauzl';

let downloadunzip=(url,contentroot,dest)=>download(url).then(buffer=>yauzl.fromBuffer(buffer, {lazyEntries: true}, function(err, zipfile) {
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
}));

export {downloadunzip};