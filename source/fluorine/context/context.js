
if( _.isUndefined(self.fluorine) )
{
    throw new Error('[ERROR] Should include fluorine.utils first.')
}

// ----
// ## Context
//
// Basic context should be extended by other contexts.
//
// Provide following features:
//
// - Embedded environment, provide `this` and `as()` to let bound function access it.
// - Basic lambda ( `_` ) and `tie` function.
// - Basic `done` function which return another function to execute the context, 
//   and do process refreshing for executing the context repeately.  
//
// How to extend it:
//
// - Let your context ( 'IO' for example ) extend `fluorine.Context` to get all static functions,
//   include the basic inner implement function `o` . 
// - Let your inner implement function extend the extended one.
// - Make sure your context's constructor function will return the right inner implement function. 
// - Define your own `run` function if your want to use the default `done()` as a run Context function. 
//   The default one will only execute all steps in process; you may wish to add more features to it.
//
// Please note our context embedded a process to handle asynchronous execution,
// so the return value of contexts will not be a straght forward datum, but a `(Process datum)`.
//


// Data constructor of this context.
// Context constructor should be able to receive anything,
// while contexted functions can has type constrains.
//
self.fluorine.Context = function(a)
{

    return new self.fluorine.Context.o(a)
}

// Inner implement of this context.
//
self.fluorine.Context.o = function(a)
{
    this.__run_times = 0    // Counter can only initialize once.
    this.__process = new self.fluorine.Process()
    
    // For tieing.
    this.__continue_fn = null

    // Initialize step only pass the value to the next step.
    this.initialize(a)

    return this
}

self.fluorine.Context.o.prototype =
{   
    // It should only bind pure functions. 
    //
    // :: Context m,n => m n a -> ( a -> b ) -> m n b
    _: function(fn)
    {
        this.__process.next
        (   _.bind( function(val)
        {
            this.__process.run(fn.call(this.__environment,val))
        },  this
        ), 'Context::_' )
        return this
    }   

    // Help function to name a value in this context's inner environment.
    //
    // :: m n a -> String -> m n a
   ,as: function(name)
    {
        this.__process.next
        (   _.bind( function(val)
        {
            this.__environment[name] = val
            this.__process.run(val)
        },  this
        ), 'Context::as' )
        return this
    }

    // @2013-01-17 22:44:10+08:00
    //
    // NOTE: This is NOT a real MonadTransformer bind.
    // It still can tie another context and execute them correctly,
    // so we keep it in here for convience.
    //
    // The real MonadTransformer version should be
    // :: Context m,n => m n a -> ( a -> m n b ) -> m n b
    //
    // Besides, it also means our context should be initialized with a fixed inner context as it's `n`.
    //
    // ----
    //
    // Bind another context as inner context.
    // Bound function ( context generator ) can access the inner environment.
    // The generated context should be done.
    //
    // :: Context m,n => m a -> ( a -> n b ) -> m b
   ,tie: function(gen)
    {
        this.__process.next
        (   _.bind( function(val)
        {   
            // Pattern:  ----          ----     ...    base  context
            //              |----||----|  |---- ...    inner context
            //
            var inner = gen.call(this.__environment,val)

            // Common mistake check.
            if( ! _.isFunction(inner) ){ throw "Binding an undone context or just not a context."}
            
            // Can't just execute the inner and get value. 
            // because IO context haven't `extract()`, 
            // and can't let outside get it's value. 
            // 
            // Especially our IO context need to handle asynchronous calls.
            // Instead, we get the process inside context, and run it's first step as the next step.
            // Then insert a "return" step, let the context return to the base context.
            //
            
            // Pass base context' environment to inner context.
            // Note: Even though cloning it is more proper, but cost time to do that seems unecessary.
            // 

            // Receive inner context's result and continue executing this base monad.
            // @see Context.done and `Context._`
            inner
            (   _.bind( function(a)
            {
                // The last step of inner monad should already transform it as base monad,
                // just like type signature require: ( a -> m n b ).
                // 
                // And this context is a very basic context, so there is no need to check whether 
                // the pass out context legal or not.  
                this.__process.run(a)
            }
            , this
            )
            , this.__environment)()

        },  this
        ), 'Context::tie, next level --> ' )
        return this
    } 

    // Try to implement real transformer's bind.
    //
    // :: Context m,n => m n a -> ( a -> m n b ) -> m n b
    ,bind: function(act)
    {
        this.__process.next
        (   _.bind( function(na)    
        {
            // Will receive `n a`, because we're in `m` context.
            // And we don't know how to extract `n a` to `a`, actually.
            
            // m ( `n a` >>= (a -> m n b)) == m (n a) -> m (m n b),
            // then `unit` the later: we got it.

        }
        ), 'Context::bind')
    }

    // Initialize environment and others.
    //
    // :: Context m,n => m n a -> b -> m n b
   ,initialize: function(a) 
    {
        this.__process.next
        (   _.bind( function()
        {
            // If bound, there is an environment from base context.
            this.__environment = this.__environment || {}
            this.__process.run(a)
        },  this
        ), 'Context::initialize' )
        return this
    }

    // Variant lambda, for simulate the 'let..in' syntax feature. 
    // User must chain `as()` after this function.
    //
    // The function can receive previous result as lambda. 
    // The only difference is this lambda must chain `as()` after.
    //
    // let ... as:: Pass a function return any value, and named it in this context's environment. 
    //
    // :: Context m,n => m n a -> ( a -> b ) -> m n b
   ,let: function(fn)
    {
        this._(fn)
        return {'as': _.bind(this.as, this) }
    }   

    // Run all steps in this context.
    // The function return by default `done()` will automatically execute this functon.
    //
    // :: Process b
   ,run: function()
    {
        if( ! this.__done )
        {
            throw new Error("ERROR: The context is not done.");
        }
        
        // Begin from first step of this context.
        this.__process.run()
        return this.__process
    }

    // Close this context and ready to run.
    //
    // :: ( Context m, Context n, Process b )  => m n a -> ( () -> b )
   ,done: function()
    {
        // Already done.
        if( this.__done ) { return }
        this.__done = true

        // The last step of this context.
        this.__process.next
        (   _.bind( function(a)
        {
            this.__process.run(a)   // as the result.
            this.__process.refresh()
            this.__run_times ++

            // If we want to continue the process:
            if( null != this.__continue_fn )
            {
                this.__continue_fn(a)
            }
        },  this
        ), 'Context::done' )


        // If continue: 
        // - User can only run this process because the return function
        // - User run it with continue function
        // - The continue step got executed after whole steps inside this context got executed
        // - Continues steps of base context got execute
        return _.bind( function(continue_fn, base_env)
        {
           // Don't run context, but set continue function and return self.
           if( continue_fn )
           {
               this.__continue(continue_fn, base_env)
               return _.bind(this.run, this)  // Delegate calling to the tied function.
           }
           return this.run()
        }, this)
    }

   // Inner implement function.
   // Inject a continue function into this context's step, 
   // and avoid directly running after this context got `done`.
   // 
   // The function should receive a process value ( this context's result ),
   // and will generate a new process, which let this context can run it.
   // 
   // The caller should pass the base context's environment, too.
   // This can ensure inner context's steps executing under base context's environment.
   // 
   // :: ( Context m, Context n, Process b, Process c ) => 
   //    m n b -> ( b -> Environment e -> c ) -> () 
   ,__continue: function( continue_fn, base_env )
   {
        this.__continue_fn = continue_fn
        this.__environment = base_env
   }
}

self.fluorine.registerInfect('Context', self.fluorine.Context)
