
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


