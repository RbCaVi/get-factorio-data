import * as file from "./file.mjs";

const apidata=await file.read("prototype-api.json");
const api=JSON.parse(apidata);

const parents = {}; // child:parent

const namedprototypes = {}; // name:prototype
const namedtypes = {}; // name:type

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

for (const type of api.types) {
	//console.log(prototype);
	if (type.name in namedtypes) {
		throw 'duplicate type';
	}
	namedtypes[type.name] = type;
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

function checkTypenormalize(typename) {
	//console.log('type',typename);
	const type = namedtypes[typename];
	if (type.abstract) {
		return false;
	}
	if (type.type == 'builtin') {
		//console.log('  builtin');
		return false;
	}
	let out = false;
	//console.log('  type',type.type);
	let pname = typename;
	const overridden = {};
	while (pname) {
		if (namedtypes[pname].properties) {
			for (const property of namedtypes[pname].properties) {
				if (property.name in overridden) {
					continue;
				}
				if (checktypenormalize(property.type,typename)) {
					//console.log('  normalize member',typename,property.name,'of type',property.type);
					out = true;
				}
				if (property.override){
					overridden[property.name] = true;
				}
				if (property.optional){
					if (property.default != undefined) {
						//console.log('  default on',typename,property.name,'=',property.default);
						if (typeof property.default == 'string') {
							//console.log('  default with desc on',typename,property.name,'=',property.default);
						} else if (property.default.complex_type == 'literal') {
							//console.log('  default literal on',typename,property.name,'=',property.default.value);
						}  // only 2 cases string or literal
						out = true;
					}
				}
			}
		}
		pname = namedtypes[pname].parent;
	}
	//console.log('  abstract',type.abstract);
	//console.log('  properties',type.properties);
	return out;
}

function checktypenormalize(type,uptype) {
	//console.log(type);
	if (typeof type == 'string') {
		if (type == uptype) {
			return false;
		}
		return checkTypenormalize(type);
	}
	switch (type.complex_type) {
	case 'array':
		return checktypenormalize(type.value,uptype);
	case 'dictionary':
		return checktypenormalize(type.key,uptype) && checktypenormalize(type.value,uptype);
	case 'tuple':
		return type.values.every(checktypenormalize,uptype);
	case 'union':
		return type.options.every(checktypenormalize,uptype);
	case 'literal':
		return false;
	case 'type':
		return checktypenormalize(type.type,uptype);
	case 'struct':
		return false;
	}
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
			if (property.override) {
				overridden[property.name] = true;
			}
			if (property.optional) {
				if (property.default != undefined) {
					if (property.default != undefined) {
						if (typeof property.default == 'string') {
							//console.log('default with desc on',prototypename,property.name,'=',property.default);
						} else if (property.default.complex_type == 'literal') {
							//console.log('default literal on',prototypename,property.name,'=',property.default.value);
						}
					}
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

function typenormalizecode(type,uptype) {
	//console.log(type);
	if (typeof type == 'string') {
		if (type == uptype) {
			return false;
		}
		return checkTypenormalize(type);
	}
	switch (type.complex_type) {
	case 'array':
		return checktypenormalize(type.value,uptype);
	case 'dictionary':
		return checktypenormalize(type.key,uptype) && checktypenormalize(type.value,uptype);
	case 'tuple':
		return type.values.every(checktypenormalize,uptype);
	case 'union':
		for (const subtype of type.options) {
			
		}
		return type.options.every(checktypenormalize,uptype);
	case 'literal':
		return;
	case 'type':
		typenormalizecode(type.type,uptype);
	case 'struct':
		if (uptype == undefined) {
			throw 'no uptype';
		}
	}
}

function normalizecode(prototypename) {
	const prototype = namedprototypes[prototypename];
	if (prototype.abstract) {
		return;
	}
	const overridden = {};
	for (const parent of parentchains[prototypename]) {
		for (const property of namedprototypes[parent].properties) {
			if (property.name in overridden) {
				continue;
			}
			if (checktypenormalize(property.type)) {
				return true;
				typenormalizecode(property.type);
			}
			if (property.override) {
				overridden[property.name] = true;
			}
			if (property.optional) {
				if (property.default != undefined) {
					if (property.default != undefined) {
						if (typeof property.default == 'string') {
							console.log(`  ${property.name} = ; // ${property.default}`);
							//console.log('default with desc on',prototypename,property.name,'=',property.default);
						} else if (property.default.complex_type == 'literal') {
							console.log(`  ${property.name} = ${property.default.value};`);
							//console.log('default literal on',prototypename,property.name,'=',property.default.value);
						}
					}
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

for (const prototypename of Object.keys(namedprototypes)) {
	if (checknormalize(prototypename)) {
		//console.log(prototypename);
	}
}

const typesnormalize = {};

for (const typename of Object.keys(namedtypes)) {
	//console.log('typetype',typename);
	if (checkTypenormalize(typename)) {
		typesnormalize[typename] = true;
		//console.log(typename);
	}
}

export {namedprototypes,lists,normalize};