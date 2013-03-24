
// For Node.js environment.
// These lines will be the header of merged 'fluorine.js'.
//
if( 'undefined' != typeof require )
{
    _ = require('underscore')
}
self = ( 'undefined' == typeof self ) ?  {} : self 
self.fluorine = ( _.isUndefined(self.fluorine) ) ?  {} : self.fluorine

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
    if( 'undefined' != typeof window){ global = self }
    self.fluorine.infect.__original = {}
    _.each
    (   self.fluorine.infect.__registry
    ,   function(context, name)
    {
        self.fluorine.infect.__original[name] = global[name]
        global[name] = context
    }
    )
    global['fluorine'] = self.fluorine
}

// Heal the infection.
//
self.fluorine.heal = function()
{
    if( _.isUndefined(self.fluorine.infect.__original) ) 
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
    if( _.isUndefined(self.fluorine.infect.__registry) )
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
    if( ! _.isUndefined(mode) )
    {
        self.fluorine.debug.__debug = mode 
    }
    return self.fluorine.debug.__debug
}

// Logger functions for whole fluorine.
// Return the logger function. 
// Default one is print out everything unless debug is off.
//
// :: ((String,Object) -> IO ()) | None -> ((String,Object) -> IO())
self.fluorine.logger = function(logger)
{
    if( ! _.isUndefined(logger) )
    {
        self.fluorine.logger.__logger = logger   
    }
    
    // Default logger log everything while debug mode is on.
    if( _.isUndefined(self.fluorine.logger.__logger) )
    {
        self.fluorine.logger.__logger = function(str, obj)
        {
        if( fluorine.debug() )
        {
            console.log(str, obj) 
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

// Useful for reduce anonymous functions
//
// :: m a -> (a -> m a)
self.fluorine.idGen = function(ma)
{
    return function(){return ma}
}

self.fluorine.registerInfect('idGen', self.fluorine.idGen)
