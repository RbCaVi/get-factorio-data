group_by(.[0])|
.[]|
{
	key:.[0][0],
	value:[
		.[]|
		{
			unzipto:.[1],
			root:.[2],
			defaultroot:(.[3]+"_"+.[4]),
			mod:.[3]
		}
	]
}|
"\ntmpf=$(mktemp)",
"wget -t 0 \""+.key+"\" -O \"$tmpf\"",
(
	.value[]|
	"mkdir -p \""+.unzipto+"\"",
	"unzip -d \""+.unzipto+"\" \"$tmpf\"",
	if .root=="" then "mv \""+.unzipto+"\"/* \""+.unzipto+"/"+.defaultroot+"\"" else [][] end,
	if .mod=="base" then "mkdir \""+.unzipto+"/"+.root+"\"/menu-simulations","cp menu-simulations.lua \""+.unzipto+"/"+.root+"\"/menu-simulations" else [][] end
)