// process data.raw / data.json
// different from process.js

import * as file from "./file.mjs";

const data = await file.read('nulliusdata.json').then(JSON.parse);
const locale = await file.read('nulliuslocale.json').then(JSON.parse);
console.log('got data and locale');

const processed = {};

const itemtypes = [
	'item',
	'ammo',
	'capsule',
	'gun',
	'item-with-entity-data',
	'item-with-label',
	'item-with-inventory',
	'blueprint-book' ,
	'item-with-tags',
	'selection-tool',
	'blueprint',
	'copy-paste-tool',
	'deconstruction-item',
	'upgrade-item' ,
	'module',
	'rail-planner',
	'spidertron-remote',
	'tool',
	'armor',
	'mining-tool',
	'repair-tool',
];

processed.item = {};

for (const itemtype of itemtypes) if (data[itemtype] != null) for (const item of Object.values(data[itemtype])) {
	const pitem = {};
	// do some stuff
	// stack size
	// icon
	// place entity tile equipment
	// subgroup
	// fuel
	// flags
	// rocket launch
	// internal name
	// locale
	// order?
	processed.item[item.name] = pitem;
}

await write('nulliusprocesseddata.json', JSON.stringify(processed));