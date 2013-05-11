
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
            if( ! _.isFunction(inner) ){ throw "Tying an undone context or just not a context."}
            
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

            // Receive inner context's result and continue executing this base monad after the inner done.
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


    // Concurrently execute this action chain.
    //
    // This function will immediately return, then execute the next step.
    // The target action chain will execute asynchronously.
    //
    // It's almost the same with normal `tie` version.
    // 
    // :: Context m,n => m a -> ( a -> n b ) -> m b
    ,fork: function(gen)
    {
        this.__process.next
        (   _.bind( function(val)
        {   
            var inner = gen.call(this.__environment,val)
            if( ! _.isFunction(inner) ){ throw "Tying an undone context or just not a context."}
            
            // Execute the inner context and don't wait it.
            _.defer( function(){inner()} )

            // TODO: Maybe we can Use immdiately returning worker to get more close to real fork.
            // But still can't put the subchain in the worker because limitation of WebWorker.

            // Execute the next step immediately.
            this.__process.run(val)

        },  this
        ), 'Context::tie, next level --> ' )
        return this
    }

    // Try to implement real bind like transformer's.
    //
    // :: Context m,n => m n a -> ( a -> m n b ) -> m n b
    /*
    ,bind: function(act)
    {
        this.__process.next
        (   _.bind( function(na_run)    
        {
            // As normal transformer described, the `bind` will receive a inner monadic function,
            // and we should embedded our judgement function of base monad in it's context.
            //
            // @see `MaybeT` examples in most guides about monad transformer. 

            // Note: `na_run` is a function which an receive a function as the next step after execute itself.
            // This is described in the `done` function ( see what it return ).
            //
            // We simulate the embedded binding processing with our Process and continue mechanism.

            na_run
            ( _.bind( function(ma_run)
            {
                // Ok, we can access to `ContextM a`, the `na`'s result.
                // We should decide how to continue with this result,
                // just like the `MaybeT` does.

                // This continue function simply pass `fn` ;
                // we should execute it with `ma` result and get the next `m n a`;
                // this next context's `n a` should pass to `this.__process.run` to 
                // continue this process (and be used again). 
                // Again, this is because we implement this bind in a static/runtime system,
                // so we need to care about continuation of the process.

                // And please note we don't do any special thing to handle the `na` inside this context.
                // Other context should override this default implement to use the true power of transformer.

                // Now: 
                // "Extract" `ma` without any judgement.

                // Note: extract from IO will cause problem. So I can understand why no `IOT` which will embedded an `IO` in.
                // But in our contexts, asynchonous contexts are still the problem
                ma_run( _.bind( function(a)
                {
                    // -> M n a means THIS should be a state with such sig. and `na` inner is ok enough.
                    mnb_run = act(a)

                    // We must get `n b` and pass it to next step, rather than `m n b`
                    mnb_run
                    ( _.bind( function(nb)
                    {
                       this.__process.run(nb)
                    }, this))
                }, this))

            }, this)) 

        },  this
        ), 'Context::bind')
    }
    */

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

    // Wrap done context chain to avoid redundant generator function.
    //
    // Use this as:
    //
    //      UI().tie( UI('body').$().text('a').idgen() ).done() 
    //
    // Instead of:
    //
    //      UI().tie( idGen( UI('body').$().text('a') ) ).done() 
    //
    // And the concat trick is still workable:
    //
    //      var uis = _.reduce(data, function(datum)
    //      {
    //          return mem.bind( UI(datum)._(function(){ /* Do actions. */ }).done() ).done()
    //
    //      }, UI().done())
    //
    //      return uis.idgen()
    //
    // Because remenbering to close parenthesis is a annoying thing.
    //
    // :: ( Context m, Context n, Process b )  => m n a -> ( () -> ( () -> b) )
    ,idgen: function()
    {
        var r = _.bind( function()
        {
            return this.done()

        }, this)

        return r
    }

    // Close this context and ready to run.
    //
    // :: ( Context m, Context n, Process b )  => m n a -> ( () -> b )
   ,done: function()
    {
        // Already done.
        if( this.__done ) { return }
        this.__done = true

        // ** Runtime Stage **
        
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

        // ** Definition Stage **

        // After definition, return a function to let user choose evaluate this context immediately or later.
        //
        // User may also pass a function in as the continue function. In this case:
        //
        // - User run the context with the continue function
        // - The continue step got executed after all steps inside this context got executed
        
        var done_fn = 
        _.bind( function(continue_fn, base_env)
        {
           // Don't run context, but set continue function and return self.
           if( continue_fn )
           {
               this.__continue(continue_fn, base_env)
               return _.bind(this.run, this)  // Delegate the call to the tied function.
           }
           return this.run()
        }, this)

        /** Definition stage, see comments below **/

        done_fn.tie = _.
        bind
        (function()
        {
            this.__done = false
            this.__process.__queue.pop()
            return this.tie.apply(this, arguments)
        }
        , this)
        return done_fn

        // Attach a simple `tie` function to the `done_fn`
        // allow user to concat other contexts. For example:
        //
        // Haskell: 
        //
        //      s = getLine         -- ::IO String
        //      g = putStrLn        -- ::String -> IO ()
        //      h = s >>= g         -- OK
        //
        // Fluorine ( with pseudo functions ):
        //
        //      s = IO().getLine().done()
        //      g = function(str){ IO(str).putStrLine().done() }
        //      h = s.tie(g)                    // NOT OK if we close the context.
        //
        //
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
