
// Basic contexts.
// These contextes reply on Notifier and Environment.
// Third-party libraries requirements: underscore and jQuery.ajax 
// ( the later one will be replaced in near future )

//----
//
// ## Environment

// Return a prototype to bulding rest part of the action.
// The second argument is `fluorine.Process`.
// If there is no process argument, this action will spanw new one.
//
fluorine.Environment = function(env_init, proc){
    return new fluorine.Environment.o(env_init, proc);    
}

// DO NOT USE: It's for instancing the action.
fluorine.Environment.o = function(env_init, proc){

    this.__done = false;
    this.__env_current = env_init || {};
    this.__proc = proc || fluorine.Process()

    // An object holds all registries of settings,
    // or those come from computation.
    this.__a = {};

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
// local:: Environment r -> ( r -> r' ) -> Environment r'
fluorine.Environment.o.prototype.local = function(fn){

    // This function will let the fn execute with new environment,
    // and return with a new environment.

    this.__proc.next
    (    _.bind
         (  function()
            {    this.__env_current = fn.call( this.__env_current );
                 this.__proc.run();

                 // Will return as __proc.result.
                 return this.__env_current; 
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

    var THIS = this;

    // The action will take environment in this as it's "this" 
    // ( what the environment monad should does ).
    //
    // Get the constructed moand from action.
    //
    // Note: this will not run the monad, 
    // but construct it.
    this.__proc.next
    (   function()
        {   var monad_inner = act.call(THIS.__env_current);
            var proc_inner  = monad_inner.__proc;

            // The last step of monad constructed by the act,
            // should return a new base monad with no step as result.
            //
            // That monad will contain the converted result of 
            // previous monadic action.
            proc_inner.next
            (   function()
                {   
                    // The previous `toEnvironment()` will leave 
                    // an Environment monad as the result.
                    THIS.__env_current = monad_inner.__a.__env_current;
                    THIS.__a = THIS.__env_current;
                    THIS.__proc.run();
                    return THIS.__env_current; 
                }
            )

            // Add all steps from inner to base monad.
            // This will dynamic change the process while it's running.
            THIS.__proc.preconcat(proc_inner);

            // The callbacks of inner monad will still access to the old proc,
            // not the merged one. It's terrible to change another monad's inner state,
            // but I can't find other better ways to do solve this problem.
            //
            monad_inner.__proc = THIS.__proc;
            THIS.__proc.run();
            return THIS.__env_current;
        }
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


// Run this action. If this action is not done, throw an Error.
//
// User should aware that the value is still hidden in the process,
// and can't be instanced in the outside world.
// 
// The only way to use the value is create another action to take the process,
// and use inside it. But this will create a temporary variable, 
// which contains the process and will be pased to the next action.
// 
//
// run:: Environment (Process a) -> Process a
fluorine.Environment.o.prototype.run = function(){

    if( ! this.__done )
    {
        throw new Error("ERROR: The action is not done.");
    }

    // This will run the whole process, 
    // and it's only useful when this function is at the end of whole process.
    this.__proc.run();
    return this.__proc
}


//----
//
// ## IO

// Return a prototype to bulding rest part of the action.
// The only one argument is `fluorine.Process`.
// If there is no process argument, this action will spanw new one.
//
fluorine.IO = function(proc){
    return new fluorine.IO.o(proc);    
}

// DO NOT USE: It's for instancing the action.
fluorine.IO.o = function(proc){

    // an object holds all receive resources.
    this.__a = null;
    this.__env = {};

    this.__done = false;
    this.__proc = proc || fluorine.Process()

    return this;
}

// Close this action. 
//
// done:: IO r 
fluorine.IO.o.prototype.done = function(){

    this.__done = true;

    return this;
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
    var THIS = this;
    this.__proc.next
    (   function()
        {   THIS.__env[name] = THIS.__a;
            THIS.__proc.run();
            return THIS.__a;
        }
    );

    return this;
}

//
// Get a resource from server or other repo.
// If the URL isn't a local URL, this function will try to use Ajax with HTTP GET method to load it.
//
// Note: The current version only support remote URL.
//
// Will send the note `{ name: "resource.receive."+name_res, <name_res>: data}` 
// after receive data.
//
// get:: IO r -> ( ResourceEntry, NameResource, Query ) -> IO r'
fluorine.IO.o.prototype.get = function( url , name_res, query){

    // This function involves async execution,
    // and will stop the main thread after the request be sent.
    //
    // The rest part of this action will only be execute after the request 
    // have been responsed. This is implemented by register the rest part with
    // a resource note, so it will be invoked when the request return.
    //

    var THIS = this;    // Closure. The `this` must be concerned when handling event.
    this.__proc.next
    (
        function()
        {   
            // Use these callback to construct our request,
            // and send it out.
            var success = function(data, textStatus, jqXHR){
                var note = {name: "resource.receive."+name_res};
                note[name_res] = data
                fluorine.Notifier.trigger( note );
                THIS.__a = data;

                // resume execute.
                THIS.__proc.run();

                return data;
            }

            var error = function(jqXHR, textStatus, errorThrown){
                var msg = "ERROR: IO error in request: "+entry_res;
                console.error(msg, errorThrown);
                throw new Error(msg); 
            }

            // The callback will trigger the "endpoint" of previous process.
            // Note: We will rewrite this with other IO protocols and decouple with jQuery.ajax .
            jQuery.ajax({
                  url: url,
                  data: query,
                  success: success,
                  error: error
            });
        }
    );  // this.__proc.next  #

    // This whole thing ( async process in Javascript which lacks conditional wait )
    // can only be finished in weird way.
    // 
    // Or if we can use Javascript 1.7+, maybe we can eliminate this nightmare by `yield` and 
    // other coroutine functions. But IE and some other browsers do not support it.
    //
    return this;
}

// Update the data in server, from the value in this IO action. 
// It will use PUT method. 
// 
// Will send the note `{ name: "resource.send_done."+name_res, <name_res>: data}` 
// after successfully send the data out.
//
// update:: IO r -> ( URL, NameResource ) -> IO r'
fluorine.IO.o.prototype.update = function( url, name_res ){

    var THIS = this;    // Closure. The `this` must be concerned when handling event.
    this.__proc.next
    (
        function()
        {
            // Use these callbacks to construct our request,
            // and send it out.
            var success = function(data, textStatus, jqXHR){
                var note = {name: "resource.update_done."+name_res};
                note[name_res] = data
                fluorine.Notifier.trigger( note );
                THIS.__a = data;

                // resume execute.
                THIS.__proc.run();

                return data;
            }

            var error = function(jqXHR, textStatus, errorThrown){
                var msg = "ERROR: IO error while updatedata: "+name_res;
                console.error(msg, errorThrown);
                throw new Error(msg); 
            }

            // The callback will trigger the "endpoint" of previous process.
            jQuery.ajax({
                  type: 'PUT',
                  url: url,
                  data: THIS.__a,   
                  success: success,
                  error: error
            });
        }
    );  // this.__proc.next  #

    // This whole thing ( async process in Javascript which lacks conditional wait )
    // can only be finished in weird way.
    // 
    // Or if we can use Javascript 1.7+, maybe we can eliminate this nightmare by `yield` and 
    // other coroutine functions. But IE and some browsers do not support it.
    //
    return this;
}

// Parse the data after receive if necessary.
//
// The main purpose of this function is to demostrate how to construct and use a default action.
// Unlike the real binding function, default action will not receive another action, 
// and we can see them as `.bind(.action)` to fit the concept of monad.
//
// The first argument `parser` must support `parse()` member function.
//
// parse:: IO r -> Parser -> IO r'
fluorine.IO.o.prototype.parse = function( parser )
{
    var THIS = this;
    this.__proc.next
    (    function()
         {
             THIS.__a = parser.parse(THIS.__a);
             THIS.__proc.run();
             return THIS.__a;
         }
    )

    return this;
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

    var THIS = this;

    this.__proc.next
    (    function()
         {   
             THIS.__a = fn.call(THIS.__env,THIS.__a);
             THIS.__proc.run();
             return THIS.__a;
         }
    )

    return this;
}

// Convert the RESULT of IO monad to Environment monad.
// This is NOT what the Haskell does, but it can work.
//
// User must given a name of the value.
//
// toEnvironment:: IO (Process a)-> Name  -> Environment (Process a)
fluorine.IO.o.prototype.toEnvironment = function(name)
{
    var THIS = this;
    this.__proc.next
    (   function()
        {
            var env = {};
            env[name] = THIS.__a;
            THIS.__a = fluorine.Environment(env);
            // We don't need to access the binding Environment;
            // we can just make a new Environment monad with it's own proc.
            //
            // The wrapper monad will take this single step monad,
            // and modify the step to take the value of it.
            //
            THIS.__proc.run();
            return THIS.__a; 
        }
    )

    return this;
}

// Prevent run before definition done.
//
// done:: IO r -> IO r
fluorine.IO.o.prototype.done = function(){

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
// run:: IO (Process a) -> Process a
fluorine.IO.o.prototype.run = function()
{

    if( ! this.__done )
    {
        throw new Error("ERROR: The action is not done.");
    }

    // This will run the whole process, 
    // and it's only useful when this function is at the end of whole process.
    this.__proc.run();
    return this.__proc
}

