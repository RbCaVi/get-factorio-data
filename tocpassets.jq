.[]|
{
	mod:.[3],
	modroot:(
		if .[3]=="base" or .[3]=="core" then
			$factorioroot+"/data/"+.[3]
		else 
			(
				.[1]+
				"/"+
				if .[2]=="" then
					.[3]+"_"+.[4]
				else
					.[2]
				end
			)
		end
	)
}
|"mkdir -p \""+$destmodroot+"/"+.mod+"\"",
"outdir=$(realpath \""+$destmodroot+"/"+.mod+"\")",
"pushd \""+.modroot+"\"",
"find -name '*.png' -printf '%p\\n' -o -name '*.ogg' -printf '%p\\n'|cpio --pass-through --make-directories --link \"$outdir\"",
"popd",
""
