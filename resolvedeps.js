
version is an upper and lower bound
inclusive or exclusive
either can be omitted for no limit
resolve picks the newest version
using a mods query

var initialVersions=new Map();

for(var [mod,moddata] of Object.entries(pack.mods)){
  var version;
  if(moddata.version){
    version=versionConstraint(moddata.version);
  }else{
    version=anyVersion();
  }
  initialVersions.set(mod,version);
}

var newVersions=initialVersions;
var resolvedVersions=new Map();

while(newVersions.size>0){
  var newResolvedVersions=new Map();
  for(var [mod,version] of newVersions){
    resolvedVersions.set(mod,version.resolve())
  }
  newVersions=newResolvedVersions;
}