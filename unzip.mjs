import * as yauzl from "yauzl";
import * as path from "node:path";
import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";

var unzip=(filename,contentroot,dest)=>new Promise(
  (resolve,reject)=>yauzl.open(filename, {lazyEntries: true}, async function(err, zipfile) {
    if (err) reject(err);
    let ncroot=path.normalize(contentroot);
    let contentrootlength=ncroot.split(path.sep).length;
    if(ncroot=="."){
      ncroot="";
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
          fsPromises.mkdir(path.join(dest,path.dirname(fname)), { recursive: true }).then(()=>{
            var stream=fs.createWriteStream(path.join(dest,fname));
            readStream.pipe(stream);
          });
        });
      }
    }).once("end",()=>{
      zipfile.close();
      resolve();
    });
  })
);

export {unzip};