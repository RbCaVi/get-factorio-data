var f=(url,contentroot,dest)=>new Promise((resolve,reject)=>
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
).then(buffer=>yauzl.openBuffer(buffer, {lazyEntries: true}, function(err, zipfile) {
  if (err) throw err;
  zipfile.readEntry();
  zipfile.on("entry", function(entry) {
    if (/\/$/.test(entry.fileName)) {
      zipfile.readEntry();
    } else {
      // file entry
      zipfile.openReadStream(entry, function(err, readStream) {
        if (err) throw err;
        if(!entry.fileName.startsWith(contentroot)){
          zipfile.readEntry();
          return;
        }
        readStream.on("end", function() {
          zipfile.readEntry();
        });
        fs.mkdirSync(location+path.dirname(, { recursive: true });
        fs.createWriteStream(
        readStream.pipe(somewhere);
      });
    }
  });
}));

