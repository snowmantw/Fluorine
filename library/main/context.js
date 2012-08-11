
// Basic contexts.
// These contextes reply on Notifier and Environment.
// Third-party libraries requirements: underscore and jQuery.ajax 
// ( the later one will be replaced in near future )

//----
//
// ## Environment

// Return a prototype to bulding rest part of the monad.
//
fluorine.Environment = function(env_init){
    return new fluorine.Environment.o(env_init)    
}

// DO NOT USE: It's for instancing the monad.
fluorine.Environment.o = function(env_init){

    this.__done = false;
    this.__env_current = env_init || {};

    // Note that the real result ( can be accessed by others )
    // should be placed in the process, not those directly value in the monad.
    //
    // Because our monads are `Monad (Process a)`, not `Monad a`
    this.__proc = fluorine.Process()

    return this;
}

// Execute the computation and renew the environmment.
//
// The function will execute under the current environment,
// so it can directly use all registered values by 'this' .
//
// Example:
//
//      fluorine.Environment({a: 1, b: function(){console.log(2.5)}, c: "foo"})
//              .local(function(){ this.a += 10; this.b(); console.log(this.c); return {'a':a}; })
//      // The new environment r' will be `{'a':10+1}`
//
// Note: Yes, this is not a real local scope. It may be implemented in near future.
//
// Note: The fn will receive nothing. All function in this monad should pass nothing to its next.
//
// local:: Environment r -> ( r -> r' ) -> Environment r'
fluorine.Environment.o.prototype.local = function(fn){

    // This function will let the fn execute with new environment,
    // and return with a new environment.

    this.__proc.next
    (    _.bind
         (  function()
            {    // Execute the function under the environment.
                 this.__env_current = fn.call( this.__env_current )

                 // Pass it as result.
                 this.__proc.run(this.__env_current)
            }
         ,  this
         )
    )

    return this;
}

// NOT classical operator "bind" in Haskell.
//
// Execute the inner action in the environment,
// and get the result as new environment.
//
// The action will receive a environment,
// which will be the "this" in it's scope. 
//
// Note: The action MUST return an Environment monad.
// Means it should handle the final transformation between 
// inner moand and the base monad.
//
// bind:: Environment r1 (m r2) 
//     -> ( r1 -> Environment r1 (m r2) ) 
//     -> Environment r1 (m r2)
fluorine.Environment.o.prototype.bind = function(act){

    // The action will take environment in this as it's "this" 
    // ( what the environment monad should does ).
    //
    // Get the constructed moand from action.
    //
    // Note: this will not run the monad, 
    // but construct it.
    this.__proc.next
    (   _.bind
        (   function()
            {   // Generate the inner monad with it's processing queue,
                // which contains all functions will be executed.
                var monad_inner = act.call(this.__env_current)
                var proc_inner  = monad_inner.__proc

                // Setup the final step of inner monad's processing queue.
                // It will get the result of inner monad, and context switch to base monad again.
                //
                // Note the result of inner monad should be the new environment of 
                // the next function in the base monad's processing queue.
                proc_inner.next
                (   _.bind
                    (   // The previous step of inner monad should pass data required by the base monad. 
                        function(env) 
                        {   // context switching and executing the rest parts of base monad.
                            this.__env_current = env
                            this.__proc.run(env)   
                        }
                    ,   this    // the base monad
                    )
                )

                // Add all steps from inner to base monad.
                // This will dynamic change the process while it's running.
                this.__proc.preconcat(proc_inner)

                // The callbacks of inner monad will still access to the old proc,
                // not the merged one. It's terrible to change another monad's inner state,
                // but I can't find other better ways to do solve this problem.
                //
                monad_inner.__proc = this.__proc    // The base moand's inner process ( merged )
                this.__proc.run(this.__env_current)
            }
        ,   this
        )
    );

    return this;
}

// Close this action. 
//
// done:: Environment r 
fluorine.Environment.o.prototype.done = function(){

    this.__done = true;

    return this;
}


