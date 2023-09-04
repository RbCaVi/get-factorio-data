version=$1

curl https://lua-api.factorio.com/${version}/runtime-api.json|jq -rf factorio-defines.jq>fdata.lua

(if test "$(curl -s -o /dev/null -I -w "%{http_code}" https://lua-api.factorio.com/${version}/prototype-api.json|head -c 1)" == 2; then
  curl https://lua-api.factorio.com/${version}/prototype-api.json
else
  curl https://lua-api.factorio.com/latest/prototype-api.json
fi)|jq -r '"local datatypes={",(.prototypes[]|select(.abstract|not)|"  \""+.typename+"\","),"}"'>>fdata.lua

echo 'return {defines=defines,types=datatypes}'>>fdata.lua
