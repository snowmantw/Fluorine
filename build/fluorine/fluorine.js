
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

if( _.isUndefined(self.fluorine) )
{
    throw new Error('[ERROR] Should include fluorine.utils first.')
}

// These functions exist because Javascript provide some asynchronous ways 
// to execute the program, but support no mechanism to control in-order and 
// out-of-order parts well.
//
// We must ensure each asynchronous action and its callback will suspend 
// and resume the whole process in the end of their steps.
//
// And, functions in this file are at low-level, and thus not a part of 
// functional programming.

// Creating function that create a new process.
self.fluorine.Process = function()
{
    self.fluorine.registerInfect('Process', self.fluorine.Process)
    return new self.fluorine.Process.o();
}

// DO NOT USE. IT'S ONLY FOR INSTANCE.
self.fluorine.Process.o = function()
{
    this.__result = null
    this.__queue = []
    this.__recycle_queue = []
}

// Set the next step.
//
// next:: (Process fs, (a->b), StepName {- optional -} ) -> Process ( a->b )
self.fluorine.Process.o.prototype.next = function(fn, name)
{
    // Function is NOT object for other users, so we can add attr and don't worry about conflicts.
    fn.__name = name    
    this.__queue.push(fn)
}

// Concat two "process".
//
// concat:: (Process fs, Process gs) -> Process fgs
self.fluorine.Process.o.prototype.concat = function(proc)
{
    this.__queue = this.__queue.concat(proc.__queue);
}

// Prepend another process' steps.
//
// preconcat:: (Process fs, Process gs) -> Process gfs
self.fluorine.Process.o.prototype.preconcat = function(proc)
{
    this.__queue = proc.__queue.concat(this.__queue);
}

// Execute the next function.
// The function will receive the result of current run,
// and set it as the result of this process.
//
// The next function will receive the result as it's (only one) argument.
//
// Note any other temporary results should be storaged in other places.
//
// Note for the convience of the lack of tuple,
// this function allow user variable arguments as a tuple.
// But if there is only one argument, the result still in the single argument mode.
//
// This result is the final result of whole monad, 
// and will be replaced by any value passed in, 
// even the undefined ( call with no arguments ).
//
// run:: Process ( a->b ) -> b | Tuple -> Process b | Tuple
self.fluorine.Process.o.prototype.run = function(result)
{
    // Tuple | 0 or 1
    if( 2 <= arguments.length )
    {
        this.__result = []
        for( var i in arguments)
        {
            this.__result.push(arguments)
        }
    }
    else
    {
        this.__result = result
    }

    if( 0 == this.__queue.length )
    {
        return ;
    }

    var __fn = this.__queue.shift()
    this.__recycle_queue.push(__fn)

    // The function will call next function to run, 
    // if it's not the end of the process.

    try{
        // TODO: Should use logger and debugging level...
        fluorine.logger()('[DEBUG] Process executing step #'+(this.__recycle_queue.length - 1)
                            +', step name(if any): '+__fn.__name
                            +' ( call with ),', arguments
                         )

        __fn.apply({}, arguments)
    } catch(e)
    {
        // Print multiple times when this step is deep in stack.
        if( _.isUndefined(e.__printed) )
        {
            fluorine.logger()('[ERROR] Process terminated at step #'+(this.__recycle_queue.length - 1)+', step name(if any): '+__fn.__name, e)
            e.__printed = true
        }
        //debugger
        throw e
    }
}

// Refresh the process. Make it runnable again.
//
// refresh:: Process fs
self.fluorine.Process.o.prototype.refresh = function()
{
    // FIXME:
    // Push all left steps in queue into refreshed queue.
    // 
    // This loop works only when a process be refreshed before it got done.
    // The contextes need not it.
    /*
    while( 0 != this.__queue.length )
    {
        var step = this.__queue.shift()
        console.log('[DEBUG] Adding left step in original queue, step #'+(this.__recycle_queue.length - 1)+', step name(if any): '+step.__name)
        this.__recycle_queue.push(step)
    }
    */
    this.__queue = this.__recycle_queue
    this.__recycle_queue = []
}

