# Generate Factorio's data in mostly Lua

Steps:
- Create a folder to hold the mods
- Put all the mods (including dependencies, base, and core) in that folder
- Run `get-factorio-data.sh <factorio base version>` to generate fdata.lua
- Run `gen.lua <mods folder> fdata` to generate data.json
