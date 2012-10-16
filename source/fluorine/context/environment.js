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

    // For refreshing this monad after run it.
    this.__init_arguments = arguments

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
//              ._(function(){ this.a += 10; this.b(); console.log(this.c); return {'a':a}; })
//      // The new environment r' will be `{'a':10+1}`
//
// Note: Yes, this is not a real local scope. It may be implemented in near future.
//
// Note: The fn will receive nothing. All function in this monad should pass nothing to its next.
//
// _:: Environment r -> ( r -> r' ) -> Environment r'
fluorine.Environment.o.prototype._ = function(fn){

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
                monad_inner.unclose()
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

    if( this.__done ) { return }
    this.__done = true

    // The last step of this process should be restoring it.
    this.__proc.next
    (   _.bind
        ( function()
          {
             this.__proc.refresh()
             var proc_new = this.__proc
             this.constructor.apply(this, this.__init_arguments)

             // Previous statement will also reset the process,
             // and we still need the old one to keep the result.
             this.__proc = proc_new

             // The 'done' flag will also be reset
             this.__done = true
          }
        , this 
        )
    )

    return this
}

// "Undo" the last step ( done() ) of this monad.
// The monad MUST be closed.
//
// unclose:: Environment s -> Environment s
fluorine.Environment.o.prototype.unclose = function()
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