// Extract the last result of called functions.
//
// extract:: Process ( a->b ) -> b
self.fluorine.Process.o.prototype.extract = function()
{
    return this.__result;    
}

self.fluorine.registerInfect('Process', self.fluorine.Process)

/**
 * -- Programmer's Hidden Notes --

Actions(proc)   -- 表示此 action chain 在哪個 proc 內 
.action()       -- 其他 action 都只需要把自己的執行函式推入 proc 中
                -- 而這個執行函式中有一段是去 call 下一個 proc 內的執行函式
                -- 用 proc.run() 去執行
.actionAsync()  -- 到這邊，把自己內部的 proc 設定在 callback 內。 
                -- callback 會在執行階段被執行。屆時，他會繼續去執行剩下的 proc actions.
                -- 因此，剩下的部份只有在經過了 callback 時才會被執行
                --
                -- 執行 async 動作
                -- callback：中間有一段是執行 proc.run()
.action()
.action();

*/



if( _.isUndefined(self.fluorine) )
{
    throw new Error('[ERROR] Should include fluorine.utils first.')
}

//
// The Notifier is the core of fluorine at low-level.
// Every cross-components computation should use notification rather than directly call each other.
// Every notification will be handled asynchronized, even though this is implementation depended.
//
// It's also a Context, so user can use fluent interface to call it, and compose the action.
//
// ----
//
// ## Notifier

// The namespace objects.

self.fluorine = self.fluorine || {}
self.fluorine.Notifier = {}

//
// Initialize the notifier.
// If there're registered handlers in previous notifier,
// they will be wiped out
//
// init:: Notifier n 
self.fluorine.Notifier.init = function()
{
    self.fluorine.Notifier.trie = {};
    return self.fluorine.Notifier;
}

//
// Register a handler on a note. 
// Override existing binding function if the `str_names` is the same, and provide no context/id.
// 
// The last argument, "context", can be any object, 
// and the callback will be called with it as context.  
// 
// The note is namespaced, so if a note "abc.de" triggered, 
// handlers bound on "abc.de.gh" will also be triggered.
//
// on:: Notifier n -> ( NoteName, (note -> a), Context ) -> Notifier n'
self.fluorine.Notifier.on = function(str_names, cb, context)
{
    if( "" == str_names )
    {
        return; // don't allow the empty name, even though it will match "all" notes.
    }
    self.fluorine.EventTrie.set
    (   self.fluorine.Notifier.trie, str_names, 
        function(note)
        {   
            cb.call(context, note); 
        }
    );

    return self.fluorine.Notifier;
}

//
// Trigger a note. The format of a note is
//  
//      {name: "namespaced.note.name", <key>: <value>}
//
// Only the "name" filed is required.
//
// trigger:: Notifier n -> Note -> Notifier n
self.fluorine.Notifier.trigger = function(note)
{
    // note is a single string.
    if( "string" == typeof note )
    {
        note = {'name': note}; 
    }

    var cbs = self.fluorine.EventTrie.match(self.fluorine.Notifier.trie, note.name);
    for( var itr = 0; itr != cbs.length; itr++)
    {

        var cb = cbs[itr];
        cb.call(null,note);

        // Implement async calling.
        // It cause some problems, and I can only freeze it until do a exhausted check.
        // OK, it's bad to use global variable. But how can I do this without it ?
        //__st__ = setTimeout(function(){ cb.call(null,note); clearTimeout(__st__); },0);
    }

    return self.fluorine.Notifier;
}

//
// Remove a handler from Notifier.
// The name of note is still namespaced. 
// So if the parent got removed, children under the name will also be removed.
//
// off:: Notifier n -> NoteName -> Notifier n
self.fluorine.Notifier.off = function(str_names)
{
    self.fluorine.EventTrie.remove(self.fluorine.Notifier.trie, str_names);
}

// ## Inner structure of fluorine.Notifier
//
// DO NOT USE. IT'S ONLY FOR IMPLEMENTS.

self.fluorine.EventTrie = {};

self.fluorine.EventTrie.set = function(tree, str_names, cb)
{
    self.fluorine.EventTrie.doSet(tree, str_names.split('.'), cb);
}

