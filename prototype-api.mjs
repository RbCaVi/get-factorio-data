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

//console.log(parentchains);

const listprototypes = { // i sure hope this code won't be looked at by generations to come and ridiculed for bad naming
	itemtypes:'ItemPrototype',
	equipmenttypes:'EquipmentPrototype',
	entitytypes:'EntityPrototype',
};

const lists = {};

for (const [listname,prototypename] of Object.entries(listprototypes)) {
	lists[listname] = [];
}

for (const [prototypename,parents] of Object.entries(parentchains)) {
	for (const [listname,ancestorprototypename] of Object.entries(listprototypes)) {
		if ((!namedprototypes[prototypename].abstract) && parents.includes(ancestorprototypename)) {
			lists[listname].push(namedprototypes[prototypename].typename);
		}
	}
}

//console.log(lists);
