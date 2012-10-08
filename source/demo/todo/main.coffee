
self.app ?= {}
self.app.Queue ?= {}

# Render functions only render template to string.
# Generating DOMs can be completed by other functions.

# Render one queue-block to string.
#
# :: Text -> Date -> [HTML Button] -> String
self.app.Queue.renderBlock = (content) -> (date) -> (buttons) ->
   _.template(self.app.Template['queue-block'])\
       ( 'content': content, 'date': date.toString(), 'buttons': buttons )

# Render single block button to string.
#
# :: CSSClass {-the css class of this button-} -> String
self.app.Queue.renderBlockButton = (clz) ->
  _.template(self.app.Template['queue-block-menu-button'])('type':clz)

fluorine.Notifier.init()
fluorine.Event('app.bootstrap')
        .bind\
        ( () -> fluorine.UI('#queue')
                .$()
                .append\
                (  self.app.Queue.renderBlock('Todo...')
                        (new Date())([self.app.Queue.renderBlockButton('bt1')])
                )
                .done()
        )
        .out('done')( (t)-> return {'t':t} )
        .done()
        .run()
 
fluorine.Notifier.on('done', (n)-> console.log(n) )