self.fluorine.EventTrie.doSet = function(tree, names, cb)
{
    var entry = tree[names[0]];
    if(1 == names.length)
    {
        if( _.isUndefined(entry) )
        {
            tree[names[0]]= {'__data__': cb};
        }
        else
        {
            tree[names[0]]['__data__'] = cb
        }
        return;
    }

    // No such subtrie yet, create it.
    if( _.isUndefined(entry) )
    {
        tree[names[0]] = { '__data__': null};
    }
    self.fluorine.EventTrie.doSet(tree[names[0]], names.slice(1), cb);
}

self.fluorine.EventTrie.remove = function(tree, str_names)
{
    self.fluorine.EventTrie.doRemove(tree, str_names.split('.'));
}

self.fluorine.EventTrie.doRemove = function(tree, names)
{
    var entry = tree[names[0]];
    if(1 == names.length)
    {
        // delete all related objects.
        delete tree[names[0]];
        return; 
    }

    if( ! _.isUndefined(entry) )
    {
        self.fluorine.EventTrie.doRemove(tree[names[0]], names.slice(1));
    }
}

self.fluorine.EventTrie.match = function(tree, name)
{
    return self.fluorine.EventTrie.doMatch(tree, name.split('.'));
}

self.fluorine.EventTrie.doMatch = function(tree, names)
{

    if(0 == names.length)
    {
        return self.fluorine.EventTrie.getNodes(tree, []);
    } 

    var entry = tree[names[0]];
    if( _.isUndefined(entry) )
    {
        //throw new Error("ERROR: Match nothing in EventTrie. name: "+names[0]);
        return [];
    }

    return self.fluorine.EventTrie.doMatch( entry, names.slice(1) );
}

// get all nodes after matching point.
self.fluorine.EventTrie.getNodes = function(tree, mem)
{
    if( null != tree.__data__ )
    {
        mem.push(tree.__data__);
    }
    for( var idx in tree )
    {
        if( "__data__" != idx )
        {
            self.fluorine.EventTrie.getNodes( tree[idx], mem );
        }
    }
    return mem;
}

self.fluorine.registerInfect('Notifier', self.fluorine.Notifier)

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

if( _.isUndefined(self.fluorine) )
{
    throw new Error('[ERROR] Should include fluorine.utils first.')
}

// ----
// ## UI
// 
// UI context provide `UI DOM` and other methods.
// This context wrapping jQuery's methods, so it dependens on jQuery.
//

// Data constructor of this context.
// Context constructor should be able to receive anything,
// while contexted functions can has type constrains.
//
self.fluorine.UI = function(a)
{
    return new self.fluorine.UI.o(a)
}

// Inner implement of this context.
//
self.fluorine.UI.o = function(a)
{   
    self.fluorine.Context.o.call(this, a) 
}

// Statics functions.
_.extend( self.fluorine.UI.o,
{
    __jquery_mapped: false

    // Mapping jQuery's monadic methods to this context.
    // Use these functions just like in jQuery. The main difference is that these functions become lazy. 
    //
    // :: UI r -> UI r
    ,__mapjQuery: function(uicontext)
    {
        var names = [ 'animate', 'addClass', 'after', 'append'
                    , 'appendTo', 'attr' , 'before'
                    , 'css', 'contents'
                    , 'clone', 'detach', 'empty'
                    , 'children','parents','parent'
                    , 'fadeIn', 'fadeOut'
                    , 'hide'
                    , 'height', 'html', 'innerHeight'
                    , 'innerWidth', 'insertAfter', 'insertBefore'
                    , 'offset', 'outerHeight', 'outerWidth'
                    , 'prepend', 'prependTo', 'position', 'remove'
                    , 'removeAfter', 'removeClass', 'removeProp'
                    , 'replaceAll', 'replaceWith', 'scrollLeft'
                    , 'show'
                    , 'scrollTop', 'text', 'toggleClass'
                    , 'unwrap', 'val', 'wrap', 'width'
                    , 'wrap', 'wrapAll', 'wrapInner'
                    , 'filter', 'not', 'eq', 'has'
                    ]

       _.each( names, function(name)
       {    uicontext[name] = 
            function()
            {   var args = _.map(arguments, function(a){return a})
                args.name = name 
                fluorine.UI.o.__delegate.call(this, args) 
                return this;
            }
       })
    }

    // This function will be filled in the mapped functions.
    //
    // :: UI s -> *args (with 'name' property) -> ()
   ,__delegate: function(args)
    {
        this.__process.next
        (   _.bind
            (   function(dom_prev)
            {   // The original way is unshift the name in before this runtime step,
                // and shift the name out here.
                //
                // But if we modify such definition-time variable,
                // we can't recovery it after refresh the process of this monad.
                var name = args.name    


                // jQuery functions will use selected DOM as 'this' .
                // This kind of functions should be library-independend; 
                // using jQuery as default is just for convenience.
                //
                var dom_result = jQuery(dom_prev)[name].apply(dom_prev, args)
                this.__process.run(dom_result)
            }
            ,   this
            )
        ,   'UI::__delegate<'+args.name+'>'
        )
    }
}
)


