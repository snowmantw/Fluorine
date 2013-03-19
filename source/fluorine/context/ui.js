
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
