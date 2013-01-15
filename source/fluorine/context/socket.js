
if( _.isUndefined(self.fluorine) )
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
self.fluorine.Socket.o = function(a){ self.fluorine.Context.o.call(this, a) }

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
    // :: Socket a -> URL -> [ Protocol ] -> Socket Handler
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
    // If the connection is not established, send after it done.
    //
    // SocketData = SocketData Blob String ArrayBuffer
    // :: Socket Handler -> SocketData -> Socket Handler
   ,send: function( data )
    {
        this.__process.next
        (   _.bind( function(socket)
        {
            if( 1 != socket.readyState )
            {
                socket.addEventListener('open', function(){
                    socket.send(data)
                })
            }
            else
            {
                socket.send(data)
            }
            this.__process.run(socket)
        },  this)
        ,   'Socket::connect')
        return this
    }

    // Close the socket. If the connection is not established, close after it done.
    //
    // :: Socket Handler -> CodeNumber -> String -> Socket ()
   ,close: function(code, reason)
    {
        this.__process.next
        (   _.bind( function(socket)
        {
            if( 1 != socket.readyState )
            {
                socket.addEventListener('open', function(){
                    socket.close()
                })
            }
            else
            {
                socket.close(code, reason)
            }
            this.__process.run()
        }, this)
        ,  'Socket::close')
        return this
    }

    // Forward Socket event as a reactive event. 
    // User should pass a filter function, which receive `SocketEvent` and generate a note's name.
    // This function will generate a notificaiton named with filter generated, with flattern data from the event.
    //
    // Note the filter should return `undeinfed`, if the event not fit the filter.
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
    // :: Socket Handler -> (SocketEvent -> Maybe String) -> Socket Handler
   ,forward: function(filter)
    {
        this.__process.next 
        (   _.bind(function(socket)
        {
            socket.addEventListener('open', function(e)
            {
                var name = filter('open', socket)
                if( ! _.isUndefined(name) )
                {
                    fluorine.Notifier.trigger({'name': name})           
                }
            })

            socket.addEventListener('error', function(e)
            {
                var name = filter('error', socket)
                if( ! _.isUndefined(name) )
                {
                    fluorine.Notifier.trigger({'name': name})           
                }
            })

            socket.addEventListener('close', function(e)
            {
                var name = filter('close', e.code, e.reason, e.wasClean, socket)
                if( ! _.isUndefined(name) )
                {
                    fluorine.Notifier.trigger(_.extend(e, {'name': name}))
                }
            })
            
            socket.addEventListener('message', function(e)
            {
                var name = filter('message', e.data, socket)
                if( ! _.isUndefined(name) )
                {
                    fluorine.Notifier.trigger(_.extend(e, {'name': name}))
                }
            })

            this.__process.run(socket)

        }, this)
        , 'Socket::forward')
        
        return this
    }
}
)

self.fluorine.registerInfect('Socket', self.fluorine.Socket)
