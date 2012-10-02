

self.fluorine = self.fluorine || {}

#
# The Notifier is the core of fluorine at low-level.
# Every cross-components computation should use notification rather than directly call each other.
# Every notification will be handled asynchronized, even though this is implementation depended.
#
# It's also a Context, so user can use fluent interface to call it, and compose the action.
#
# ----
#
# ## Notifier

# The namespace objects.
fluorine.Notifier = {}

#
# Initialize the notifier.
# If there're registered handlers in previous notifier,
# they will be wiped out
#
# init:: Notifier n 
fluorine.Notifier.init = ->
  fluorine.Notifier.trie = {}
  fluorine.Notifier


#
# Register a handler on a note.
#
# The last argument, "context", can be any object, 
# and the callback will be called with it as context.  
# 
# The note is namespaced, so if a note "abc.de" triggered, 
# handlers bound on "abc.de.gh" will also be triggered.
#
# on:: Notifier n -> ( NoteName, (note -> a), Context ) -> Notifier n'
fluorine.Notifier.on = (str_names, cb, context) ->
  return  if "" is str_names # don't allow the empty name, even though it will match "all" notes.
  fluorine.EventTrie.set fluorine.Notifier.trie, str_names, (note) ->
    cb.call context, note

  fluorine.Notifier


#
# Trigger a note. The format of a note is
#  
#      {name: "namespaced.note.name", <key>: <value>}
#
# Only the "name" filed is required.
#
# trigger:: Notifier n -> Note -> Notifier n
fluorine.Notifier.trigger = (note) ->
  
  # note is a single string.
  note = name: note  unless note.name
  cbs = fluorine.EventTrie.match(fluorine.Notifier.trie, note.name)
  itr = 0

  while itr isnt cbs.length
    cb = cbs[itr]
    cb.call null, note
    itr++
  
  # Implement async calling.
  # It cause some problems, and I can only freeze it until do a exhausted check.
  # OK, it's bad to use global variable. But how can I do this without it ?
  #__st__ = setTimeout(function(){ cb.call(null,note); clearTimeout(__st__); },0);
  fluorine.Notifier


#
# Remove a handler from Notifier.
# The name of note is still namespaced. 
# So if the parent got removed, children under the name will also be removed.
#
# off:: Notifier n -> NoteName -> Notifier n
fluorine.Notifier.off = (str_names) ->
  fluorine.EventTrie.remove fluorine.Notifier.trie, str_names


# ## Inner structure of fluorine.Notifier
#
# DO NOT USE. IT'S ONLY FOR IMPLEMENTS.
fluorine.EventTrie = {}
fluorine.EventTrie.set = (tree, str_names, cb) ->
  fluorine.EventTrie.doSet tree, str_names.split("."), cb

fluorine.EventTrie.doSet = (tree, names, cb) ->
  entry = tree[names[0]]
  if 1 is names.length
    if `undefined` is entry
      tree[names[0]] = __data__: cb
    else
      tree[names[0]]["__data__"] = cb
    return
  
  # No such subtrie yet, create it.
  tree[names[0]] = __data__: null  if `undefined` is entry
  fluorine.EventTrie.doSet tree[names[0]], names.slice(1), cb

fluorine.EventTrie.remove = (tree, str_names) ->
  fluorine.EventTrie.doRemove tree, str_names.split(".")

fluorine.EventTrie.doRemove = (tree, names) ->
  entry = tree[names[0]]
  if 1 is names.length
    
    # delete all related objects.
    delete tree[names[0]]

    return
  fluorine.EventTrie.doRemove tree[names[0]], names.slice(1)  unless `undefined` is entry

fluorine.EventTrie.match = (tree, name) ->
  fluorine.EventTrie.doMatch tree, name.split(".")

fluorine.EventTrie.doMatch = (tree, names) ->
  return fluorine.EventTrie.getNodes(tree, [])  if 0 is names.length
  entry = tree[names[0]]
  
  #throw new Error("ERROR: Match nothing in EventTrie. name: "+names[0]);
  return []  if `undefined` is entry
  fluorine.EventTrie.doMatch entry, names.slice(1)


# get all nodes after matching point.
fluorine.EventTrie.getNodes = (tree, mem) ->
  mem.push tree.__data__  unless null is tree.__data__
  for idx of tree
    fluorine.EventTrie.getNodes tree[idx], mem  unless "__data__" is idx
  mem
