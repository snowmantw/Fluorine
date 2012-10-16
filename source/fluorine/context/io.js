
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
