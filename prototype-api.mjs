import * as file from "./file.mjs";

const apidata=await file.read("prototype-api.json");
const api=JSON.parse(apidata);

const parents = {}; // child:parent

const namedprototypes = {}; // name:prototype

for (const prototype of api.prototypes) {
	//console.log(prototype);
	if (prototype.deprecated) { // i don't care about these
		//console.log(prototype);
		continue;
	}
	//console.log(prototype);
	if (prototype.name in namedprototypes) {
		throw 'duplicate prototype';
	}
	namedprototypes[prototype.name] = prototype;
	parents[prototype.name] = prototype.parent;
}

const parentchains = {};

for (const prototypename of Object.keys(namedprototypes)) {
	parentchains[prototypename] = [];
	let pname = prototypename;
	while (pname) {
		parentchains[prototypename].push(pname);
		pname = parents[pname];
	}
}

console.log(parentchains);