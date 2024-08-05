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

function getitemproductdata(item_product) {
	if (typeof item_product == 'object'){
		const min_amount = item_product.amount ?? item_product.amount_min;
		const max_amount = item_product.amount ?? Math.max(item_product.amount_max, item_product.amount_min);
		return {
			item: item_product.name,
			amount: (item_product.probability ?? 1) * (min_amount + max_amount) / 2,
		};
	} else {
		return {
			item: item_product[0],
			amount: item_product[1],
		};
	}
}

function getenergyamount(energy) {
	// joules
	const [, amount, , multiplier] = energy.match(/^(\d+(\.\d+)?)([kKMGTPEZY])J$/);
	return (+amount) * { // + to convert string to number (js)
		k: 1000,
		K: 1000,
		M: 1000000,
		G: 1000000000,
		T: 1000000000000,
		P: 1000000000000000,
		E: 1000000000000000000,
		Z: 1000000000000000000000,
		Y: 1000000000000000000000000,
	}[multiplier];
}

// hehehe
for (const itemtype of itemtypes) if (data[itemtype] != undefined) for (const item of Object.values(data[itemtype])) {
	const pitem = {};
	// do some stuff
	// flags
	// i only really care about hidden
	const flags = item.flags ?? [];
	pitem.hidden = flags.includes('hidden');
	// stack size
	pitem.stack_size = item.stack_size; // must be 1 if flags.includes('not-stackable') - i won't check it though
	// icon
	if (item.icons != undefined) {
		const default_icon_size = item.icon_size;
		const icons = [];
		for (const icon of item.icons) {
			icons.push({
				icon: icon.icon,
				icon_size: icon.icon_size ?? default_icon_size,
				tint: icon.tint ?? [1, 1, 1, 1], // no tint
				shift: icon.shift ?? [0, 0],
				scale: icon.scale ?? (32 / (icon.icon_size ?? default_icon_size)), // 256 for tech
				icon_mipmaps: icon.icon_mipmaps ?? 0,
			});
		}
		pitem.icons = icons;
	} else {
		pitem.icons = [{
			icon: item.icon,
			icon_size: item.icon_size,
			tint: [1, 1, 1, 1], // no tint
			shift: [0, 0],
			scale: 32 / item.icon_size,
			icon_mipmaps: item.icon_mipmaps ?? 0,
		}];
	}
	// place entity tile equipment
	if (item.place_result == '' || item.place_result == undefined) {
		pitem.entity = null;
	} else {
		pitem.entity = item.place_result;
	}
	if (item.placed_as_equipment_result == '' || item.placed_as_equipment_result == undefined) {
		pitem.equipment = null;
	} else {
		pitem.equipment = item.placed_as_equipment_result;
	}
	if (item.place_as_tile == undefined) {
		pitem.tile = null;
	} else {
		pitem.tile = item.place_as_tile.result;
	}
	// subgroup / group
	pitem.subgroup = item.subgroup ?? 'other';
	pitem.group = data['item-subgroup'][pitem.subgroup].group;
	// fuel
	if (item.fuel_value != undefined) {
		// gonna ignore the note that says fuel energy is required if the fuel attributes are there
		const fuel = {
			energy: getenergyamount(item.fuel_value),
			burnt: item.burnt_result ?? null,
			category: item.fuel_category,
			acceleration_boost: item.fuel_acceleration_multiplier ?? 1,
			speed_boost: item.fuel_top_speed_multiplier ?? 1,
			emission: item.fuel_emissions_multiplier ?? 1,
		};
		pitem.fuel = fuel;
	} else {
		pitem.fuel = null;
	}
	// rocket launch
	if (item.rocket_launch_products != undefined) {
		const launch_products = [];
		for (const launch_product of item.rocket_launch_products) {
			launch_products.push(getitemproductdata(launch_product));
		}
		pitem.launch_products = launch_products;
	} else {
		if (item.rocket_launch_product != undefined) {
			pitem.launch_products = [getitemproductdata(item.rocket_launch_product)];
		} else {
			pitem.launch_products = null;
		}
	}
	// internal name
	pitem.internal_name = item.name;
	// locale
	pitem.localised = {
		name: null,
		description: null
	};
	// order?
	pitem.order = item.order;
	processed.item[item.name] = pitem;
}

await file.write('nulliusprocesseddata.json', JSON.stringify(processed));