
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

    this.__run_count = 0    // Whether this process had been run or not ? 

    // Pass an initialize step to enclose variables.
    //
    this.__proc.next
    (   _.bind
        (   function()
        {   this.__proc.run(slc)  
        } 
        ,   this
        )
    ,   'UI'
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
    ,   'UI::$'
    )
    return this
}

// **Purely** compute something accroding to data from UI.
//
// The computation `fn` will get previous result as its first argument.
//
// Note: This is almost the `>>=` operator in Haskell,
// but we modify the type signature for convenience.
//
// _:: UI r -> ( a -> b ) -> UI r'
fluorine.UI.o.prototype._ = function( fn )
{
    this.__proc.next
    (    _.bind
         (  function(dom)
            {    var result = fn(dom)
                 this.__proc.run(result)
            }
         ,  this
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
            {   // If this process had been run and refreshed, do not bind ( change ) the proc queue again.
                if( 0 != this.__run_count )
                {
                    this.__proc.run(dom_prev)
                    return
                } 
                
                // When the execution reach this frame, 
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
                ,   'UI::bind.continue'
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
    ,   'UI::bind'
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
// User should pass a EventName and filter function, 
// to forward (dispatch) events to notifications.
//
// Note: Although the '$(document).ready' is NOT a event of DOMs,
// we still treat as a 'ready' event, and can be forwarded.
//
// Note: Some event may only provide {name: EventName} as Event object. 
//
// forward:: UI DOM -> EventName -> (Event -> MessageName) -> UI DOM
fluorine.UI.o.prototype.forward = function(ename)
{
    return _.bind(   function(filter)
        {   this.__proc.next
            (   _.bind( function(dom)
                {   
                    if( 'ready' == ename )
                    {
                        jQuery(dom).ready
                        (   function()
                        {   
                            fluorine.Notifier.trigger(filter({'type': 'ready'}))
                        }
                        )
                    }
                    else
                    {
                        jQuery(dom).bind(ename, function(event){ 
                            event.name = filter(event)
                            fluorine.Notifier.trigger(event) 
                        })
                    }
                    this.__proc.run(dom)
                }
                , this
                )   // bind
            ,   'UI::forward'
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
    ,   'UI::__delegate'
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
    var names = [ 'animate', 'addClass', 'after', 'append'
                , 'appendTo', 'attr' , 'before'
                , 'css'
                , 'clone', 'detach', 'empty'
                , 'find','children','parents','parent'
                , 'end', 'andSelf'
                , 'fadeIn', 'fadeOut'
                , 'hide'
                , 'height', 'html', 'innerHeight'
                , 'innerWidth', 'insertAfter', 'insertBefore'
                , 'offset', 'outerHeight', 'outerWidth'
                , 'prepend', 'prependTo', 'remove'
                , 'removeAfter', 'removeClass', 'removeProp'
                , 'replaceAll', 'replaceWith', 'scrollLeft'
                , 'show'
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
             this.__run_count ++

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
    ,   'UI::done'
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
