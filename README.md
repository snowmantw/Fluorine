

# Fluorine: a context based Javascript library

Fluorine is a library, provide a way to let programmer isolate side-effect computations in their progams.
It also provides a very basic notifying mechanism, to help programmers develop programs based on application layer notifications.

## Why Bothers ?

Javascript allows first-class functions, which let programmers can easily develop some funtional-flavor programs.
And libraries like underscore.js did the great job to enrich the toolbox of functional developing.

But as a language, Javascript still lacks some important features in real functional languages like Haskell,
and it also lacks process controlling which may ease the headache from asynchonous execution.

This library want to resolve these problems without developing new DSL language ( which enforce user must have a compiler in their application ).
Instead of, it represents a DESL, which is deeply inspired by the famous jQuery library, and borrows many ideas about context-based computation from Haskell.
Thus developers can still write pure Javascript, with more functional features.

## Impure Computation Considered Harmful

The problem of mixing pure and impure computations is that users must spend a lot of time to ensure the behavior of functions is correct.
And this process sometime become very annonying, especially when those functions lack documents. 

It result in that no matter how strong developers believe, side-effect functions are still unreliable unless it's functional scope be restricted.
In the later situation, we can isolate these functions and keep things more clear. 

## Contexts with Embedded Process

Because fluent interface provide we a way to construct program like constructing a process, 
this library wish developers can use the idea to solve the problems of asychronous execution.

In details, it means all contexts in our library, will not directly manipulate the context value,
but a context value in a embedded process. For instance, our "UI" context, will handle a value continuously changing
in every piece of UI process. So it's related action will become:

    css:: UI (Process DOM) -> (k, v) -> UI (Process DOM)

rather than
    
    css:: UI DOM -> (k, v) -> UI DOM

This means users of this library, can access the value ( DOM ) only after the process got executed.
And a extracting action is need:

    // Run the process and extract the value.
    UI('.button').$().css('background-color', 'red').done()().extract() 

In this way, we can manage asynchronous execution within our contexts.

## Principles and Features

- Context constructors play mutiple roles: 
  - Data constructor    : `IO(a)` means construct a datum with value `a`, and
  - Type declaration    : `IO(a)` means this datum typed as `IO a`, and
  - Context beginning   : `IO(a)` means we want to begin a series of IO compuation, and
  - Computation guard   : `IO(a)` means it's different from pure `a`, thus it can't directly involve pure computations.

- Contexts are all embedded with an inner environment, EX: 
  - `IO(2).as('a').let( funtion(){ return 2 } ).as('b')._(function(){return this.b - this.a }).done()() // return 0` 

- Contexts are all embedded with an inner process. Customing more context functions need to use these inner process.
  ( @see `fluorine.Process` and existing context functions like `fluorine.Context._` )

- Bind function play a role as "context-transformer" bind. Means it will automatically extract and bind inner context's values to next function,
  following base context's rules.

- Native, discrete events will be forwarded to global signal/event switch, and handle them in an AFRP-like way. 
  This concept porting is for eliminating distributed events, which usually occurs every logic corner in the application,
  and let event handling logics distributes everywhere, too. 

- Outside functions can't directly access the result of computated contexts, unless call `extract` function explicitly.

- Never extract an `IO` context. It's the lowest context, like the same name monad in Haskell.

- When context provide only basic combinators, always doing pure computations inside `let` or `_` function ( call it "lambda" if you want )

- Similarly, always doing impure computations inside `bind` function, which allow developer to bind another context

## Example

    // Get a file and process its content with pure functions.
    // Note these "getBinary" functions are asynchronous, and IO has no "extract" function,
    // so users can't get values of IO outside the context.
    //
    IO().getBinary('foo.bin').as('first_content')
        .getBinary('bar.bin').as('second_cotnent')
        ._( function()
            {   // Concat file contents.
                return append( this.first_content, this.second_content )
            }
          )
        .done()()   // `done` will generate a context, and we can directly run it.

    // ----

    // Demo base context mixing with inner context.
    //
    UI('.data-form').$()
        .eq(0)
        .bind
         (  function(ui_form)
         {   return IO()
                 .get('/data-form.json')
                 ._( function(content)
                   { 
                     // We can directly access the value inside the context .
                     $(ui_form).find('input["name"]').val(content.name)
                   }
                   )
                 .toUI()
         }
         )
        .done()()
    .extract()    // UI context has extract.

## License 

Fluorine: a context-based Javascript library Copyright (C) 2012 Greg Weng, snowmantw@gmail.com

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see http://www.gnu.org/licenses/.
