
if( _.isUndefined(self.fluorine) )
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
self.fluorine.IO.o = function(a){ self.fluorine.Context.o.call(this, a) }


// Statics functions.
_.extend( self.fluorine.IO.o,
{
    // Generate a function to receive ajax result.
    // 
    // :: Process a -> ( a -> TextStatus -> XHR ) -> IO ()
    __genAjaxSuccess: function(proc)
    {
        return function(data, textStatus, jqXHR)
        {   
            // Resume execition after receiving.
            proc.run(data)
        }
    }
    
    // Will throw error while ajax request got failed.
    //
    // :: URL -> Query -> ( XHR -> TextStatus -> Error ) -> IO ()
   ,__genAjaxError: function(url, qry)
    {
        return function(jqXHR, textStatus, errorThrown)
        {   var msg = "ERROR: IO error in request: "+qry+" on "+url
            console.error(msg, errorThrown)
            throw new Error(msg);
        }
    }

    // Default Ajax request function handling binary formats.
    // 
    // DataType:: ArrayBuffer | Blob 
    // :: Process a -> URL -> Query -> DataType -> Request
   ,__binaryAjax: function( proc, url, query, type)
    {   var request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = type;
        request.addEventListener
        (  'load'
        ,  function() 
           {   self.fluorine.IO.o.
                __genAjaxSuccess(proc)(request.response, request.statusText, request) 
           }
        )
        request.addEventListener
        (   'error'
        ,  function(event) 
           {   self.fluorine.IO.o.
                __genAjaxError(url)(request, request.statusText, event) 
           }
        )
        return request
    }

    // Make XMLHttpRequest chainable.
    // Effects hidden, and not to provide this feature yet.
    //
    // :: IO r -> IO r
   ,__wrapRequest: function(io)
    {
        var fnames =
        [   'addEventListener'
        ,   'open', 'setRequestHeader'
        ,   'send', 'abort'
        ]

        var anames =
        [   'timeout'
        ,   'upload' 
        ,   'withCredentials'
        ]

        _.each
        (   fnames
        ,   function(fname)
        {
            // Append new request functions in that IO context.
            io[fname] = _.bind( function()
            {   var args = arguments
                this.__process.next
                (   _.bind(function(req)
                {   
                    // Lazy execute/set request and pass it out.
                    req[fname].apply(req, args)
                    this.__process.run(req)
                }, this)
                , 'IO::'+fname
                )
            },  io)
        }
        )

        _.each
        (   anames
        ,   function(aname)
        {
            // Append new setter functions in that IO context.
            // Return the attr value if the passed attr is undefined.
            io[aname] = _.bind( function(attr)
            {   
                (   _.bind(function(req)
                {   
                    if( ! _.isUndefined(attr) )
                    {
                        req[aname] = attr
                        this.__process.run(req)
                    }
                    else    // Return value.
                    {
                        this.__process.run(req[aname])
                    }
                }, this)
                , 'IO::'+aname
                )
            },  io)
        }
        )
    }
}
)

// Extends basic the context.
_.extend( self.fluorine.IO.o.prototype, self.fluorine.Context.o.prototype )

