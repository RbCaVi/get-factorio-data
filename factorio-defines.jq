# convert lua-api.factorio defines table into lua code
def f($prefix):
  $prefix+"."+.name as $prefix|
  $prefix+"={}",( # assign the base object first
    if .values? then # if this has values
      .values|.[]| # take each of values
      $prefix+"."+.name| # make the full name (defines.wire_type.red)
      .+"=\""+.+"\"" # make an assignment (defines.wire_type.red="defines.wire_type.red")
    elif .subkeys? then # if it has subkeys instead
      .subkeys|.[]| # take each subkey
      f($prefix) # apply this function to it
    else
      []|.[] # special case for defines.prototypes
    end
  );

"local defines={}", # the base defines object
(.defines|.[]|f("defines")) # the sub-defines
