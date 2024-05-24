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

const needsnormalize = {};

function normalize(prototypename) {
	console.log(prototypename);
	const prototype = namedprototypes[prototypename];
	console.log('  parent',prototype.parent);
	if (prototype.abstract) {
		console.log('  abstract');
	} else {
		console.log('  typename',prototype.typename);
	}
	console.log('  instance_limit',prototype.instance_limit);
	console.log('  properties');
	const overridden = {};
	for (const parent of parentchains[prototypename]) {
		for (const property of namedprototypes[parent].properties) {
			console.log('    property',property.name+(property.alt_name?' / '+property.alt_name:''),'from',parent);
			if (property.name in overridden) {
				console.log('      overridden');
				continue;
			}
			console.log('      type',property.type);
			if (property.override){
				console.log('      override');
				overridden[property.name] = true;
			}
			if (property.optional){
				console.log('      optional');
				if (property.default != undefined) {
					console.log('        default',property.default);
				}
			}
		}
	}
	if (prototype.custom_properties) {
		console.log('  custom_properties');
		console.log('    key',prototype.custom_properties.key_type);
		console.log('    value',prototype.custom_properties.value_type);
	}
}

function checktypenormalize(typename) {
	// body...
}

function checknormalize(prototypename) {
	const prototype = namedprototypes[prototypename];
	if (prototype.abstract) {
		return false;
	}
	const overridden = {};
	for (const parent of parentchains[prototypename]) {
		for (const property of namedprototypes[parent].properties) {
			if (property.name in overridden) {
				continue;
			}
			if (checktypenormalize(property.type)) {
				return true;
			}
			if (property.override){
				overridden[property.name] = true;
			}
			if (property.optional){
				if (property.default != undefined) {
					console.log('default',prototypename,property.default);
					return true;
				}
			}
		}
	}
	if (prototype.custom_properties) {
		if (checktypenormalize(prototype.custom_properties.key_type)) {
			return true;
		}
		if (checktypenormalize(prototype.custom_properties.value_type)) {
			return true;
		}
	}
}

normalize('GuiStyle');

for (const prototypename of Object.keys(namedprototypes)) {
	if (checknormalize(prototypename)) {
		console.log(prototypename);
	}
}

export {namedprototypes,lists,normalize};