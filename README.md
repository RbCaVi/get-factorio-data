# lua-factorio-data
Generate Factorio's data with JavaScript and Lua.

Steps:
- Create a directory for the data to go in:
```
mkdir <directory>
cd <directory>
```
- Create a file called `pack.json` in that directory with the mods and their versions:
```
{
	"base":
}
```
- Run `bash <lua-factorio-data root>/process.sh <output directory>` to create a folder with `data.json`, `locale.json`, and `assets`