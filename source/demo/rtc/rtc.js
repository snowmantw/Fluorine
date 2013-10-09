
//    RTC()
//      .id()           // (a): RTC {ice: ICE, sdp: SDP} -> (() -> m ID) -> RTC ChannelID
//      .channels()     // (b): RTC ChannelID -> (ChannelID -> m [OffererInfo]) -> RTC [OfferInfo]
//      .filter()       // (b): RTC [OfferInfo]-> (OfferInfo -> m Boolean) -> RTC [OfferInfo]
//      .signal()       // (c): RTC [OfferInfo] -> ([OfferInfo] -> m ()) -> RTC ()
//      .establish()    // (d): RTC () -> (() -> m AnswerInfo) -> RTC ()
//      .forward()      // After *all* channels got connected or failed, we can start to forward native events.
//      .forward()      // The RTC events would be prefixed with 'rtc.<channelID>'
//      ...
//      .video()        // TODO: Attach the video stream
//      .audio()        // TODO: Attach the audio stream
//      .done()

const TESTAPIS
var getId = function(info)
{
    // POST: register a new offerer on the remote.
    return IO(JSON.stringify(info))
      .post(TESTAPIS+'/id')
      ._(function(id)
      {
        signalPolling(id)
        window.current_id = id
        return id
      })
      .done()
}

var getChannels = function(id)
{
    // POST: create a query to query all available channels.
    return IO(JSON.stringify(info)).post(TESTAPIS+'/channels').done()
}

var vanillaFilter = function(chinfo)
{
    if(chinfo.id === window.current_id)
    {
        return false
    }
    return true
}

// Send all auto-generated answerers to the offerers.
// This is one of the major difficulties of the RTC handshake:
// how can I communicate with the other offerers which only
// registered their info on the remote?
//
// So, the offerers must provide a polling or other signaling
// information on the server, too. And then this method can signal
// it according to the information.
//
// In our test, we use polling to implement the signaling.
// Offerer should poll the server according to their channel ID,
// to get the information from its corresponding answerer.
var sendAnswerers = function(ansinfos)
{
    // JSON doesn't allow anonymous element (the array).
    return IO(JSON.stringify({data :ansinfos, type: 'answers-info'})).post(TESTAPIS+'/signal').done()
}

// Must give the {Type: Function(SignalInfo)} as handlers
var signalPolling = function(id)
{
    var pollingid = setInterval(function RTCTest_signal_polling()
    {
        IO().get(TESTAPIS+'/signal-polling/'+id)
          ._(function RTCTest_handle_signal_polling(enc_result)
          {
              var result = JSON.parse(enc_result)
              if( 'none' !== result.type)
              {
                  Notifier.trigger('signal.'+result.type, {'data': result.data})
                  clearInterval(pollingid)
              }
          })
          .done()()
    }, 400)
}

var establishWaiting = function()
{
    return Event('signal.answerer-info')
      ._(function RTCTest_establishWaiting(info)
      {
          // NOTE: Can we just wait like this??
          return info
      })
      .done()
}

fluorine.infect()
fluorine.Notifier.init()

RTC()
  .id(getId)
  .channels(getChannels)
  .filter(vanillaFilter)
  .signal(sendAnswerers)
  .establish(establishWaiting)
  .done()

