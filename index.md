
# Fluorine: a context based Javascript library

Fluorine is a Javascript library and eDSL, want to help developers constructing their 
application with more functional features, and build large programs from small functions.
It currently has these features:

* Allow to isolate impure parts in the program.
* Still allow mixing pure/impure parts when necessary.
* Flow-control, to avoid callback hell.
* (Sort of) laziness.
* (Partially) typed.

It's first inspired by the [Arrowlets](http://www.cs.umd.edu/projects/PL/arrowlets/api-arrowlets.xhtml) library, 
which brought functional structure, the Arrowlet, into Javascript world. Of course, the great [jQuery](http://jquery.com/) 
and [Underscore.js](http://underscorejs.org/) also shown how amazingly Javascript could be.

Futhurmore, this library also want to experiment the possibility of constructing reasonable Javascript programs 
**without (too much) class, object and other OOP things**. Because Javascript, at least according to Douglas Crockford, 
["has more in common with functional languages like Lisp or Scheme than with C or Java".](http://www.crockford.com/javascript/javascript.html)
This is a good point in this age of OOP-mainstreaming, especailly most of libraries are all eager to provide class, inheritance and other OOP stuffs.


## Features

### Isolate Impure Parts in Javascript Applications

Fluorine can help Javascript programmers isolate impure parts in their applications, 
so that errors resulted from side-effects can be reduced as much as possible:

    fluorine.infect()
    
    // Impure function: directly manipulate DOMs in the document.
    // All impure computing should be wrapped with contexts.
    //
    // :: String -> UI ()
    drawMyName = function(name)
    {
        return UI('#name-user').$().text(name).done()
    }
    
    // Pure function: return a plain old string.
    //
    // :: String 
    giveName = function()
    {
        return "foobar"
    }

Programmers can still mix them in some proper ways, like in a generator function 
returing yet another larger context:


    // :: UI ()
    drawApp = function()
    {
        return UI().
            let(giveName).as('name').
            tie( function()
            {
                // Use them just like "let" in other languages.
                var slc_ex1 = '#ex1'
                return UI("<div id='name-user'></div>").$().appendTo('#ex1').done()
            }).
            tie( function()
            {   
                // Fetch the value pre-defined by `let` and `as`.
                return drawMyName(this.name)
            }).
            done()
    }


### Break the Glass in Emergency

Basically, pure functions and values now can't arbitrarily mix with impure things:

    // :: String
    pureString = function()
    {
        return "pure"
    }

    // :: UI String
    impureString = function()
    {
        return UI("impure").done() 
    }

    illegal_string = pureString() + impureString()  // Error. 

But in some special cases, we can still do that if the context come with some extractor functions:

    illegal_string = pureString() + impureString()().extract()  // UI String -> String

Also, we can do some dirty things in the theoretically pure combinator, like the `let` or `_`:

    UI('#name-user').$().
        _(function(e)
        {
            // Should keep pure, not violent that like this:

            $(e).text("name changed !")
        }).
        done()

This is sometime useful because we may want to embedded 3rd libraries in our contexts.

Nevertheless, these tricks should be exceptions, not normalities.

