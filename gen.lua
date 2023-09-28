json=require('json')

function makestack()
  local t = {}
  t._et = {}

  function t:push(v)
    table.insert(self._et, v)
    return self
  end

  function t:last()
    return self._et[#self._et]
  end

  function t:pop()
    if #self._et ~= 0 then
      local v=self._et[#self._et]
      table.remove(self._et)
      return v
    end
  end
  
  return t
end

-- http://lua-users.org/lists/lua-l/2010-06/msg00313.html
setfenv = setfenv or function(f, t)
  f = (type(f) == 'function' and f or debug.getinfo(f + 1, 'f').func)
  local name
  local up = 0
  repeat
    up = up + 1
    name = debug.getupvalue(f, up)
  until name == '_ENV' or name == nil
  if name then
    debug.upvaluejoin(f, up, function() return name end, 1) -- use unique upvalue
    debug.setupvalue(f, up, t)
  end
end

local modules={}

function newrequire(requiredname)
  local required=requiredname

  if required:match('/') then
    if not required:match('%.lua$') then
      required=required .. '.lua'
    end
  else
    required=required:gsub('%.','/') .. '.lua'
  end
  
  print(modroots['core'] .. '/lualib/' .. required)

  if required:match('^__.-__/') then
    print(1)
    local modn,fpath=required:match('^__(.-)__/(.*)')
    modname:push(modn)
    filepath:push(fpath)
  else
    print(3)
    if filepath:last() then
      local filedir=filepath:last():match("(.-)([^/]-[^%.]+)$")
      if io.open(modroots[modname:last()] .. '/' .. filedir .. '/' .. required, 'r') then
        modname:push(modname:last())
        filepath:push(filedir .. '/' .. required)
      elseif io.open(modroots[modname:last()] .. '/' .. required, 'r') then
        modname:push(modname:last())
        filepath:push(required)
      elseif io.open(modroots['core'] .. '/lualib/' .. required, 'r') then
        print(2)
        modname:push('core')
        filepath:push('lualib/' .. required)
      else
    print(modname:last(),filepath:last())
        error('no module named ' .. required)
      end
    --elseif modname:last() and io.open(modroots[mod]name:last() .. '/' .. required, 'r') then
    --  modname:push(modname:last())
    --  filepath:push(required)
    elseif io.open(modroots['core'] .. '/lualib/' .. required, 'r') then
      print(2)
      modname:push('core')
      filepath:push('lualib/' .. required)
    else
    print(modname:last(),filepath:last())
      error('no module named ' .. required)
    end
  end
  
  local result
  local path=modroots[modname:last()] .. '/' .. filepath:last()
  local mkey=path .. '@@' .. modname:last()
  if false and modules[mkey] then
    print('cached',path)
    result=modules[mkey]
  else
    print('requiring',path)
    local f,err=loadfile(path)
  
    if not f then print(err) end
    
    setfenv(f,newenv)

    result=f()
    modules[mkey]=result
  end

  modname:pop()
  filepath:pop()

  return result
end

local f=io.open('modroots.json','r')
modroots=json.decode(f:read('*a'))
f:close()

modname=makestack()
filepath=makestack()

function table_size(t)
  local count=0
  for _,_ in pairs(t) do
    count=count+1
  end
  return count
end

newenv={
  math=math,
  string=string,
  table=table,
  debug=debug,
  _VERSION=_VERSION,
  assert=assert,
  error=error,
  ipairs=ipairs,
  next=next,
  pairs=pairs,
  pcall=pcall,
  select=select,
  tonumber=tonumber,
  tostring=tostring,
  type=type,
  unpack=unpack,
  xpcall=xpcall,
  setmetatable=setmetatable,
  getmetatable=getmetatable,
  rawset=rawset,
  rawget=rawget,
  rawequal=rawequal,
  require=newrequire,
  log=print,
  serpent=require('serpent'),
  table_size=table_size,
}

local fdata=require('fdata')

newenv.defines=fdata.defines

newenv._G=newenv

local modinfo={}

for mod,modroot in pairs(modroots) do
  print(modroot .. '/info.json')
  local f=io.open(modroot .. '/info.json','r')
  local data=f:read('*a')
  f:close()
  local info=json.decode(data)
  modinfo[mod]=info
end

-- setup mods table
local mods={}

for mod,info in pairs(modinfo) do
  mods[mod]=info.version
end

newenv.mods=mods

-- http://notebook.kulchenko.com/algorithms/alphanumeric-natural-sorting-for-humans-in-lua
function natsort(o)
   local function conv(s)
      local res, dot = "", ""
      for n, m, c in tostring(s):gmatch"(0*(%d*))(.?)" do
         if n == "" then
            dot, c = "", dot..c
         else
            res = res..(dot == "" and ("%03d%s"):format(#m, m)
                                  or "."..n)
            dot, c = c:match"(%.?)(.*)"
         end
         res = res..c:gsub(".", "\0%0")
      end
      return res
   end
   table.sort(o,
      function (a, b)
         local ca, cb = conv(a), conv(b)
         return ca < cb or ca == cb and a < b
      end)
   return o
end

-- https://lua-users.org/wiki/StringTrim
function trim(s)
   return s:match'^()%s*$' and '' or s:match'^%s*(.*%S)'
end

function getdepname(dep)
  local parts={}
  for s in trim(dep):gmatch("%S+") do
    table.insert(parts,s)
  end
  if parts[1]=='?' or parts[1]=='(?)' then
    return parts[2]
  end
  return parts[1]
end

-- sort mods

local deps={'core'} -- core always loads first
local sortedmods={'core'}

while true do
  local newlayer={}
  for mod,info in pairs(modinfo) do
    if not sortedmods[mod] then
      local valid=true
      for _,dep in pairs(info.dependencies) do
        local depname=getdepname(dep)
        print(dep,depname)
        if mods[depname] then
          if not sortedmods[depname] then
            valid=false
            break
          end
        end
      end
      if valid then
        table.insert(newlayer,mod)
      end
    end
  end
  if #newlayer==0 then
    break
  end
  newlayer=natsort(newlayer)
  for _,mod in ipairs(newlayer) do
    table.insert(deps,mod)
    sortedmods[mod]=true
  end
end

-- setup data table
newrequire('dataloader')

local dataraw=newenv.data.raw

for _,ptype in pairs(fdata.types) do
  dataraw[ptype]={}
end



-- settings stage
for _,mod in ipairs(deps) do 
  print(modroots[mod] .. '/settings.lua')
  local f=io.open(modroots[mod] .. '/settings.lua','r')
  if f then
    f:close()
    newrequire('__' .. mod .. '__.settings')
  end
end
for _,mod in ipairs(deps) do 
  local f=io.open(modroots[mod] .. '/settings-updates.lua','r')
  if f then
    f:close()
    newrequire('__' .. mod .. '__.settings-updates')
  end
end
for _,mod in ipairs(deps) do 
  local f=io.open(modroots[mod] .. '/settings-final-fixes.lua','r')
  if f then
    f:close()
    newrequire('__' .. mod .. '__.settings-final-fixes')
  end
end

function getsettingvalue(setting,value)
  if setting.type=='bool-setting' then
    if setting.hidden then
      if setting.forced_value~=nil then
        return setting.forced_value
      end
    end
    if value~=nil then
      return value
    end
    return setting.default_value
  elseif setting.type=='int-setting' then
    if value~=nil then
      if math.mod(value,1)~=0 then
        -- nothing
      elseif setting.allowed_values then
        if #setting.allowed_values==1 then
          return setting.allowed_values[1]
        end
        for _,v in pairs(setting.allowed_values) do
          if value==v then
            return value
          end
        end
      elseif setting.minimum_value or setting.maximum_value then
        if (setting.minimum_value and value>=setting.minimum_value) and (setting.maximum_value and value<=setting.maximum_value) then
          return value
        end
      else
        return value
      end
    end
    return setting.default_value
  elseif setting.type=='double-setting' then
    if value~=nil then
      if setting.allowed_values then
        if #setting.allowed_values==1 then
          return setting.allowed_values[1]
        end
        for _,v in pairs(setting.allowed_values) do
          if value==v then
            return value
          end
        end
      elseif setting.minimum_value or setting.maximum_value then
        if (setting.minimum_value and value>=setting.minimum_value) and (setting.maximum_value and value<=setting.maximum_value) then
          return value
        end
      else
        return value
      end
    end
    return setting.default_value
  elseif setting.type=='string-setting' then
    if value~=nil then
      if setting.allowed_values then
        if #setting.allowed_values==1 then
          return setting.allowed_values[1]
        end
        for _,v in pairs(setting.allowed_values) do
          if value==v then
            return value
          end
        end
      else
        if value=='' and setting.allow_blank then
          return value
        end
        if setting.auto_trim then
          value=trim(value)
        end
        return value
      end
    end
    return setting.default_value
  elseif setting.type=='color-setting' then
    if value~=nil then
      return value
    end
    return setting.default_value
  end
end

-- setup settings table
local f=io.open('settings.json','r')
local settingsdata
if f then
  local data=f:read('*a')
  f:close()
  settingsdata=json.load(data)
else
  settingsdata={}
end

local settings={}
settings.startup={}

for _,stype in pairs({'bool','int','double','string','color'}) do
  print(dataraw)
  for k,v in pairs(dataraw) do
    print(k)
  end
  if dataraw[stype .. '-setting'] then
    for settingname,setting in pairs(dataraw[stype .. '-setting']) do
      if setting.setting_type=='startup' then
        local value=getsettingvalue(setting,settingsdata[settingname])
        settings.startup[settingname]={value=value}
      end
    end
  end
end

print(json.encode(settings))

newenv.settings=settings

-- data stage
for _,mod in ipairs(deps) do 
  local f=io.open(modroots[mod] .. '/data.lua','r')
  if f then
    f:close()
    newrequire('__' .. mod .. '__.data')
  end
end
for _,mod in ipairs(deps) do 
  local f=io.open(modroots[mod] .. '/data-updates.lua','r')
  if f then
    f:close()
    newrequire('__' .. mod .. '__.data-updates')
  end
end
for _,mod in ipairs(deps) do 
  local f=io.open(modroots[mod] .. '/data-final-fixes.lua','r')
  if f then
    f:close()
    newrequire('__' .. mod .. '__.data-final-fixes')
  end
end

-- dump to file
local f=io.open('data.json','w')
local data=json.encode(newenv.data.raw)
f:write(data)
f:close()
