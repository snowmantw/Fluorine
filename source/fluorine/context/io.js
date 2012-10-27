
if( undefined === self.fluorine )
{
    throw new Error('[ERROR] Should include fluorine.utils first.')
}

// ----
// ## IO
// 
// Basic IO context provide file CRUD operations.
//
// Provide following features:
// 
// - CRUD methods like get/getBinary/getBinaryFile, post, put, delete
// - Turn lowlevel asynchronous function calls become "fake" synchronous process, to avoid callback hell
//

// Data constructor of this context.
// Context constructor should be able to receive anything,
// while contexted functions can has type constrains.
//
self.fluorine.IO = function(a)
{
    return new self.fluorine.IO.o(a)
}

// Inner implement of this context.
//
self.fluorine.IO.o = self.fluorine.Context.o

// Extends basic the context.
_.extend( self.fluorine.IO.o.prototype, self.fluorine.Context.o.prototype )

// Extends our new functions.
self.fluorine.IO.o.prototype = _.extend
(   self.fluorine.IO.o.prototype
,
{
    get: function()
    {
        
    }

    ,getBinary: function()
    {
        
    }

    ,getBinaryFile: function()
    {
        
    }

    ,post: function()
    {
        
    }
    
    ,put: function()
    {
        
    }
    
    ,delete: function()
    {
        
    }
}
)
