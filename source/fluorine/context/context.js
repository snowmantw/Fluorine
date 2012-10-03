
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

    // For refreshing this monad after run it.
    this.__init_arguments = arguments

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
                monad_inner.unclose()
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
// Make the result as the Event monad's one argument.
// Such functions should make sure it's proc result will prepare all things the next monad needed.
//
// toEvent :: IO (Process a) -> Event (Process a)
fluorine.IO.o.prototype.toEvent = function()
{
    this.__proc.next
    (   _.bind
        ( function()
        {   // Because results in Event monad will be directly forward to the next.

            this.__proc.run.apply(this.__proc, arguments)  
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

    if( this.__done ) { return }
    this.__done = true;

    // The last step of this process should be restoring it.
    this.__proc.next
    (   _.bind
        ( function(result)
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

    return this;
}

// "Undo" the last step ( done() ) of this monad.
// The monad MUST be closed.
//
// unclose:: IO s -> IO s
fluorine.IO.o.prototype.unclose = function()
{
    if( ! this.__done )
    {
        throw new Error("ERROR: The monad is not done.")
    }

    // FIXME: Dirty way.
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
// ----
//
// Note: The constructor can accept DOM as context handling target, too. 
// This behavior is for the convience while handling asynchronous sending-receiving model.
//
// Example:
//
//      //(receiver of notification, if UI constructor disallow passing UI DOM in)
//      function(note){ (note.target.css().appendTo().... ) } 
//
//      //(if UI constructor allow passing UI DOM in)
//      function(note){ UI(note.target).$().css()..... }
//
// The second function shows the target will be handled in the UI context.
// It's better than the first version.
//
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

    // Pass an initialize step to enclose variables.
    //
    this.__proc.next
    (   _.bind
        (   function()
        {   this.__proc.run(slc)  
        } 
        ,   this
        )
    )

    // For refreshing this monad after run it.
    this.__init_arguments = arguments

    return this
}

//
// Use the restricted jQuery to manipulate some DOMs.
// And select elements.
//
// The second type is for the reason mentioned in the constructor.
//
// $:: UI selector | UI [DOM] -> UI [ DOM ]
fluorine.UI.o.prototype.$ = function()
{
    this.__$ = jQuery   // Use jQuery as selecting functions.

    // Maps all jQuery related UI functions, only in this monad.
    fluorine.UI.o.__mapMonadic(this)

    this.__proc.next
    (   _.bind
        (   function(slc)
            {
                this.__proc.run(this.__$(slc))
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
                monad_inner.unclose()
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
//
// __delegate:: UI s -> NameFunction, args (with 'name' property) -> ()
fluorine.UI.o.__delegate = function(args)
{
    this.__proc.next
    (   _.bind
        (   function(dom_prev)
            {   // The original way is unshift the name in before this runtime step,
                // and shift the name out here.
                //
                // But if we modify such definition-time variable,
                // we can't recovery it after refresh the process of this monad.
                name = args.name    


                // jQuery functions will use selected DOM as 'this' .
                // This kind of functions should be library-independend; 
                // using jQuery as default is just for convenience.
                //
                var dom_result = jQuery(dom_prev)[name].apply(dom_prev, args)
                this.__proc.run(dom_result)
            }
        ,   this
        )
    )
}


// Mapping all function in jQuery to UI monad.
fluorine.UI.o.__mapMonadic = function(uimonad)
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
   {    uimonad[name] = 
        function()
        {   var args = _.map(arguments, function(a){return a})
            args.name = name 
            fluorine.UI.o.__delegate.call(this, args) 
            return this;
        }
   })
}

// Prevent run before definition done.
//
// done:: UI s -> UI s
fluorine.UI.o.prototype.done = function(){

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

             // __$ will become null, and the steps in restored process can't use it.
             this.__$ = $old

             // Set the selector. Previous statement will also reset the process,
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

// "Undo" the last step ( done() ) of this monad.
// The monad MUST be closed.
//
// unclose:: UI s -> UI s
fluorine.UI.o.prototype.unclose = function()
{
    if( ! this.__done )
    {
        throw new Error("ERROR: The monad is not done.")
    }

    // FIXME: Dirty way.
    this.__proc.__queue.pop()

    return this
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
    this.__proc.run()
    return this.__proc
}

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

    // For refreshing this monad after run it.
    this.__init_arguments = arguments

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

//
// Bind some monad to handle the (Event t)
// 
// Note: Remember our moand mixed the environment concepts.
//
// Event t -> ( t -> Event t' ) -> Event t'
fluorine.Event.o.prototype.bind = function(mact)
{
    this.__proc.next
    (   _.bind
        (   function()  // Environment parts.
        {   var monad_inner = mact.apply({}, arguments)
            monad_inner.unclose()
            var proc_inner = monad_inner.__proc

            // The final step of inner monad should fit Event monad.
            // Arguments passing should follow the this monad's principle ( embedded environment ).
            proc_inner.next
            (   _.bind
                (   function() 
                {   
                    this.__proc.run.apply(this.__proc, arguments)
                }
                ,   this
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
            this.__proc.run.apply(this.__proc, arguments)
        }   
        ,   this     
        )
    )

    return this
}

// Close this monad. 
//
// done:: Event r 
fluorine.Event.o.prototype.done = function()
{
    if( this.__done ) { return }
    this.__done = true


    // 1. At final stage, send the message out. 
    this.__proc.next
    (   _.bind
        (   function(note)
            {
                // Special case: if the final note had been bound with this monad itself,
                // we must restore the process before trigger the note.
                if( note.name == this.__iname)
                {
                     this.__proc.refresh()
                     var proc_new = this.__proc
                     this.constructor.apply(this, this.__init_arguments)

                     // Previous statement will also reset the process,
                     // and we still need the old one to keep the result.
                     this.__proc = proc_new
            
                     // The 'done' flag will also be reset
                     this.__done = true
                     
                     // And we still need to set a final step to close the monad.
                     // It's also for the unclose action, which will remove the final step in process.
                     this.__proc.next(function(){})

                     // We must execute the next step; it is just added by ourself.
                     this.__proc.run(note)
                }
                fluorine.Notifier.trigger(note)

                if( note.name != this.__iname)
                {
                    // 2. The last step of this process should be restoring it.
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

                     // We must execute the next step; it is just added by ourself.
                    this.__proc.run(note)
                }
            }
        ,   this
        )
    )

    return this
}

// "Undo" the last step ( done() ) of this monad.
// The monad MUST be closed.
//
// unclose:: Event s -> Event s
fluorine.Event.o.prototype.unclose = function()
{
    if( ! this.__done )
    {
        throw new Error("ERROR: The monad is not done.")
    }

    // FIXME: Dirty way.
    this.__proc.__queue.pop()

    return this
}

fluorine.Event.o.prototype.run = function()
{
    if( ! this.__done )
    {
        throw new Error("ERROR: The monad is not done.");
    }

    // "Run" this process when the event comes.
    fluorine.Notifier.on
    (   this.__iname+"."+Date.now().toString()
    ,   _.bind
        (   function(note)
            {   
                console.log('handle note: ', this.__iname)
                this.__proc.run(note)
            }
        ,   this
        )
    )
    return this.__proc
}

// ** Memo **
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
// ----
// About WebSocket
//
// * IO().getSocket().connect() --> 保證之後的運算可以收到 socket ，變成 IO Socket 的串連
//   --> 或是 Socket 與 IO 無關
//
// * IO.Socket().connect().forward('server event').disconnect().send()
//
// 可是 connect 等事件好像不容易用出
// 處理完要送出也是一樣的意思
// 侷限在該 Socket 的一連串處理。
// IO 並不侷限在某檔案處理：他可以多個來源。
// 重點是某些 IO 值一直被處理。
// 如果以一串流來講？ IO.socket().on('ae1').as('a1').on('be1').as('b1')
//                      .socket().on('ae2').as('a2').on('be2').as('b2')
//                      ...
//
// 但 IO IPO 是打開處理與結束。IO Socket 不是。他是像 AFRP 。
// Socket 事件的轉發是確定的。
//
// 像 UI, Socket 這樣的 Monad  設計轉發是因為，不希望處理事件的邏輯，超出該 context 。
// 也就是利用 UI 或 Socket 的一連串運算，應該只能使用該 Monad 所提供的功能（在該 context 內）。
// 就算是 bind，最終也應該給回屬於該 Monad 的值 m a。
//
// 所以 Socket 與 UI 中會提供該 context 合理運算的所有函式。超過的事件處理部份應該要靠轉發出去。
//
// 因此針對事實上是會被以任意邏輯處理的事件，用轉發的方式，在 JS 具有物件 scope 的事件模型，
// 與如 Yampa 那樣全域事件分派的模型作接軌。 
//
// 主動送出的部份，給定 Socket(host:port) ，然後如果是已經開啟的，就內部自動不重複。
// 當然這部份位置可以用 environment 設定好。或用其他變數指定。
// smonad = function(){ return Socket(address).send(some-thing) } :: IO ()
//
// Socket(address).connect()
//                .forward('event-from-server')('some-note')
//                .forward()()
//                .close()
//
// 然後掛在該事件上
//
// Event('some-note')
//  .bind
//   (  function(note)
//      {   note.socket.send()
//          note.socket.close()
//
//          // register other socket.
//          Socket(address).connect().....close().run()
//      }
//   ).out().close()
//
// 但如果我們按照 haskell hOpenFile 之類的，其實是可以傳一個 handler。
// 只是 handler 與 socket 不同處在於 socket 會送事件，handler 不是那樣的。
//
// open :: handler -> doSomething handler -> close handler
// open :: socket  -> ... wait ?? ... -> close socket 
//
// 真的採用 event forward  的作法。每個 event 都會附 socket 當作 async socket 中的 handler
// 然後處理者可能 close socket。
//
// openFile 最後會傳出 IO Handler ，也就是要繼續在這當中作。這是否要與 AFRP 衝突？
//
