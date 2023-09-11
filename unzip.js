var downloadunzip=(url,contentroot,dest)=>new Promise((resolve,reject)=>
  https.get(url, (res) => {
    const data = [];
    res.on('data', (chunk) => {
      data.push(chunk);
    }).on('end', () => {
      if (!res.complete){
        reject( 'The connection was terminated while the message was still being sent');
      }
      let buffer = Buffer.concat(data);
      // Do something with the buffer
      resolve(buffer);
    });
  }).on('error', (err) => { reject(['download error:', err]); })
).then(buffer=>yauzl.fromBuffer(buffer, {lazyEntries: true}, function(err, zipfile) {
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
        var stream=fs.createWriteStream(path.join(dest,fname));
        readStream.pipe(stream);
      });
    }
  });
}));

yauzl=require('yauzl');

url='https://mods-storage.re146.dev/spaceexplorationdatachipaugmenter/1.1.0.zip';
contentroot='spaceexplorationdatachipaugmenter_1.1.0';
dest='/home/rvail/seauto/sitegen/mmmmmmmm';

downloadunzip(url,contentroot,dest)