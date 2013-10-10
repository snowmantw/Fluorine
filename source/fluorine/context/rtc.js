
if( _.isUndefined(self.fluorine) )
{
    throw new Error('[ERROR] Should include fluorine.utils first.')
}

// ----
// ## RTC
//
// WebRTC context *builder*. It provides a fluent flow to establish the connection.
// User must provide other context functions to help the signal channel got established,
// which include:
//
// - Get signal channel ID (a)
// - Fetch all available channels' ID (b)
// - Update ICE & SDP information construct the channel on the remote (c)
// - Get Answer info and establish the connection (d)
//
// After RTC connection established, user should forward native events to handle them by
// the Event context as usual.
//
// Note that we will have a single-offerer, multi-answerers inside the context.
// Every offerer can register itself on the remote, then the answerers can the retrieve them.
//
// Usage:
//    
//    RTC()
//      .id()           // (a): RTC {ice: ICE, sdp: SDP} -> (() -> m ID) -> RTC ChannelID
//      .channels()     // (b): RTC ChannelID -> (ChannelID -> m OfferInfos)-> RTC OfferInfos
//      .filter()       // (b): RTC OfferInfos -> (OfferInfo -> Boolean) -> RTC OfferInfos
//      .signal()       // (c): RTC OfferInfos -> (OfferInfos -> m ()) -> RTC ()
//      .establish()    // (d): RTC () -> (() -> m AnswerInfo) -> RTC ()
//      .forward()      // After *all* channels got connected or failed, we can start to forward native events.
//      .forward()      // The RTC events would be prefixed with 'rtc.<channelID>'
//      ...
//      .video()        // TODO: Attach the video stream
//      .audio()        // TODO: Attach the audio stream
//      .done()
//
// Type:
//    OfferInfo    :: {id: ChannelId, ice: ICE, sdp: SDP}
//    AnswerInfo   :: {id: ChannelId, ice: ICE, sdp: SDP}
//    OfferInfos   :: {id: OfferInfo}
//    AnswerInfos  :: {id: AnswerInfo}
//
// Model Diagram:
//
//    [Remote]            --               [Local]
//    --------------------------------------------
//    (auto-gen) Answerer -- Offerer  (created)
//    (created)  Offerer  -- Answerer (auto-gen)
//    (created)  Offerer  -- Answerer (auto-gen)
//    (created)  Offerer  -- Answerer (auto-gen)
//
//

self.fluorine.RTC = function RTC(a)
{
  return new self.fluorine.RTC.o(a)
}
self.fluorine.RTC.o = function RTC_o(a)
{
  self.fluorine.Context.o.call(this, a)
  this.offerer = null
  this.answerers = {}
}
_.extend( self.fluorine.RTC.o,
{
    __getPeerConnection: function()
    {
        return 'undefined' !== typeof(mozRTCPeerConnection) ? mozRTCPeerConnection : webkitRTCPeerConnection
    }
})

// Extends the basic context.
_.extend( self.fluorine.RTC.o.prototype, self.fluorine.Context.o.prototype )

