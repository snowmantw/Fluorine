

Process = fluorine.Process;
Environment = fluorine.Environment;
IO = fluorine.IO;

describe("IO", function(){

    beforeEach(function(){
        fluorine.Notifier.init();

    });

    describe("#as", function(){

        var parser = function(str_num)
        {
            console.log('parsed --> ', Number(str_num))
            return Number(str_num);
        }

        it("should name results of previous computation as user needed", function(){

            var m = IO()
                .compute(function(){ console.log('first in IO');return 0; })
                .as('arm')
                .get('/testAjax')
                .compute(parser)
                .as('boost')
                .compute
                 (  function()
                    {   // 300
                        return this.arm + this.boost + 200;
                    }
                 )
                .as('chaar')
                .compute
                 (  function()
                    {   // 0 + 100 + 300 
                        return this.arm + this.boost + this.chaar
                    }
                 )
                 .done()
             
             runs(function(){
                 m.run()
             }) // runs

             waits(500)

             runs(function(){

                // Extract the value in the process.
                // It's valid only when all steps got executed.
                //
                // If the monad has any asynchronous steps,
                // the proc will hold nothing unless user can extract it 
                // after all asynchronous steps got executed.
                expect(m.__proc.extract()).toEqual(400);
             });


        })  // it

        it("should be able to request binary data from server.", function(){
            var isGIF = false
            var m1 = 
            IO().getBinary("/media/TestGIF.gif")
                .compute
                 (   function(data)
                     {  var arr = new Uint8Array(data),
                            i, len, length = arr.length, frames = 0;

                        // make sure it's a gif (GIF8)
                        if (arr[0] == 0x47 || arr[1] == 0x49 || 
                            arr[2] == 0x46 || arr[3] == 0x38)
                        {
                            isGIF = true
                        }
                    
                     }
                 )
                 .done()
            .run()

            waits(500)

            runs(function(){
               expect(isGIF).toEqual(true)
            })
        })  // it

        it("should be able to bind to UI monad.", function(){

            var act  = function(ui_dom)
            {   return IO()
                    .getBinaryBlob('/media/TestGIF.gif')
                    .compute
                    (   function(blob)
                        {   if (!window.URL) { window.URL = {} }
                            if (!window.URL.createObjectURL && window.webkitURL.createObjectURL) 
                            {
                                 window.URL.createObjectURL = window.webkitURL.createObjectURL
                            }
                    
                            var url = URL.createObjectURL(blob)
                            var dom_img = document.createElement('img')
                            $(dom_img).attr('src', url)
                            return dom_img
                        }
                    )
                    .toUI( ui_dom.get(0) )
                    .done()
            }

            var ui = fluorine.UI('body')
                .$()
                .bind(act)
                .done()

             ui.run()

             waits(500)
             runs(function(){
                expect($('img').length).toEqual(1)
             })

        }) // it
        
        it("should be able to bind another monadic action.",function()
        {
            // split previous test to two monad
            // Note: This action will be applied under the environment of binding monad.
            var m2Act = function(a)
            {   var THIS = this // the environment of previous monad.

                return IO()
                .compute
                 (  function() // from previous, testAjax
                    {   
                        return a
                    }
                 )
                .as('boost')
                .compute
                 (  function()
                    {
                        console.log('arm -->', THIS.arm)
                        return THIS.arm 
                    }  // id, from previous monad
                 )
                .as('arm')
                .compute
                 (  function()
                    {   // 300
                        return this.arm + this.boost + 200;
                    }
                 )
                .as('chaar')
                .compute
                 (  function()
                    {   // 0 + 100 + 300 
                        return this.arm + this.boost + this.chaar
                    }
                 )
                 .done()
            }

            var m1 = IO()
                .compute(function(){ return 0; })
                .as('arm')
                .get('/testAjax')
                .compute(parser)
                .compute
                 (  function(a)
                    {   console.log('parsed --> ', a)
                        return a
                    }
                 )
                .bind(m2Act)
                .done()


             runs(function(){
                 m1.run()
             }) // runs

             waits(500)

             runs(function(){
                expect(m1.__proc.extract()).toEqual(400);
             });

        })  // it
    })

}); //describe IO

