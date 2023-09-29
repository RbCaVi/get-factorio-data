.[]|
{
	mod:.[3],
	modroot:(
		if .[3]=="base" or .[3]=="core" then
			$factorioroot+"/data/"+.[3]
		else 
			(.[1]+"/"+.[2])
		end
	)
}
|"mkdir -p \""+$destmodroot+"/"+.mod+"\"",
"outdir=$(realpath \""+$destmodroot+"/"+.mod+"\")",
"pushd \""+.modroot+"\"",
"find -name '*.png' -printf '%p\\n' -o -name '*.ogg' -printf '%p\\n'|cpio --pass-through --verbose --make-directories --link \"$outdir\"",
"popd",
""