// Run this monad . If this monad is not done, throw an Error.
//
// User should aware that the value is still hidden in the process,
// and can't be instanced in the outside world.
// 
// The only way to use the value is create another action to take the process,
// and use inside it. But this will create a temporary variable, 
// which contains the process and will be pased to the next action.
//
// run:: Environment (Process a) -> Process a
fluorine.Environment.o.prototype.run = function(){

    if( ! this.__done )
    {
        throw new Error("ERROR: The action is not done.")
    }

    // This will run the whole process, 
    // if every functions in the process will call its next. 
    //
    // Even though the functions in our queue need no arguments,
    // passing it let us follow the specification. 
    this.__proc.run(this.__env_current)
    return this.__proc
}


//----
//
// ## IO

// Return a prototype to bulding rest part of the action.
//
// Each functions in this monad will receive result from the previous function,
// no matter whether the previous one is aschronous or not. 
//
// Our `IO` monad mixed the environment monad,
// so the result of previous function can be assigned 
// as a named variable in the next function's environment.
//
fluorine.IO = function(){
    return new fluorine.IO.o() 
}

// DO NOT USE: It's for instancing the action.
fluorine.IO.o = function(){

    this.__done = false
    this.__env = {}
    this.__proc = fluorine.Process()

    return this
}

// Close this monad. 
//
// done:: IO r 
fluorine.IO.o.prototype.done = function(){

    this.__done = true

    return this
}

//
// Naming the result value of this IO.
// User can use this named value in functions required by `compute` and `bind`
//
// This concept is "stealed" from the Environment monad.
// It's for conveniences.
//
// Example:
//
//      IO().get("/testFoo")
//          .as("foo")
//          .get("/testBar")
//          .as("bar")
//          .compute( function(){ return this.foo + this.bar }  )
//          .done()
//
// as:: IO r -> Name -> IO r
fluorine.IO.o.prototype.as = function(name){

    this.__proc.next
    (   _.bind
        (   function(prev)
            {   this.__env[name] = prev
                this.__proc.run(prev)
            }
        ,   this
        )
    )

    return this
}

//
// Get a resource from server or other repo.
// If the URL isn't a local URL, this function will try to use Ajax with HTTP GET method to load it.
//
// Note: The current version only support remote URL.
//
// Note: There are some similar functions can be used. 
//
// get:: IO r -> ( ResourceEntry, NameResource, Query ) -> IO r'
fluorine.IO.o.prototype.get = function( url , name_res, query){

    // This function involves asynchronous execution,
    // and will stop the main thread after the request be sent.
    //
    // The rest part of this action will only be executed after the request 
    // have been responsed. This is implemented by register the rest part with
    // a resource note, so it will be invoked when the request return.
    //
    this.__proc.next
    (   _.bind
        (   function()
            {   // Use these callback to construct our request,
                // and send it out.
                var success = _.bind
                (   function(data, textStatus, jqXHR)
                    {   // resume execute.
                        this.__proc.run(data)
                    }
                ,   this
                )

                var error = _.bind
                (   function(jqXHR, textStatus, errorThrown)
                    {   var msg = "ERROR: IO error in request: "+entry_res
                        console.error(msg, errorThrown)
                        throw new Error(msg);
                    }
                ,   this
                )

                // The callback will trigger the "endpoint" of previous process.
                // Note: We will rewrite this with other IO protocols and decouple with jQuery.ajax .
                jQuery.ajax({
                      url: url,
                      data: query,
                      success: success,
                      error: error
                })
            }
        ,   this
        )
    )  // this.__proc.next  #

    // This whole thing ( async process in Javascript which lacks conditional wait )
    // can only be finished in weird way.
    // 
    // Or if we can use Javascript 1.7+, maybe we can eliminate this nightmare by `yield` and 
    // other coroutine functions. But IE and some other browsers do not support it.
    //
    return this
}

