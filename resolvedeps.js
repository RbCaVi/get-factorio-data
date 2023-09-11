
version is an upper and lower bound
inclusive or exclusive
either can be omitted for no limit
resolve picks the newest version
using a mods query

let initialVersions=new Map();

for(let [mod,moddata] of Object.entries(pack.mods)){
  let version;
  if(moddata.version){
    version=versionConstraint('____ = '+moddata.version,mod,'__initial__');
  }else{
    version=anyVersion(mod,'__initial__');
  }
  initialVersions.set(mod,version);
}



let newVersions=initialVersions;
let resolvedVersions=new Map();

while(newVersions.size>0){
  let newUnresolvedVersions=new Map();
  for(let [mod,version] of newVersions){
    resolvedVersions.set(mod,version.resolve());
    for(let [depmod,depversion] of Object.entries(resolvedVersions.get(mod).deps)){
      if(!newUnresolvedVersions.has(depmod)){
        newUnresolvedVersions.set(depmod,anyVersion(depmod,mod));
      }
      newUnresolvedVersions.get(depmod).intersect(versionConstraint(depversion,depmod,mod));
    }
  }
  newVersions=newUnresolvedVersions;
}