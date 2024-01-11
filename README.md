# get-factorio-data
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
	"base":{}
}
```
- Run `node <get-factorio-data root>/process.js` to create `data.json`, `locale.json`, and `assets` in the folder
