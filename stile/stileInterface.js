/**
 *  Stile iFrame communication interface
 *
 *  No need to touch anything in here, all your scripts should be added to main.js instead.
 *
 *  Read docs/stileInterface.md for information on how to interact with Stile from your
 *  widget using this interface.
**/
(function(){
    var eventCallIdCounter = 0;

    // Global interface of callbacks for Stile to call.
    window.stileInterface = window.stileInterface || {
        getWindowDimensions: function(callback){
            var body = document.body;
            var html = document.documentElement;

            var width = Math.max( body.scrollWidth, body.offsetWidth,
                                    html.clientWidth, html.scrollWidth, html.offsetWidth );
            var height = Math.max( body.scrollHeight, body.offsetHeight,
                                    html.clientHeight, html.scrollHeight, html.offsetHeight );

            var dimensions = {
                width: width,
                height: height
            };

            callback(null, dimensions);
        }
    };

    // Get the passed in source that for the iframe, used to filter the response to
    // a single domain so we're not sending this to everyone.
    var sourceOrigin = decodeURIComponent(document.location.hash.replace(/^#/, ''));

    // Post the jsonData back to the source frame.
    function postJSONData(jsonData){
        if(typeof jsonData !== "object"){
            throw new TypeError('jsonData should be an object');
        }

        var message = JSON.stringify(jsonData);
        window.parent.postMessage(message, sourceOrigin);
    }

    // Generate an error in our response object.
    function generateErrorResponse(type, message){
        return {
            error: true,
            errorType: type,
            errorText: message
        };
    }

    function handleRPCCall(method, methodArguments, callId){
        var methodCallback = window.stileInterface[method];
        function callback(err, response){
            if(err) {
                postJSONData({
                    rpcCallId: callId,
                    response: generateErrorResponse(err.name, err.message)
                });
                return;
            }

            postJSONData({
                rpcCallId: callId,
                response: response
            });
        }

        if(method === 'getCapabilities') {
            callback(null, Object.keys(window.stileInterface));
        } else if(typeof methodCallback !== "function"){
            callback(generateErrorResponse(
                "NotImplemented",
                method + " has not been implemented"
            ));
        } else {
            methodCallback.apply(null, [callback].concat(methodArguments));
        }
    }

    window.sendStileEventCall = function sendEventCall(eventName, eventArguments){
        var callId = "event" + (eventCallIdCounter++);

        postJSONData({
            eventCallId: callId,
            event: eventName,
            eventArguments: eventArguments
        });
    };


    window.addEventListener("message", function (event){
        // If the message wasn't from the source provided initially then
        // ignore the message.
        if(event.origin !== sourceOrigin) return;

        // Parse the message data, if it isn't JSON return an error mesage
        var eventData;
        try {
            eventData = JSON.parse(event.data);
        } catch(e) {
            postJSONData({
                reponse: generateErrorResponse(
                    "MalformedRequest",
                    "Malformed message data: " + event.data
                )
            });
            return;
        }

        handleRPCCall(eventData.method, eventData.rpcArguments, eventData.rpcCallId);
    }, false);
}());