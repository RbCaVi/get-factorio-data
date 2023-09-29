# get pack.json

# make modlocations.json
node resolvedeps3.mjs

# make the wget script
cat modlocations.json|jq -rf todownload.jq|bash

# make modroots.json
cat modlocations.json|jq -f tomodroots.jq>modroots.json

# get core version
coreversion=$(cat modlocations.json|jq -r '.[]|[.[3],.[4]]|select(.[0]=="core")[1]')

bash get-factorio-data.sh "$coreversion"

# generate data.json
lua gen.lua

# copy mod assets (.png/.ogg) to another folder
cat modlocations.json |jq --arg destmodroot assets --arg "$(cat factorioroot)" -fr tocpassets.jq|bash

# generate locale.json
node getlocale.js