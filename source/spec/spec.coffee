
#
#jasmine.specFilter = function(spec) {
#    return consoleReporter.specFilter(spec);
#};
#
self.Process = self.fluorine.Process
describe "Process", ->
  proc = null
  beforeEach ->
    proc = Process()

  describe "#next", ->
    it "should grow while each action adds their executing part into the process.", ->
      proc.next (a) ->
        a + 1

      proc.next (a, b) ->
        b + 2

      proc.next (a, b, c) ->
        c + 3

      proc.next (a, b, c, d) ->
        d + 4

      proc.next (a, b, c, d, e) ->
        e + 5

      expect(proc.__queue.length).toEqual 5


  describe "#run", ->
    it "should execute only one function after run once.", ->
      proc.next (a) ->
        proc.run a + 1

      proc.next (b) ->
        proc.run b + 1

      proc.run 0
      expect(proc.extract()).toEqual 2

    it "should execute exactly n times after run n times.", ->
      proc.next (a) ->
        proc.run a + 1

      proc.next (b) ->
        proc.run b + 2

      proc.next (c) ->
        proc.run c + 3

      proc.run 0
      expect(proc.extract()).toEqual 6

    it "should conquer the asynchronous callback hell.", ->
      runs ->
        proc.next ->
          proc.run 99

        proc.next ->
          jQuery.get "/testAjax", (data) ->
            proc.run data # the end of asynchronous steps


        proc.next (data) ->
          proc.run data

        proc.run() # synchronous

      waits 500
      runs ->
        expect(Number(proc.extract())).toEqual 100




self.Process = self.fluorine.Process
self.Environment = self.fluorine.Environment
self.IO = self.fluorine.IO
describe "IO", ->
  beforeEach ->
    fluorine.Notifier.init()

  describe "#as", ->
    parser = (str_num) ->
      console.log "parsed --> ", Number(str_num)
      Number str_num

    it "should name results of previous computation as user needed", ->
      # 300
      # 0 + 100 + 300 
      m = IO()._(->
        console.log "first in IO"
        0
      ).as("arm").get("/testAjax")._(parser).as("boost")._(->
        @arm + @boost + 200
      ).as("chaar")._(->
        @arm + @boost + @chaar
      ).done()
      runs ->
        m.run()

      # runs
      waits 500
      runs ->
        
        # Extract the value in the process.
        # It's valid only when all steps got executed.
        #
        # If the monad has any asynchronous steps,
        # the proc will hold nothing unless user can extract it 
        # after all asynchronous steps got executed.
        expect(m.__proc.extract()).toEqual 400


    # it
    it "should be able to request binary data from server.", ->
      isGIF = false
      
      # make sure it's a gif (GIF8)
      m1 = IO().getBinary("/media/TestGIF.gif")._((data) ->
        arr = new Uint8Array(data)
        i = undefined
        len = undefined
        length = arr.length
        frames = 0
        isGIF = true  if arr[0] is 0x47 or arr[1] is 0x49 or arr[2] is 0x46 or arr[3] is 0x38
      ).done().run()
      waits 500
      runs ->
        expect(isGIF).toEqual true


    # it
    it "should be able to bind to UI monad.", ->
      act = (ui_dom) ->
        IO().getBinaryBlob("/media/TestGIF.gif")._((blob) ->
          window.URL = {}  unless window.URL
          window.URL.createObjectURL = window.webkitURL.createObjectURL  if not window.URL.createObjectURL and window.webkitURL.createObjectURL
          url = URL.createObjectURL(blob)
          dom_img = document.createElement("img")
          $(dom_img).attr "src", url
          dom_img
        ).toUI(ui_dom.get(0)).done()

      ui = fluorine.UI("body").$().bind(act).done()
      ui.run()
      waits 500
      runs ->
        expect($("img").length).toEqual 1


    # it
    it "should be able to bind another monadic action.", ->
      
      # split previous test to two monad
      # Note: This action will be applied under the environment of binding monad.
      m2Act = (a) ->
        THIS = this # the environment of previous monad.
        # from previous, testAjax
        # id, from previous monad
        # 300
        # 0 + 100 + 300 
        IO()._(->
          a
        ).as("boost")._(->
          console.log "arm -->", THIS.arm
          THIS.arm
        ).as("arm")._(->
          @arm + @boost + 200
        ).as("chaar")._(->
          @arm + @boost + @chaar
        ).done()

      m1 = IO()._(->
        0
      ).as("arm").get("/testAjax")._(parser)._((a) ->
        console.log "parsed --> ", a
        a
      ).bind(m2Act).done()
      runs ->
        m1.run()

      # runs
      waits 500
      runs ->
        expect(m1.__proc.extract()).toEqual 400




# it
#describe IO
describe "Environment", ->
  environment = null
  beforeEach ->
    environment = Environment(
      foo: "foo"
      bar: 2
    )
    fluorine.Notifier.init()

  describe "#local", ->
    it "should allow the local function can compute something under the environment.", ->
      t1 = ->
        chaar: @bar + 3

      expect(environment._(t1).done().run().extract()["chaar"]).toEqual 5


  describe "#bind", ->
    it "should allow computations that mixin IO in it", ->
      parser = (str_num) ->
        Number str_num

      t1 = ->
        console.log "this in bound combinator:", this
        bar = @bar # The "this" will be the environment.
        
        #console.log('bar:', bar);   // Not standard usage.
        # The inner IO monad will change the environment
        # and embedded the result to base environment. 
        act = IO()._(->
          console.log "first compute"
        )._(->
          console.log "second compute"
        ).get("/testAjax", "remote").get("/testAjax", "remote2")._(parser)._((num_remote) ->
          console.log "after ajax"
          console.log "num_remote+bar:", num_remote + bar
          num_remote + bar
        ).toEnvironment("chaar").done()
        act

      environment._(->
        bar: 99
      ).bind(t1)._(->
        console.log @chaar
        chaar: @chaar
        delta: @chaar is 199
        bar: 299
      ).done()
      m = environment.run()
      waits 500
      runs ->
        m = m
        expect(m.extract()["delta"]).toEqual true


    # it
    it "should allow use multiple mixed Environment and IO computations.", ->
      result = null
      parser = (str_num) ->
        Number str_num

      
      # chaar = 200;
      
      # dijk = 300
      
      # erl = 400
      env_mixed = Environment( #env_mixed
        arm: 0
        boost: 100
      )._(->
        console.log @arm
        this
      )._(->
        console.log @boost
        this
      ).bind(->
        IO().get("/testAjax")._(parser)._((num_remote) ->
          num_remote + 100
        ).toEnvironment("chaar").done()
      )._(->
        console.log @chaar
        this
      ).bind(->
        IO().get("/testAjax")._(parser)._((num_remote) ->
          num_remote + 200
        ).toEnvironment("dijk").done()
      )._(->
        console.log @dijk
        this
      ).bind(->
        IO().get("/testAjax")
            ._(parser)
            ._
            ((num_remote) ->
                num_remote + 300
            )
            .toEnvironment("erl")
        .done()
      )._(->
        console.log @erl
        this
      )._(->
        console.log this
        fin: @erl
      ).done()
      runs ->
        env_mixed.run()

      waits 500
      runs ->
        expect(env_mixed.__proc.extract()["fin"]).toEqual 400
# it
# describe #local
# describe Environment
#

jasmine.updateInterval = 250
jasmine.getEnv().addReporter new jasmine.ConsoleReporter(console.log)
jasmine.getEnv().execute()