// Extends our new functions.
// Depend on jQuery.ajax, may be decoupled in near future.
self.fluorine.IO.o.prototype = _.extend
(   self.fluorine.IO.o.prototype
,
{
    // Get text data according to URL and Query. 
    //
    // :: URL -> IO Text 
    get: function(url)
    {
        this.__process.next
        (   _.bind(function()
        {
            var process = this.__process
            var request = new XMLHttpRequest()
            request.open('GET', url, true)
            request.responseType = 'text'
            request.addEventListener
            (  'load'
            ,  function() 
               {   self.fluorine.IO.o.
                    __genAjaxSuccess(process)(request.response, request.statusText, request) 
               }
            )
            request.addEventListener
            (   'error'
            ,  function(event) 
               {   self.fluorine.IO.o.
                    __genAjaxError(url)(request, request.statusText, event) 
               }
            )
            request.send()

        }, this)
        ,  'IO::get')
        
        return this
    }

    // Get binary data in ArrayBuffer according to URL and Query.
    // 
    // :: URL -> IO ArrayBuffer
   ,getBinary: function(url)
    {
        this.__process.next
        (   _.bind(function()
        {
            var process = this.__process
            var request = new XMLHttpRequest()
            request.open('GET', url, true)
            request.responseType = 'arraybuffer'
            request.addEventListener
            (  'load'
            ,  function() 
               {   self.fluorine.IO.o.
                    __genAjaxSuccess(process)(request.response, request.statusText, request) 
               }
            )
            request.addEventListener
            (   'error'
            ,  function(event) 
               {   self.fluorine.IO.o.
                    __genAjaxError(url)(request, request.statusText, event) 
               }
            )
            request.send()

        },  this)
        ,   'IO::getBinary')
        
        return this
    }

    // Get binary data in Blob according to URL and Query.
    //
    // :: URL -> IO Blob
   ,getBinaryFile: function(url)
    {
        this.__process.next
        (   _.bind(function()
        {
            var process = this.__process
            var request = new XMLHttpRequest()
            request.open('GET', url, true)
            request.responseType = 'blob'
            request.addEventListener
            (  'load'
            ,  function() 
               {   self.fluorine.IO.o.
                    __genAjaxSuccess(process)(request.response, request.statusText, request) 
               }
            )
            request.addEventListener
            (   'error'
            ,  function(event) 
               {   self.fluorine.IO.o.
                    __genAjaxError(url)(request, request.statusText, event) 
               }
            )
            request.send()

        },  this)
        ,   'IO::getBinaryFile')
        
        return this
    }

    // Post previous IO handling result to URL.
    // Will automatically convert data as FormData.
    // Key/Value paris will automatically transform to form data.
    //
    // :: ( NotBinary r ) => IO r -> URL -> IO ()
    ,post: function(url)
    {
	this.__process.next
	(   _.bind(function(data)
	{
            var process = this.__process
            var request = new XMLHttpRequest()
            request.open('POST', url, true)

            var formData = new FormData()
            if( _.isObject(data))
            {
                _.chain(data).keys(data).each(function(k){formData.append(k, data[k]) })
            }
            else
            {
                formData.append(data,"")    // Like jQuery
            }

            request.addEventListener
            (  'load'
            ,  function() 
               {   self.fluorine.IO.o.
                    __genAjaxSuccess(process)(request.response, request.statusText, request) 
               }
            )
            request.addEventListener
            (   'error'
            ,  function(event) 
               {   self.fluorine.IO.o.
                    __genAjaxError(url)(request, request.statusText, event) 
               }
            )
            request.send(formData)

	},  this)
	, 'IO:post')

	return this
    }
    
    // Post binary data to URL. Include ArrayBuffer and Blob.
    //
    // :: ( Binary r ) => IO r -> URL -> IO
   ,postBinary: function(url)
    {
	this.__process.next
	(   _.bind(function(data)
	{
            var process = this.__process
            var request = new XMLHttpRequest()
            request.open('POST', url, true)
            request.addEventListener
            (  'load'
            ,  function() 
               {   self.fluorine.IO.o.
                    __genAjaxSuccess(process)(request.response, request.statusText, request) 
               }
            )
            request.addEventListener
            (   'error'
            ,  function(event) 
               {   self.fluorine.IO.o.
                    __genAjaxError(url)(request, request.statusText, event) 
               }
            )
            request.send(data)

	},  this)
	, 'IO:postBinary')

	return this
    }

    // Put previous IO handling result to URL.
    // Will automatically convert data as FormData.
    // Key/Value paris will automatically transform to form data.
    //
    // :: ( NotBinary r ) => IO r -> URL -> IO ()
    ,put: function(url)
    {
	this.__process.next
	(   _.bind(function(data)
	{
            var process = this.__process
            var request = new XMLHttpRequest()
            request.open('PUT', url, true)

            var formData = new FormData()
            if( _.isObject(data))
            {
                _.chain(data).keys(data).each(function(k){formData.append(k, data[k]) })
            }
            else
            {
                formData.append(data,"")    // Like jQuery
            }

            request.addEventListener
            (  'load'
            ,  function() 
               {   self.fluorine.IO.o.
                    __genAjaxSuccess(process)(request.response, request.statusText, request) 
               }
            )
            request.addEventListener
            (   'error'
            ,  function(event) 
               {   self.fluorine.IO.o.
                    __genAjaxError(url)(request, request.statusText, event) 
               }
            )
            request.send(formData)

	},  this)
	, 'IO:put')

	return this
    }

    // Put binary data to URL. Include ArrayBuffer and Blob.
    //
    // :: ( Binary r ) => IO r -> URL -> IO ()
    ,putBinary: function(url)
    {
	this.__process.next
	(   _.bind(function(data)
	{
            var process = this.__process
            var request = new XMLHttpRequest()
            request.open('PUT', url, true)

            request.addEventListener
            (  'load'
            ,  function() 
               {   self.fluorine.IO.o.
                    __genAjaxSuccess(process)(request.response, request.statusText, request) 
               }
            )
            request.addEventListener
            (   'error'
            ,  function(event) 
               {   self.fluorine.IO.o.
                    __genAjaxError(url)(request, request.statusText, event) 
               }
            )
            request.send(data)

	},  this)
	, 'IO:put')

	return this
    }
    
    // Delete resources representing via the URL.
    //
    // :: URL -> IO ()
    ,delete: function(url)
    {
	this.__process.next
	(   _.bind(function()
	{
            var process = this.__process
            var request = new XMLHttpRequest()
            request.open('DELETE', url, true)

            request.addEventListener
            (  'load'
            ,  function() 
               {   self.fluorine.IO.o.
                    __genAjaxSuccess(process)(request.response, request.statusText, request) 
               }
            )
            request.addEventListener
            (   'error'
            ,  function(event) 
               {   self.fluorine.IO.o.
                    __genAjaxError(url)(request, request.statusText, event) 
               }
            )
            request.send()

	},  this)
	, 'IO:delete')

	return this
    }

    // Do your dirty works here to elimate the gap between ideal and reality.
    //
    // :: IO a -> ( a -> IO b ) -> IO b
    ,unsafe: function(fn)
    {
        return self.fluorine.IO.o._(fn)
    }
}
)

self.fluorine.registerInfect('IO', self.fluorine.IO)