// Update the data in server, from the value in this IO action. 
// It will use PUT method. 
// 
// Will send the note `{ name: "resource.send_done."+name_res, <name_res>: data}` 
// after successfully send the data out.
//
// update:: IO r -> ( URL, NameResource ) -> IO r'
fluorine.IO.o.prototype.update = function( url, name_res ){

    this.__proc.next
    (   _.bind
        (   function()
            {   // Use these callbacks to construct our request,
                // and send it out.
                var success = _.bind
                (   function(data, textStatus, jqXHR)
                    {   // resume execute.
                        this.__proc.run(data)

                        return data
                    }
                ,   this
                )

                var error = _.bind
                (   function(jqXHR, textStatus, errorThrown)
                    {   var msg = "ERROR: IO error while updatedata: "+name_res
                        console.error(msg, errorThrown)
                        throw new Error(msg) 
                    }
                ,   this
                )

                // The callback will trigger the "endpoint" of previous process.
                jQuery.ajax({
                      type: 'PUT',
                      url: url,
                      data: THIS.__a,   
                      success: success,
                      error: error
                })
            }
        ,   this
        )
    )  // this.__proc.next  #

    // This whole thing ( async process in Javascript which lacks conditional wait )
    // can only be finished in weird way.
    // 
    // Or if we can use Javascript 1.7+, maybe we can eliminate this nightmare by `yield` and 
    // other coroutine functions. But IE and some browsers do not support it.
    //
    return this
}

//
// Parse the data after receive data.
//
// The main purpose of this function is to demostrate how to construct and use a default action.
//
// parse:: IO r -> ( r -> r' ) -> IO r'
fluorine.IO.o.prototype.parse = function( parser )
{
    this.__proc.next
    (    _.bind
         (  function(prev)
            {   this.__proc.run(parser(prev))  }
         ,  this
         )
    )

    return this
}

// Compute something accroding to data from IO.
//
// The computation `fn` will get previous result as its first argument.
//
// Note: This is almost the `>>=` operator in Haskell,
// but we modify the type signature for convenience.
//
// compute:: IO r -> ( a -> b ) -> IO r'
fluorine.IO.o.prototype.compute = function( fn ){

    this.__proc.next
    (    _.bind
         (  function(prev)
            {    var result = fn.call(this.__env, prev)
                 this.__proc.run(result)
            }
         ,  this
         )
    )

    return this
}

// Action version of `compute` .
// Receive monadic action and compute it.
//
// Note: Our `IO` is mixed with some environment's features.
// So the **monadic action** will be applied under the environment.
//
// bind:: IO a -> ( a -> IO a' ) -> IO a'
fluorine.IO.o.prototype.bind = function( act )
{
    this.__proc.next
    (   _.bind
        (   function(prev)
            {   // When the execution reach this frame, 
                // merge the original process with new process in the generated monad.
                var monad_inner = act.call(this.__env, prev) 
                var proc_inner  = monad_inner.__proc

                proc_inner.next
                (   _.bind
                    (
                        function(prev) 
                        {   // context switching and executing the rest parts of base monad.
                            this.__proc.run(prev)   
                        }
                    ,   this    // the base monad
                    )
                )

                // Add all steps from inner to base monad.
                // This will dynamic change the process while it's running.
                this.__proc.preconcat(proc_inner)

                // The callbacks of inner monad will still access to the old proc,
                // not the merged one. It's terrible to change another monad's inner state,
                // but I can't find other better ways to do solve this problem.
                //
                monad_inner.__proc = this.__proc

                // Will run the merged process and set the result.
                this.__proc.run(prev)
            }
        ,   this
        )
    )
    return this
}

// Convert the RESULT of IO monad to Environment monad.
// This is NOT what the Haskell does, but it can work.
//
// User must given a name of the value.
//
// toEnvironment:: IO (Process a)-> Name  -> Environment (Process a)
fluorine.IO.o.prototype.toEnvironment = function(name)
{
    this.__proc.next
    (   _.bind
        (   function(prev)
            {   var env = {}
                env[name] = prev

                // We don't need to access the binding Environment;
                // we can just make a new Environment monad with it's own proc.
                //
                // The wrapper monad will take this single step monad,
                // and modify the step to take the value of it.
                //
                this.__proc.run(env)
            }
        ,   this
        )
    )

    return this
}

// Prevent run before definition done.
//
// done:: IO r -> IO r
fluorine.IO.o.prototype.done = function(){

    this.__done = true;

    return this;
}

// Run this monad . If this monad is not done, throw an Error.
//
// User should aware that the value is still hidden in the process,
// and can't be instanced in the outside world.
// 
// The only way to use the value is create another action to take the process,
// and use inside it. But this will create a temporary variable, 
// which contains the process and will be pased to the next action.
//
// run:: IO (Process a) -> Process a
fluorine.IO.o.prototype.run = function()
{

    if( ! this.__done )
    {
        throw new Error("ERROR: The monad is not done.");
    }

    // This will run the whole process, 
    // and it's only useful when this function is at the end of whole process.
    this.__proc.run();
    return this.__proc
}


