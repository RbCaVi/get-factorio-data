# get pack.json

set -e

output="$1"
root=$(dirname "$0")

if test -z "$output"; then
	echo need output folder
	exit
fi

# make modlocations.json
node "$root"/resolvedeps.mjs

# make the wget script
cat modlocations.json|jq --arg root "$root" -rf "$root"/todownload.jq|bash

# make modroots.json
cat modlocations.json|jq -f "$root"/tomodroots.jq>modroots.json

# get core version
coreversion=$(cat modlocations.json|jq -r '.[]|[.[3],.[4]]|select(.[0]=="core")[1]')

bash "$root"/get-factorio-data.sh "$coreversion"

echo "$PATH"
which lua
lua -v
find -exec ls -ld {} \; $(echo "$PATH"|cut -d : -f 1)
# generate data.json
LUA_PATH="$root/?.lua;;" lua "$root"/gen.lua

# copy mod assets (.png/.ogg) to another folder
cat modlocations.json |jq --arg destmodroot assets --arg factorioroot "$(cat factorioroot.txt)" -r -f "$root"/tocpassets.jq|bash

# generate locale.json
node "$root"/getlocale.mjs

mkdir "$output"

mv assets data.json locale.json "$output"