// Extends basic the context.
_.extend( self.fluorine.UI.o.prototype, self.fluorine.Context.o.prototype )

// Extends our new functions.
// Depend on jQuery.ajax, may be decoupled in near future.
self.fluorine.UI.o.prototype = _.extend
(   self.fluorine.UI.o.prototype
,
{
    // Use the restricted jQuery to manipulate some DOMs.
    // And select elements. 
    //
    // Can accept `Selector = DOM d | String s` type.
    //
    // $:: UI Selector -> UI [DOM]
    $: function()
    {
        // Mapping jQuery methods while needing.
        if( ! this.__jquery_mapped) { fluorine.UI.o.__mapjQuery(this) }

        this.__process.next
        (   _.bind(function(slc)
        {
           this.__process.run(jQuery(slc))
        }, this)
        , 'UI::$')

        return this
    }

    // Find a DOM from the root of document.
    // Will discare previous result.
    //
    // Note this function is different from jQuery's find, because we don't provide stateful `end` function.
    // This `find` is more like open file from a path, which also has global view.
    //
    // To manipulate selected elements' set, use 'select' function.
    // 
    // find:: UI a -> Selector -> UI [DOM]
    ,find: function(selector)
    {
        this.__process.next
        (  _.bind(function(a)
        {
           this.__process.run(jQuery(selector))
        }, this)
        , 'UI::find')

        return this
    }

    // Will choose elements from previous step's result set.
    // This actually use jQuery's `find` to do selection, so select things beyond the set is possible,
    // but use it is unwise.
    //
    // select:: UI [DOM] -> Selector -> UI [DOM]
    ,select: function(selector)
    {
        this.__process.next
        (  _.bind(function(set)
        {
           this.__process.run(jQuery(set).andSelf().find(selector))
        }, this)
        , 'UI::select')

        return this
    }

    // Forward native event as a reactive event.
    // User should give the original event and the forwarding note's name,
    // then once the original event got triggered, the forwarding note will named as user given,
    // and bring all key/value pairs in the original event.
    //
    // @see `fluorine.Notifier` to get more informations about notifications.
    //
    // This function exists because the gap between ideal reactive pattern and the unperfect reality.
    //
    // :: UI DOM -> EventName -> ( Event  -> String ) -> UI DOM
   ,forward: function(name, fwd)
    {
        this.__process.next 
        (   _.bind(function(dom)
        {
           if( 'ready' == name)
           {
                jQuery('document').ready( function(){
                    fluorine.Notifier.trigger({name: fwd({})})
                })
                this.__process.run(dom)
           }
           else
           {
               this.__process.run(jQuery(dom).bind(name, function(e){
                    fluorine.Notifier.trigger(_.extend(e, {name: fwd(e)}))
               }).get(0)) 
           }
        }, this)
        , 'UI::forward')
        
        return this
    }
}
)

self.fluorine.registerInfect('UI', self.fluorine.UI)

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

// ----
// ## Export
//
// Export module following the CommonJS spec.
// This file should be the bottom of the merged file.
//

if('undefined' == typeof exports){ exports = self}
exports.fluorine = self.fluorine

