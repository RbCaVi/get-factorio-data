[
	.[]|
	{
		key:.[3],
		value:(.[1]+"/"+if .[2]=="" then .[3]+"_"+.[4] else .[2] end)
	}
]|
from_entries