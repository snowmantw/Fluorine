
if( undefined === self.fluorine )
{
    throw new Error('[ERROR] Should include fluorine.utils first.')
}

// ----
// ## Socket 
// 
// Basic Socket context, provide simple socket events forwardings.
// It (may) also provide some basic functions to let developer construct sub-protocols ( in near future !) .
//

// Data constructor of this context.
// Context constructor should be able to receive anything,
// while contexted functions can has type constrains.
//
self.fluorine.Socket = function(a)
{
    return new self.fluorine.Socket.o(a)
}

// Inner implement of this context.
//
self.fluorine.Socket.o = self.fluorine.Context.o

// Extends basic the context.
_.extend( self.fluorine.Socket.o.prototype, self.fluorine.Context.o.prototype )

// Extends our new functions.
// Depend on jQuery.ajax, may be decoupled in near future.
self.fluorine.Socket.o.prototype = _.extend
(   self.fluorine.Socket.o.prototype
,
{
    // Open a socket with specific URL.
    //
    // :: URL -> [ Protocol ] -> Socket Handler 
    connect: function(url, protocols)
    {
        this.__process.next
        (   _.bind( function()
        {
            this.__process.run(new WebSocket(url, protocols))
        },  this)
        ,   'Socket::connect')
        return this
    }

    // Send data ( Blob, String, ArrayBuffer ) to server.
    //
    // SocketData = SocketData Blob String ArrayBuffer
    // :: Socket Handler -> SocketData -> Socket Handler
   ,send: function( data )
    {
        this.__process.next
        (   _.bind( function(socket)
        {
            socket.send(data)
            this.__process.run(socket)
        },  this)
        ,   'Socket::connect')
        return this
    }

    // Close the socket.
    //
    // :: Socket Handler -> CodeNumber -> String -> Socket ()
   ,close: function(code, reason)
    {
        this.__process.next
        (   _.bind( function(socket)
        {
            socket.close(code, reason)
            this.__process.run()
        }
        ),  'Socket::close')
    }

    // Forward Socket event as a reactive event. 
    // User should pass a filter function, which receive `SocketEvent` and generate a note's name.
    // This function will generate a notificaiton named with filter generated, with flattern data from the event.
    //
    // @see `fluorine.Notifier` to get more informations about notifications.
    //
    // This function exists because the gap between ideal reactive pattern and the unperfect reality.
    //
    // Note: the filter will receive below types of SocketEvent, 
    // and the data constructor will become string name without suffix 'Event'.
    //
    // SocketEvent = MessageEvent Data Handler| CloseEvent Code Reason WasClean Handler| OpenEvent Handler | ErrorEvent Handler
    //
    // :: Socket Handler -> (SocketEvent -> String) -> Socket Handler
   ,forward: function(filter)
    {
        this.__process.next 
        (   _.bind(function(socket)
        {
            socket.addEventListener('open', function(e)
            {
                var name = filter('open', handler)
                fluorine.Notifier.trigger({'name': name})           
            })

            socket.addEventListener('error', function(e)
            {
                var name = filter('error', handler)
                fluorine.Notifier.trigger({'name': name})           
            })

            socket.addEventListener('close', function(e)
            {
                var name = filter('close', e.code, e.reason, e.wasClean, handler)
                fluorine.Notifier.trigger(_.extend(e, {'name': name}))
            })
            
            socket.addEventListener('message', function(e)
            {
                var name = filter('message', e.data, handler)
                fluorine.Notifier.trigger(_.extend(e, {'name': name}))
            })

            this.__process.run(socket)

        }, this)
        , 'Socket::forward')
        
        return this
    }
}
)

self.fluorine.registerInfect('Socket', self.fluorine.Socket)
