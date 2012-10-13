

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

    this.__run_count = 0    // Whether this process had been run or not ? 

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
    ,   'Event'
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
    ,   'Event::_'
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
            ,   'Event::out'
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
        {   // If this process had been run and refreshed, do not bind ( change ) the proc queue again.
            if( 0 != this.__run_count )
            {
                this.__proc.run.apply(this.__proc, arguments)
                return
            } 
            
            var monad_inner = mact.apply({}, arguments)
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
            ,   'Event::bind.continue'
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
    ,   'Event::bind'
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

                // Trigger the `out` note.
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
                             this.__run_count ++

                             // Previous statement will also reset the process,
                             // and we still need the old one to keep the result.
                             this.__proc = proc_new

                             // The 'done' flag will also be reset
                             this.__done = true
                          }
                        , this 
                        )
                    ,   'Event::done'
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

    var bind_name = this.__iname+'.'+Date.now().toString()

    // "Run" this process when the event comes.
    fluorine.Notifier.on
    (   bind_name 
    ,   _.bind
        (   function(note)
            {   try{
                this.__proc.run(note)
                } catch(e)
                {
                    fluorine.Notifier.off(bind_name)
                    console.error('[ERROR] Unbind crashed process: ', bind_name, e)
                }
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
