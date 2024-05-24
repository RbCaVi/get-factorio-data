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

function normalize(prototypename) {
	console.log(prototypename);
	const prototype = namedprototypes[prototypename];
	console.log('parent',prototype.parent);
	console.log('abstract',prototype.abstract);
	console.log('typename',prototype.typename);
	console.log('instance_limit',prototype.instance_limit);
	for (const property of prototype.properties) {
		console.log('property',property.name,property.alt_name,property.override,property.type);
		if (property.optional){
			console.log('  optional');
			if (property.default != undefined) {
				console.log('    default',property.default);
			}
		}
	}
	console.log('custom_properties',prototype.custom_properties);
}

normalize('PrototypeBase');

export {namedprototypes,lists,normalize};