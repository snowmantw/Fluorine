
fluorine.Notifier.init()
fluorine.Event('app.bootstrap')
        .bind\
        ( -> fluorine.UI('#queue').$()
                .append\
                (
                   _.template(self.app.Template['queue-block'])(
                       { 'content': "Todo..."
                       , 'date': (new Date()).getTime().toString() 
                       })
                )
                .done()
        )
        .out('done')( (t)-> return {'t':t} )
        .done()
        .run()
 
fluorine.Notifier.on('done', (n)-> console.log(n) )