describe("Environment",function(){

    var environment = null;

    beforeEach(function(){
        environment = Environment({foo: "foo", bar: 2});
        fluorine.Notifier.init();
    });
    
    describe("#local", function(){

        it("should allow the local function can compute something under the environment.", function(){

            var t1 = function()
            {
               return {chaar: this.bar + 3} ;
            }

            expect(environment.local(t1).done().run().extract()['chaar']).toEqual(5)
        })
    })

    describe("#bind", function(){

        it("should allow computations that mixin IO in it", function(){

            var parser = function(str_num)
            {
                return Number(str_num);
            }

            var t1 = function()
            {   
                console.log("this in bound combinator:",this);
                var bar = this.bar; // The "this" will be the environment.
                var act = 
                IO()    
                    .compute
                     (  function()
                        {
                            //console.log('bar:', bar);   // Not standard usage.
                            console.log('first compute');
                        }
                     )
                    .compute
                     (  function()
                        {
                            console.log('second compute');
                        }
                     )
                    .get("/testAjax", "remote")
                    .get("/testAjax", "remote2")
                    .compute(parser)
                    .compute
                     (  function(num_remote)
                        {   // The inner IO monad will change the environment
                            // and embedded the result to base environment. 
                            console.log('after ajax');
                            console.log("num_remote+bar:", num_remote+bar)
                            return num_remote + bar
                        }
                     )
                     .toEnvironment("chaar")
                 .done()

                 return act;
            }

            environment
                .local
                 (  function()
                    {   return {"bar":99} }
                 )
                .bind( t1 )
                .local
                ( function()
                  { 
                      console.log(this.chaar);
                      return {"chaar": this.chaar, "delta": this.chaar == 199, "bar": 299} 
                  }

                )
            .done()

            var m = environment.run()
            waits(500)

            runs( function(){
                m = m
                expect(m.extract()["delta"]).toEqual(true);
            })

        })  // it

        it("should allow use multiple mixed Environment and IO computations.", function(){

                var result = null
                var parser = function(str_num)
                {
                    return Number(str_num);
                }

                var env_mixed = 
                Environment({"arm": 0, "boost": 100})
                .local( function(){ console.log(this.arm); return this} )
                .local( function(){ console.log(this.boost); return this} )
                .bind
                (   function()
                    {    return IO()
                            .get("/testAjax")
                            .compute(parser)
                            .compute
                            (  function(num_remote)
                                {   
                                    // chaar = 200;
                                    return num_remote + 100;
                                }
                            )
                            .toEnvironment("chaar")
                        .done()
                     }
                )
                .local( function(){ console.log(this.chaar); return this } )
                .bind
                (   function()
                    {   return IO()
                            .get("/testAjax")
                            .compute(parser)
                            .compute
                            (   function(num_remote)
                                {
                                    // dijk = 300
                                    return num_remote + 200;
                                }
                            )
                            .toEnvironment("dijk")
                        .done()
                    }
                )
                .local( function(){ console.log(this.dijk); return this} )
                .bind
                (   function()
                    {   return IO()
                            .get("/testAjax")
                            .compute(parser)
                            .compute
                            (   function(num_remote)
                                {
                                    // erl = 400
                                    return num_remote + 300;
                                }
                            )
                            .toEnvironment("erl")
                        .done()
                    }
                )
                .local( function(){ console.log(this.erl); return this;} )
                .local
                (   function()
                    {   
                        console.log(this);
                        return {'fin':this.erl}
                    }
                )
                .done() //env_mixed

            runs(function(){

                env_mixed.run()
            })

            waits(500)

            runs(function(){
                expect(env_mixed.__proc.extract()["fin"]).toEqual(400);
            })
                
        }); // it
    })  // describe #local
}); // describe Environment