// ----
// ## UI
//
// UI provide a wrapped, monadic jQuery.
// All DOM unrelated codes had been banned in this restricted jQuery.
//

// Return a prototype to bulding rest part of the action.
// The only one argument is `fluorine.Process`.
// If there is no process argument, this action will spanw new one.
//
// Example:
//
//     UI('body').$().css('backgroundColor', 'red').done().run()
//
fluorine.UI = function(selector)
{
    return new fluorine.UI.o(selector)
}

// DO NOT USE: It's for instancing the action.
fluorine.UI.o = function(slc)
{
    this.__$ = null   // Default selecting function ? 
    this.__done = false
    this.__proc = fluorine.Process()
    this.__slc = slc

    return this
}

//
// Use the restricted jQuery to manipulate some DOMs.
//
// $:: UI s
fluorine.UI.o.prototype.$ = function()
{
    this.__$ = jQuery   // Use jQuery as selecting functions.

    this.__proc.next
    (   _.bind
        (   function(dom_prev)
            {
                // Maps all jQuery related UI functions.
                fluorine.UI.o.__mapMonadic();

                this.__proc.run(dom_prev)
            }
        ,   this
        )
    )
    return this
}

//
// Functions listed here are the wrapped version of original jQuery functions.
// That means only when this action got run, those functions will be executed.
//

// __delegate:: UI s -> NameFunction, args -> ()
fluorine.UI.o.__delegate = function(args)
{
    this.__proc.next
    (   _.bind
        (   function(dom_prev)
            {   name = args.shift()

                // jQuery functions will use selected DOM as 'this' .
                // This kind of functions should be library-independend; 
                // using jQuery as default is just for convenience.
                //
                var dom_result = jQuery(dom)[name].apply(dom_prev, args)
                this.__proc.run(dom_result)
            }
        ,   this
        )
    )
}


// Mapping all function in jQuery to UI monad.
fluorine.UI.o.__mapMonadic = function()
{
    // Some other functions that require provide pure values rather than 
    // wrapped DOMs will be mapped by '__mapMonadic', because they're a part of unwraper functions.
    //
    // If a function provides both version, the version of pure value requiring will be usable 
    // only when user chainning it as run. 
    // 
    var names = [ 'addClass', 'after', 'append'
                , 'appendTo', 'attr' , 'before'
                , 'css'
                , 'clone', 'detach', 'empty'
                , 'height', 'html', 'innerHeight'
                , 'innerWidth', 'insertAfter', 'insertBefore'
                , 'offset', 'outerHeight', 'outerWidth'
                , 'prepend', 'prependTo', 'remove'
                , 'removeAfter', 'removeClass', 'removeProp'
                , 'replaceAll', 'replaceWith', 'scrollLeft'
                , 'scrollTop', 'text', 'toggleClass'
                , 'unwrap', 'val', 'wrap'
                , 'wrap', 'wrapAll', 'wrapInner'
                ]

   _.each( names, function(name)
   {    fluorine.UI.o.prototype[name] = 
        function()
        {   var args = _.map(arguments, function(a){return a})
            args.unshift(name)
            fluorine.UI.o.__delegate.call(this, args) 
            return this;
        }
   })
}

// Prevent run before definition done.
//
// done:: UI s -> UI s
fluorine.UI.o.prototype.done = function(){

    this.__done = true;

    return this;
}

// Run this action. If this action is not done, throw an Error.
//
// User should aware that the value is still hidden in the process,
// and can't be instanced in the outside world.
// 
// The only way to use the value is create another action to take the process,
// and use inside it. But this will create a temporary variable, 
// which contains the process and will be pased to the next action.
//
// run:: UI (Process a) -> Process a
fluorine.UI.o.prototype.run = function()
{

    if( ! this.__done )
    {
        throw new Error("ERROR: The monad is not done.");
    }

    // This will run the whole process, 
    // and select the DOMs only when user run this monad.
    //
    this.__proc.run(this.__select(this.__slc))
    return this.__proc
}

