
// ----

// ## Socket
//
// Socket monad should be both a event forwarding and computation monad.
//
// Just like open a file and return it's handler, other functions receiving 
// socket notifications will get the socket monad itself, and can do more 
// things then handle only the notification.
// 
// EX. 
//      // This initializing monad will be executed and starting forward event.
//
//      var mSInit = function(addr)
//      {   Socket(addr).connect().forward('server-event')('note-a')....toEnvironment()
//      }
//      Environment().bind(mSInit).done().run()
//
// User can think the Socket computation as an "asynchronous" IO processing.
// In IO monad:
//  
//      openFile >>= \handle -> ( do something ...) >>= \handle -> close handle 
//
// All steps are synchronouse in this IPO chain. But similiar IPOs in socket are asynchronous, 
// especially it uses events to trigger all handlers:
//
//      var socket = 
//      socket.on('event-server-1', function(){ socket.emit() })..
//      socket.on('event-server-N', function(){...})
//      socket.close()
//
// These steps composing a IPO chain, but they do all things asynchronously.
// And steps are based on events, not like fluorine.IO, events in it are in order. 
// ( even though they're asynchronous for other "process" ).
//
// So we must make the Socket another Event forwarding and computation mixed monad.
//

//
// Construct the socket. Passing address ( "127.0.0.1:654" ) or handler.
//
// data AddressOrHandler = Address | SocketHandler
// Socket:: SocketAddress ( AddressOrHandler ) 
//
// ----
//
// Note: The constructor can accept SocketHandler as context handling target, too. 
// This behavior is for the convience while handling asynchronous sending-receiving model.
//
// Example:
//
//      //(receiver of notification, if the constructor disallow passing SocketHandler in)
//      function(note){ (note.socket.forward().send().... ) } 
//
//      //(if UI constructor allow passing SocketHandler in)
//      function(note){ Socket(note.socket).forward().send().... ) } 
//
// The second function shows the target will be handled in the UI context.
// It's better than the first version.
//
fluorine.Socket = function(addrORhandler)
{
    return new fluorine.Socket.o(addrORhandler)
}

fluorine.Socket.o = function(addrORhandler)
{
    this.__done = false

    // Because our monads are `Monad (Process a)`, not `Monad a`
    this.__proc = fluorine.Process()


    // Pass an initialize step to enclose variables.
    //
    this.__proc.next
    (   _.bind
        ( function()
        { this.__proc.run(addrORhandler)  
        } 
        , this
        )
    )

    this.__init_arguments = arguments

    return this
}

// connect:: Socket SocketAddress -> Socket SocketHandler
fluorine.Socket.o.prototype.connect = function()
{
    this.__proc.next
    (   _.bind
        ( function(address)
        {   var socket = new WebSocket(address) // TODO: Sub-protocols supports ? 
            this.__proc.run(socket)
        }
        ,   this
        )
    )

    return this
}

// disconnect:: Socket SocketHandler -> Socket ()
fluorine.Socket.o.prototype.disconnect = function()
{
    this.__proc.next
    (   _.bind
        ( function(socket)
        { 
            socket.close()
            this.__proc.run()
        }
        )
    )
    return this
}

// Forward native WebSocket events as notifications.
// WebSocket events: open, message, error, close.
// 
// Note: we will append 'note.handler' to the notification as a SocketHandler reference,
// and the 'note.name' to pass the name of event.
//
// Note: because the original socket onmessage event only gurrantee that the receiver will get the data,
// the handler must parse the data and forward sub-notes if it's necessary.
//
// forward:: Socket SocketHandler -> EventName -> MessageName -> Socket SocketHandler
fluorine.Socket.o.prototype.forward = function(ename)
{
    // Because native events should be bound in these methods:
    // onmessage, onopen, onclose; we must convert String ename into method name and call them.

    var md_name = 'on'+ename

    return _.bind
    (   function(mname)
    {   this.__proc.next
        (   _.bind
            (   function(socket)
            {   
                var fnForward = function(event)
                {   var note = event || {}
                    note.name = mname
                    note.handler = socket
                    fluorine.Notifier.trigger(note)
                }
                socket[md_name] = fnForward
                
                this.__proc.run(socket)
            }  
            ,   this
            )
        )

        return this
    }   // MessageName
    ,   this
    )
}

//
// Send string-like data. Include String, ArrayBuffer or Blob.
//
// data Rope = String | ArrayBuffer | Blob
// Socket SocketHandler -> Rope -> Socket SocketHandler
fluorine.Socket.o.prototype.send = function(rope)
{
    this.__proc.next
    (   _.bind
        (   function(socket)
        {
            socket.send(rope)
            this.__proc.run(socket)
        }
        ,   this
        )
    )
    return this
}

fluorine.Socket.o.prototype.done = function()
{
    if( this.__done ) { return }
    this.__done = true;

    // The last step of this process should be restoring it.
    this.__proc.next
    (   _.bind
        ( function()
        {
             this.__proc.refresh()
             var proc_new = this.__proc
             var $old = this.__$
             this.constructor.apply(this, this.__init_arguments)

             // Set the selector. Previous statement, the constructor, will also reset the process,
             // and we still need the old one to keep the result.
             this.__proc = proc_new

             // The 'done' flag will also be reset
             this.__done = true
          }
        , this 
        )
    )
    return this;
}

fluorine.Socket.o.prototype.run = function()
{
    if( ! this.__done )
    {
        throw new Error("ERROR: The monad is not done.")
    }

    // This will run the whole process, 
    // and it's only useful when this function is at the end of whole process.
    this.__proc.run()
    return this.__proc
}

// "Undo" the last step ( done() ) of this monad.
// The monad MUST be closed.
//
// unclose:: Socket s -> Socket s
fluorine.Socket.o.prototype.unclose = function()
{
    if( ! this.__done )
    {
        throw new Error("ERROR: The monad is not done.")
    }

    // FIXME: Dirty way. 
    // But I don't want to provide a public interface of process queue.
    this.__proc.__queue.pop()

    return this
}
