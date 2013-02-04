
if( _.isUndefined(self.fluorine) )
{
    throw new Error('[ERROR] Should include fluorine.utils first.')
}

// ----
// ## Event
// 
// Build a reactive core context.
// All native or user customed events should be forwarded and handled by this context.
//
// Note: because we don't have truely continuous signals, so all triggering things are all events.
//

// Data constructor of this context.
// Should pass in a name of handling event.
//
// :: EventName
self.fluorine.Event = function(name)
{
    return new self.fluorine.Event.o(name)
}

// Inner implement of this context. 
// Override the basic context's version for saving the note name,
// which will be used in the last definition step ( `run` ).
//
self.fluorine.Event.o = function(name)
{
    this.__run_times = 0    // Counter can only initialize once.
    this.__process = new self.fluorine.Process()
    
    // For binding.
    this.__continue_fn = null

    // Will be used in `done`.
    this.__name = name

    // Initialize step only pass the value to the next step.
    this.initialize(name)

    return this
}


// Extends basic the context.
_.extend( self.fluorine.Event.o.prototype, self.fluorine.Context.o.prototype )

// Extends our new functions.
self.fluorine.Event.o.prototype = _.extend
(   self.fluorine.Event.o.prototype
,
{
    // Override exist one to provide more 
    // debug message while the event got triggered.
    //
    // The data will come with the note, so needn't any param.
    //
    // :: Context m,n => m n a -> b -> m n b
    initialize: function()
    {
        this.__process.next
        (   _.bind( function(note)  // Run while note coming.
        {
            // If bound, there is an environment from base context.
            this.__environment = this.__environment || {}
            this.__process.run(note)
        },  this
        ), 'Event::initialize<'+this.__name+'>' )
        return this
    }

    // Override existing version to run this chain only when event triggered.
    // The function return by default `done()` will automatically execute this functon.
    //
    // :: Process b
   ,run: function()
    {
        if( ! this.__done )
        {
            throw new Error("ERROR: The context is not done.");
        }

        // Append a UUID to the note name, so we will not override the original name.
        var id = this.__name+'.'+fluorine.uuid()

        // NOTE: If this event bind other contexts,
        // simpley re-execute it will rebind all contexts.
        // This will cause duplicated inner contexts problem.
        
        // Begin from first step of this context.
        fluorine.Notifier.on(id, _.bind( function(note){
            this.trigger(note)
        }, this )) 
        return this.__process
    }

    // Solution for strange behavior while bind Event in other context:
    //
    // Because Event has two entrypoint: 
    //
    // 1. run() while register it's process to Notifier, 
    // 2. *trigger()* while it got triggered
    //
    // Event context should add one entry function named `trigger` instead simple `run`,
    // and the `trigger` should set a flag in process' "this" to  let the continue function in it's bind to be null,
    // while it got executed by Notifier. 
    //
    // Otherwise, if the process execute via `run`, the flag will be false and the bound continue function 
    // will not be null, and it will continue with the rest part of base context.
    //
    // :: Event -> Process b
    ,trigger: function(e)
    {
        // Don't continue with base context's remain steps.
        this.__continue_fn = null
        this.__process.run(e)
    }
}
)

self.fluorine.registerInfect('Event', self.fluorine.Event)
