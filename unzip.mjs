import * as yauzl from "yauzl";
import * as path from "node:path";
import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";

var unzip=(filename,contentroot,dest,filter=()=>true)=>new Promise(
  (resolve,reject)=>yauzl.open(filename, {lazyEntries: true}, async function(ziperror, zipfile) {
    if (ziperror) reject(ziperror);
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
        if(!path.normalize(entry.fileName).startsWith(ncroot)){
          zipfile.readEntry();
          return;
        }
        if(!filter(entry.fileName)){
          zipfile.readEntry();
          return;
        }
        const pathComponents = path.normalize(entry.fileName).split(path.sep);
        const fname=path.join(...pathComponents.slice(contentrootlength));
        // file entry
        zipfile.openReadStream(entry, function(readerror, readStream) {
          if (readerror) throw readerror;
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

var unzipStreams=(filename,contentroot,dest,filter=()=>true)=>new Promise(
  (resolve,reject)=>{
    const entries=new Map();
    // lazyEntries isn't needed because the caller opens the streams 
    return yauzl.open(filename, async function(ziperror, zipfile) {
      if (ziperror) reject(ziperror);
      let ncroot=path.normalize(contentroot);
      let contentrootlength=ncroot.split(path.sep).length;
      if(ncroot=="."){
        ncroot="";
        contentrootlength=0;
      }
      zipfile.readEntry();
      zipfile.on("entry", function(entry) {
        if (!(/\/$/.test(entry.fileName))) {
          if(!path.normalize(entry.fileName).startsWith(ncroot)){
            return;
          }
          if(!filter(entry.fileName)){
            return;
          }
          const pathComponents = path.normalize(entry.fileName).split(path.sep);
          const fname=path.join(...pathComponents.slice(contentrootlength));
          // a function that when called resolves to a read stream
          entries.set(fname,()=>util.promisify(zipfile.openReadStream)(entry));
        }
      }).once("end",()=>{
        //zipfile.close(); // don't close until all files have been read
        resolve({zipfile,entries});
      });
    })
  }
);

export {unzip,unzipStreams};