// Define it's uniq method beyond the basic context.
self.fluorine.RTC.o.prototype = _.extend
( self.fluorine.RTC.o.prototype
,
{
     __answerer_onChannelMessage: function RTC_o__answerer_onChannelMessage()
    {

    }

    ,__answerer_onChannelOpened: function RTC_o__answerer_onChannelOpened()
    {

    }

    ,__offerer_onChannelMessage: function RTC_o__offerer_onChannelMessage(evt)
    {
        console.log('offerer - channelMessage', evt.data)
    }

    ,__offerer_onChannelOpened: function RTC_o__offerer_onChannelOpened(evt)
    {
        var channel = evt.channel
        // Can set binary format here.
        
        console.log('offerer - channelOpened')
        channel.onmessage = this.__offerer_onChannelMessage.bind(this)
    }

    // Register this peer's offerer SDP and ICE to remote and get the channel ID.
    ,id: function RTC_o_id(idgetter)
    {
        // Should get IDs after the getter got executed.
        var step = function RTC_o_id_step(ids)
        {
            var _this = this

            // Bind two asynchronous data (ICE & SDP) to one step
            // without 'yield'.
            var mkInfo = {result: {}}
            mkInfo.next = function RTC_o_id_mkInfo(type, info)
            {
                mkInfo.result[type] = info

                // 'Waiting' the next result and then execute the chain
                // to update them on remote.
                mkInfo.next = function RTC_o_id_mkInfo_final(t2, i2)
                {
                    mkInfo.result[t2] = i2
                    _this.__process.run(mkInfo.result)
                }
            }

            // Current we have only data channel.
            var offerer = new RTC.o.__getPeerConnection(servers
                            ,{optional: [RtpDataChannels: true]})
            offerer.onicecandidate = function RTC_o_idstep_ICE(evt)
            {
                mkInfo.next('ice', candidate)
            }
            offerer.createOffer(function RTC_o_idstep_SDP(evt)
            {
                offerer.setLocalDescription(evt.desc.sdp)
                mkInfo.next('sdp', evt.desc.sdp)
            })
            offerer.ondatachannel = this.__offerer_onChannelOpened.bind(this)

            // Put the `process.run` in the `mkInfo`
        }
        this.__process.next(step.bind(this), 'RTC::id')

        // Tie it after run our handler, which should be able to send
        // the info out.
        this.tie(idgetter)
            .tie(function RTC_o_id_datachannel(id)
            {
                offerer.createDataChannel(id, { reliable: false })
            })

        return this
    }
/*

    // Get SDP, ICE and other information from offerers.
    ,channels: function RTC_o_channels(chgetter)
    {
        this.tie(chgetter)
        var step = function RTC_o_channels_step(channels)
        {
            this.__process.run(channels)
        }
        this.__process.next(step.bind(this), 'RTC::channels')

        return this
    }

    // Pick up which channels this peer will need.
    ,filter: function RTC_o_filter(pred)
    {
        var step = function RTC_o_filter_step(infos)
        {
            var results = {}
            for(var id in infos)
            {
                var info = infos[id]
                if(pred(info))
                {
                    results[info.id] = info
                }
            }
            this.__process.run(results)
        }
        this.__process.next(step.bind(this), 'RTC::filter')

        return this
    }

    // Need to let the offerer handles ICEs and SDPs form remote to answer the answerer's info.
    // Except the Offerer offered by this peer itself, it must create as much as the channels
    // selected at the filter stage.
    //
    // The other thing this stage should process is the created answerers should send their
    // ICE and SDP back to the offerers. This will be done with the action provided to this function.
    //
    // sending_method:: [OfferInfo] -> m ()
    ,signal: function RTC_o_signal(sending_method)
    {
        var step = function RTC_o_signal_step(infos)
        {
            var _this = this

            // Bind two asynchronous data (ICE & SDP) to one step
            // without 'yield'.
            var mkInfo = {}
            mkInfo.next = function RTC_o_id_mkInfo(type, info, id, acc)
            {
                // 'Waiting' the next result and then execute the chain
                // to update them on remote.
                mkInfo.next = function RTC_o_id_mkInfo_final(t2, i2, id,acc)
                {
                    acc[id][type] = info
                    acc[id][t2] = i2

                    // Must detect whether this is the last info and then send them all at once.
                    if(infos.length == acc.length)
                    {
                        _this.__process.run(acc)
                    }
                }
            }

            var acc = {}

            // Create answerers for each information.
            for( var id in infos)
            {
                var info = infos[id]
                var RTCPeerConnection = RTC.o.__getPeerConnection()
                var answerer = new RTCPeerConnection(
                {  offerSDP: info.sdp
                ,  onAnswerSDP: function(sdp)
                  {
                      // Send the answerer's SDP to the offerer.
                      mkInfo.next('sdp', sdp, id, acc)
                  }
                ,  onICE: function (candidate)
                  {
                      // Send the answerer's ICE to the offerer.
                      // TODO: offerer must provide a way to hook the transferring the SDP and ICE to.
                      mkInfo.next('ice', candidate, id, acc)
                  }
                , onChannelMessage: this.__answerer_onChannelMessage
                , onChannelOpened: this.__answerer_onChannelOpened
                });

                this.answerers[info.id] = answerer
            }
        }
        this.__process.next(step.bind(this), 'RTC::signal')

        // Tie it after run our handler, which should be able to send
        // the info out.
        this.tie(sending_method)

        return this
    }

    // Help the offerer inside this context to handle the answerer's information,
    // then establish the connection.
    //
    // Remember that our architecture is single-offerer and multi-answerers.
    // The offerer only needs to handle one answerer's information from the remote.
    ,establish: function RTC_o_establish(waiting)
    {
        this.tie(waiting)

        // After waiting, get the information and handle them to establish the connections.
        var step = function RTC_o_establish_step(info)
        {
            this.offerer.addAnswerSDP( answer_sdp );
            this.offerer.addICE(
            { sdpMLineIndex : info.ice.sdpMLineIndex
            , candidate     : info.ice.candidate
            });

            this.__process.run()
        }
        this.__process.next(step.bind(this), 'RTC::establish')
        return this
   }
*/
})

self.fluorine.registerInfect('RTC', self.fluorine.RTC)
