
self.fluorine = self.fluorine || {}

// ----
// ## Utils 
//
// Some `fluorine` module functions.
//

// Put fluorine contexts to window/self scope.
// After infecting, user can directly call `Context()...` without prefix `fluorine.`
//
// Infect can be healed, and conflicts will be resolved.
//
self.fluorine.infect = function()
{
    self.fluorine.infect.__original = {}
    _.each
    (   self.fluorine.infect.__registry
    ,   function(context, name)
    {
        self.fluorine.infect.__original[name] = self[name]
        self[name] = context
    }
    )
}

// Heal the infection.
//
self.fluorine.heal = function()
{
    if( undefined === self.fluorine.infect.__original ) 
    {
        return 
    }   

    _.each
    (   self.fluorine.infect.__original
    ,   function(orig, name)
    {
        self[name] = orig
    }
    )
}

// Register all contexts for infecting/healing
//
// :: Name -> Context -> ()
self.fluorine.registerInfect = function(name, context)
{
    if( undefined === self.fluorine.infect.__registry )
    {
        self.fluorine.infect.__registry = {}
    }
    self.fluorine.infect.__registry[name] = context
}

// Turn debugging mode on/off.
// Return whether mode on/off.
// 
// :: Boolean | None -> Boolean
self.fluorine.debug = function(mode)
{
    if( undefined != mode )
    {
        self.fluorine.debug.__debug = mode 
    }
    return self.fluorine.debug.__debug
}

// Logger functions for whole fluorine.
// Return the logger function. 
// Default one is print out everything unless debug is off.
//
// :: (String -> IO ()) | None -> (String -> IO())
self.fluorine.logger = function(logger)
{
    if( undefined != logger )
    {
        self.fluorine.logger.__logger = logger   
    }
    
    // Default logger log everything while debug mode is on.
    if( undefined == self.fluorine.logger.__logger )
    {
        self.fluorine.logger.__logger = function(str)
        {
        if( fluorine.debug() )
        {
            console.log(str)               
        }}
    }
    return self.fluorine.logger.__logger
}

// Generate UUID.
// 
// Codes from: http://blog.snowfinch.net/post/3254029029/uuid-v4-js
//
// :: UUID
self.fluorine.uuid = function()
{
    var uuid = "", i, random
    for (i = 0; i < 32; i++) {
        random = Math.random() * 16 | 0

        if (i == 8 || i == 12 || i == 16 || i == 20) {
          uuid += "-"
        }
        uuid += (i == 12 ? 4 : (i == 16 ? (random & 3 | 8) : random)).toString(16)
    }
    return uuid
}
