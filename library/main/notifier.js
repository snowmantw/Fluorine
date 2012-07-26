
//
// The Notifier is the core of fluorine at low-level.
// Every cross-components computation should use notification rather than directly call each other.
// Every notification will be handled asynchronized, even though this is implementation depended.
//
// It's also a Context, so user can use fluent interface to call it, and compose the action.
//
// ----
//
// ## Notifier

// The namespace objects.

fluorine = {} || fluorine;
fluorine.Notifier = {};

//
// Initialize the notifier.
// If there're registered handlers in previous notifier,
// they will be wiped out
//
// init:: Notifier n 
fluorine.Notifier.init = function()
{
    fluorine.Notifier.trie = {};
    return fluorine.Notifier;
}

//
// Register a handler on a note.
//
// The last argument, "context", can be any object, 
// and the callback will be called with it as context.  
// 
// The note is namespaced, so if a note "abc.de" triggered, 
// handlers bound on "abc.de.gh" will also be triggered.
//
// on:: Notifier n -> ( NoteName, (note -> a), Context ) -> Notifier n'
fluorine.Notifier.on = function(str_names, cb, context)
{
    if( "" == str_names )
    {
        return; // don't allow the empty name, even though it will match "all" notes.
    }
    fluorine.EventTrie.set
    (   fluorine.Notifier.trie, str_names, 
        function(note)
        {   
            cb.call(context, note); 
        }
    );

    return fluorine.Notifier;
}

//
// Trigger a note. The format of a note is
//  
//      {name: "namespaced.note.name", <key>: <value>}
//
// Only the "name" filed is required.
//
// trigger:: Notifier n -> Note -> Notifier n
fluorine.Notifier.trigger = function(note)
{
    // note is a single string.
    if( ! note.name )
    {
        note = {'name': note}; 
    }

    var cbs = fluorine.EventTrie.match(fluorine.Notifier.trie, note.name);
    for( var itr = 0; itr != cbs.length; itr++)
    {

        var cb = cbs[itr];
        cb.call(null,note);

        // Implement async calling.
        // It cause some problems, and I can only freeze it until do a exhausted check.
        // OK, it's bad to use global variable. But how can I do this without it ?
        //__st__ = setTimeout(function(){ cb.call(null,note); clearTimeout(__st__); },0);
    }

    return fluorine.Notifier;
}

//
// Remove a handler from Notifier.
// The name of note is still namespaced. 
// So if the parent got removed, children under the name will also be removed.
//
// off:: Notifier n -> NoteName -> Notifier n
fluorine.Notifier.off = function(str_names)
{
    fluorine.EventTrie.remove(fluorine.Notifier.trie, str_names);
}

// ## Inner structure of fluorine.Notifier
//
// DO NOT USE. IT'S ONLY FOR IMPLEMENTS.

fluorine.EventTrie = {};

fluorine.EventTrie.set = function(tree, str_names, cb)
{
    fluorine.EventTrie.doSet(tree, str_names.split('.'), cb);
}

fluorine.EventTrie.doSet = function(tree, names, cb)
{
    var entry = tree[names[0]];
    if(1 == names.length)
    {
        if( undefined == entry )
        {
            tree[names[0]]= {'__data__': cb};
        }
        else
        {
            tree[names[0]]['__data__'] = cb
        }
        return;
    }

    // No such subtrie yet, create it.
    if( undefined == entry )
    {
        tree[names[0]] = { '__data__': null};
    }
    fluorine.EventTrie.doSet(tree[names[0]], names.slice(1), cb);
}

fluorine.EventTrie.remove = function(tree, str_names)
{
    fluorine.EventTrie.doRemove(tree, str_names.split('.'));
}

fluorine.EventTrie.doRemove = function(tree, names)
{
    var entry = tree[names[0]];
    if(1 == names.length)
    {
        // delete all related objects.
        delete tree[names[0]];
        return; 
    }

    if( undefined != entry )
    {
        fluorine.EventTrie.doRemove(tree[names[0]], names.slice(1));
    }
}

fluorine.EventTrie.match = function(tree, name)
{
    return fluorine.EventTrie.doMatch(tree, name.split('.'));
}

fluorine.EventTrie.doMatch = function(tree, names)
{

    if(0 == names.length)
    {
        return fluorine.EventTrie.getNodes(tree, []);
    } 

    var entry = tree[names[0]];
    if( undefined == entry )
    {
        //throw new Error("ERROR: Match nothing in EventTrie. name: "+names[0]);
        return [];
    }

    return fluorine.EventTrie.doMatch( entry, names.slice(1) );
}

// get all nodes after matching point.
fluorine.EventTrie.getNodes = function(tree, mem)
{
    if( null != tree.__data__ )
    {
        mem.push(tree.__data__);
    }
    for( var idx in tree )
    {
        if( "__data__" != idx )
        {
            fluorine.EventTrie.getNodes( tree[idx], mem );
        }
    }
    return mem;
}

