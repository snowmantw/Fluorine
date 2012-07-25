
# Fluorine: Arrow in Javascript with fully event-driven features

## Introduction of Arrow and Related Event-Driven Programming Issues

[Arrow in Haskell][1] is a great way to separate pure and impure parts in programs just like Monad, 
and it also re-defined what the computation is. We can make our programs more robust and flexible if 
our computations all follow patterns described and implemented by Arrow.

But arrows can only be execute by calling it, just like other functions. This nature restrict it can't 
be used to improve event-driven programs written in Javascript, because computations in these programs 
are "composed" by interdepent events. For instance:

    Event Drag --> Event Move --> Event Drop

will make a computation "drag&drop", which can be "executed" by trigger each event sequentially.

The above computation is very different from normal arrows in Haskell. It need to be "execute" more than once, 
and the caller can be previous event handler or others like user and any async trigger. 
But the pattern it reveals can exactly match ideas in Arrow. If we modify the above event-driven version 
into a "normal" computation, it will become more obvious:

    Drag:: a DOM DOM' >>> Move:: a DOM' DOM'' >>> Drop:: a DOM'' DOM'''

( in drag&drop, the most important attribute is the DOM's coordinates )

So the main goal of this project is to build a basic mechanism, which can help us to use Arrow in our 
fully event-driven Javascript programs.

[1]:http://www.haskell.org/arrows/

## Inspired by

[Javascript Arrowlets][2]:  A paper and implementation about Arrow in Javascript. This project is inspired by it.

[2]: http://www.cs.umd.edu/projects/PL/arrowlets/api-arrowlets.xhtml

## Related Project

[FunTang Language Tools][3]: This project want to build a language extend CoffeeScript with functional features,
and the Arrow will be a main part of the language.

[3]: https://github.com/snowmantw/FunTang 


## License 

Fluorine: Arrow in Javascript with fully event-driven features Copyright (C) 2012 Greg Weng, snowmantw@gmail.com

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see http://www.gnu.org/licenses/.
