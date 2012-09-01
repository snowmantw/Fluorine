
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

    this.__done = true

    // The last step of this process should be restore it.
    this.__proc.next
    (   _.bind
        ( function()
          {
             this.__proc.refresh()
          }
        , this 
        )
    )

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

    // The last step of this process should be restore it.
    this.__proc.next
    (   _.bind
        ( function()
          {
             this.__proc.refresh()
          }
        , this 
        )
    )

    return this
}

//
// Naming the result value of this IO.
// User can use this named value in functions required by `_` and `bind`
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
//          ._( function(){ return this.foo + this.bar }  )
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
        (   function(data)
            {   
                // The callback will trigger the "endpoint" of previous process.
                // Note: We will rewrite this with other IO protocols and decouple with jQuery.ajax .
                // The success callback will resume the execution after it get called.
                jQuery.ajax({
                      url: url,
                      data: query,   
                      success: fluorine.IO.__genAjaxSuccess(this.__proc),
                      error: fluorine.IO.__genAjaxError(name_res)
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

//
// Get binary data from server.
//
// There're no Create, Update and Delete method for binary data 
// ( they needn't a special method to handle it ).
//
// getBinary:: IO r -> ( ResourceEntry, NameResource, Query ) -> IO r'
fluorine.IO.o.prototype.getBinary = function( url, name_res, query)
{
    this.__proc.next
    (   _.bind
        (   function(data)
            {   var request = fluorine.IO.__binaryAjax(this.__proc, url, name_res, 'arraybuffer')
                request.send(query)
            }
        ,   this
        )
    )
    return this
}

//
// Get binary data from server, as Blob type.
//
// getBinaryBlob:: IO r -> ( ResourceEntry, NameResource, Query ) -> IO r'
fluorine.IO.o.prototype.getBinaryBlob = function( url, name_res, query)
{
    this.__proc.next
    (   _.bind
        (   function(data)
            {   var request = fluorine.IO.__binaryAjax(this.__proc, url, name_res, 'blob')
                request.send(query)
            }
        ,   this
        )
    )
    return this
}

//
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
        (   function(data)
            {   
                // The callback will trigger the "endpoint" of previous process.
                // The success callback will resume the execution after it get called.
                jQuery.ajax({
                      type: 'PUT',
                      url: url,
                      data: data ,
                      success: fluorine.IO.__genAjaxSuccess(this.__proc),
                      error: fluorine.IO.__genAjaxError(name_res)
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

// **Purely** compute something accroding to data from IO.
//
// The computation `fn` will get previous result as its first argument.
//
// Note: This is almost the `>>=` operator in Haskell,
// but we modify the type signature for convenience.
//
// _:: IO r -> ( a -> b ) -> IO r'
fluorine.IO.o.prototype._ = function( fn )
{
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

// Action version of `_` .
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

//
// Convert the RESULT of IO monad to UI monad.
// This is NOT what the Haskell does, but it can work.
//
// User must given the UI DOM ( DOM buffer is also OK; MUST be a single DOM ), 
// which the result of IO can append to.
//
// Note: This default method will directly append the data to the UI DOM.
// User can use `_` function to make a datum, fitting the requirement of UI monad.
//
// toEnvironment:: IO (Process a)-> DOM -> UI (Process a)
fluorine.IO.o.prototype.toUI = function(ui_dom)
{
    this.__proc.next
    (   _.bind
        (   function(data)
            {   ui_dom.appendChild(data) 
                this.__proc.run(ui_dom)
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

    // The last step of this process should be restore it.
    this.__proc.next
    (   _.bind
        ( function()
          {
             this.__proc.refresh()
          }
        , this 
        )
    )

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

// The default, hidden functions in IO context.

//
// Default Ajax request function handling binary formats.
//
// __binaryAjax:: ( Process a, ResourceEntry, NameResource, DataType ) -> Request
fluorine.IO.__binaryAjax= function( proc, url, name_res, type)
{   var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = type;
    request.addEventListener
    (  'load'
    ,  function() 
       {   fluorine.IO.
            __genAjaxSuccess(proc)(request.response, request.statusText, request) 
       }
    )
    request.addEventListener
    (   'error'
    ,  function(event) 
       {   fluorine.IO.
            __genAjaxError(name_res)(request, request.statusText, event) 
       }
    )
    return request
}

//
// It will resume the process while the asynchronous step got done.
//
// __genAjaxSuccess:: Process a -> ( IO (Process a, TextStatus, XHR) -> IO () )
fluorine.IO.__genAjaxSuccess = function(__proc)
{
    // Use these callback to construct our request,
    // and send it out.
    var success =
    function(data, textStatus, jqXHR)
    {   // resume execute.
        __proc.run(data)
    }
    return success
}

//
// Will throw error while ajax request got failed.
//
// __genAjaxError:: String -> IO ( XHR, TextStatus, Error ) -> IO ()
fluorine.IO.__genAjaxError = function(name_res)
{
    var error = 
    function(jqXHR, textStatus, errorThrown)
    {   var msg = "ERROR: IO error in request: "+name_res
        console.error(msg, errorThrown)
        throw new Error(msg);
    }
    return error
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
// Bind another monadic action. This function will pass the UI DOM to the action.
//
// bind:: UI a -> ( a -> UI a' ) -> UI a'
fluorine.UI.o.prototype.bind = function( act )
{
    this.__proc.next
    (   _.bind
        (   function(dom_prev)
            {   // When the execution reach this frame, 
                // merge the original process with new process in the generated monad.
                var monad_inner = act(dom_prev) 
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
                this.__proc.run(dom_prev)
            }
        ,   this
        )
    )
    return this
}

// 
// Because Javascript event model allow directly bind event on DOMs,
// instead of bind on global, we must make this function to forward those events.
//
// The forwarded event will bring original evnt data as data.
// It will own type as: Event EventObject 
//
// forward:: UI DOM -> EventName -> MessageName -> UI DOM
fluorine.UI.o.prototype.forward = function(ename)
{
    return _.bind(   function(fname)
        {   this.__proc.next
            (   _.bind( function(dom)
                {   jQuery(dom).bind(ename, function(event){ 
                        var n = event; n.name = fname;
                        fluorine.Notifier.trigger(n) 
                    })
        
                    this.__proc.run()
                }
                , this
                )   // bind
            )   // next

            return this  // curry
        }   // #1.
        ,  this    
        )   //bind
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
                , 'filter', 'not', 'eq', 'has'
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

    // The last step of this process should be restore it.
    this.__proc.next
    (   _.bind
        ( function()
          {
             this.__proc.refresh()
          }
        , this 
        )
    )

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
    this.__proc.run(this.__$(this.__slc))
    return this.__proc
}

// ----

// ## Event
//
// Event should be the most top monad in the stack.
// 
// Every monad process is a reaction chain of the notification.
//
// In this implementation, some concepts of signal/event ( in the Yampa DESL ) 
// will be accepted. But it's still impossible to implements all feature in the real AFRP,
// especially we can't really have a "main-loop" to do what the Yampa does.
//
// Thus our "signal" functions are basically discrease.
// 
// Note: Monadic codes are already in the Yampa DESL. In the basic `switch` function,
// which owns the type signature `switch:: SF in (out, Event t) -> (t -> SF in out) -> SF in out`,
// the `Event t` and `t -> SF in out` are just the monad bind : `m a -> ( a -> m b ) -> m b`.
//
// Note: We embedded an "real" Environment context in this context.
// Any "passed in" notification will be the context of the computation.
// EX: 
//      {'name': "ename", 'foo':3} passed in; 
//      the computation in this context can receive those vars as function arguments.
//

//
// Begin to construct the whole process based on signals/events.
//
// Event:: MessageName -> Event 
fluorine.Event = function(iname)
{
    return new fluorine.Event.o(iname)
}

fluorine.Event.o = function(iname)
{
    this.__done = false
    this.__iname = iname

    // Note that the real result ( can be accessed by others )
    // should be placed in the process, not those directly value in the monad.
    //
    // Because our monads are `Monad (Process a)`, not `Monad a`
    this.__proc = fluorine.Process()

    // When running,
    // convert note as next function's arguments.
    this.__proc.next
    (   _.bind
        (   function(note)
            {
                this.__proc.run.apply(this.__proc,_.values(note))
            }
        ,   this
        )
    )

    return this
}

// **Purely** compute something accroding to data withing the event.
//
// The computation `fn` will get previous result as its first argument.
//
// Note: If the pure function return a object like {foo: 1, bar: "abc"},
// the next context function will receive them as named arguments.
// EX:
//      ...
//      ._(function(){ return {foo: 1, bar: "abc" }  })
//      ._(function(foo, bar){ return foo+bar})
//      ...
//
// Note: This is almost the `>>=` operator in Haskell,
// but we modify the type signature for convenience.
//
// _:: Event a -> ( a -> b ) -> Event b
fluorine.Event.o.prototype._ = function( fn )
{
    this.__proc.next
    (    _.bind
         (  function()
            {    // Note the pure fn will compute under empty environment,
                 // and can only receive arguments as data.
                 var result = fn.apply({}, arguments)
                 
                 // If result is NOT a object, the _.values will convert it as empty array.
                 // And if the result is an empty array, the _.values still return an empty array.
                 if( _.isObject(result) )
                 {
                     result = _.values(result)
                 }
                 
                 if( ! _.isArray(result) )
                 {
                     result = [result]
                 }

                 this.__proc.run.apply(this.__proc, result)
            }
         ,  this
         )
    )

    return this
}

// ( EventData b ) => Event a -> MessageName -> (a -> b) -> Event b
fluorine.Event.o.prototype.out = function(name)
{
    return _.bind
    (   function(convert)
        {   this.__proc.next
            (   _.bind
                (   function()  // convert the tuple, passed by argument, to a note.
                    {   
                        var note_body = convert.apply({}, arguments)
                        note_body.name = name
                        this.__proc.run(note_body)
                    }
                ,   this 
                )
            )
            return this
        }   // #1.
    ,   this
    )
}

// Close this monad. 
//
// done:: Event r 
fluorine.Event.o.prototype.done = function(){

    this.__done = true

    // The last step of this process should be restore it.
    this.__proc.next
    (   _.bind
        ( function()
          {
             this.__proc.refresh()
          }
        , this 
        )
    )

    return this
}

fluorine.Event.o.prototype.run = function()
{
    if( ! this.__done )
    {
        throw new Error("ERROR: The monad is not done.");
    }

    // At final stage, send the message out. 
    this.__proc.next
    (   function(note)
        {
            fluorine.Notifier.trigger(note)
        }
    )

    // "Run" this process when the event comes.
    fluorine.Notifier.on
    (   this.__iname
    ,   _.bind
        (   function(note)
            {   
                this.__proc.run(note)
            }
        ,   this
        )
    )
    return this.__proc
}

/*
    
   Event("message.google.test").bind( e_msg -> e ).out().done()  -- 建立一條 path, bind 很多 operations. 前面運算一定會自動被 out send message
   route(message, [path]) --> (message, [path])  -- 選出 ( route ) 所有 match 的 path
   switch -- is NOT a SF, but a generator of SF. Whole program is constructed by it.
   switch (route, paths, handler of event to update the collection of paths, the next SF after this (time) switch)

   ----

   dbSwitch, some notable points

   1. the final updating function, will do register and unregister notification from the backend notifier.
   2. the collection, should contains all notification and the callback ( event handelr ).
   3. the final updating function, should generate the next running function ( as a part of recursion ).
   4. and the switch, will run the 'current' version, and get the next running function, and run it 
      ( recursion if the next one is the same with this one ).  

   5. of course, the main switch loop still need be applied in the special `reactInit` function
      so the main switch will not be runned directly, and maybe we can concat many switch to make larger program.

      reactInit :: IO a -> (ReactHandle a b -> Bool -> b -> IO Bool) -> SF a b -> IO (ReactHandle a b)

*/

// ** Memo **
//
// Signal start with MessageName.
// Should have `switch` functions to manage inner SF circuits, and plays a major role.
// One signal chain correspond to one SF function ??
// SF function: `SF in out`, means a circuit expose in and out. Inner components may be complicated.
// 
// It seems that the whole program is constructed by a single switch, 
// and applied on route, paths and killOrSpawn (adjuster).
//
// `route` need input, paths and will generate a pair of dispatched path and the applied input.  
//
// So, a program in FRP is a complicated but also simple SF. We can still porting this on the Signal context.
// Of course, we can't implement the `delay` part as description. 
// 
// And the final argument of the SF, should be another SF which receive the generated SF collection ( paths ).
// If the final SF is the same with "current" SF, for instance feeding the `game` SF as the final argument of 
// the SF, it becomes a main loop.
//
// The Yampa, only provide some primitive functions that can directly access signals.
// This prevent bad signal functions make system go crazy, like data depends on future.
//
// The major difference between  Event and Signal, is that the signal value will be computed continously,
// and the computing function shouldn't care about the time. But the function compute on an Event, 
// will and should care about what event it handle. 
//
// Circuits in Yampa programs, can only use defined signal functions. User can't directly handle the signals.
// But there will be some named signals in the program. All user can do is feeding them into SFs as they want.
//
