// Create a new Webex app instance
var app = new window.Webex.Application();

// Wait for onReady() promise to fulfill before using framework
app.onReady().then(() => {
    log("App ready. Instance", app);
}).catch((errorcode) =>  {
    log("Error with code: ", Webex.Application.ErrorCodes[errorcode])
});

// Retrieving PUBLIC_URL
const urlToShareBase = document.getElementById('publicUrl').value;


/*
function handleSetPresentationURL
*/

// Button click handler to set share URL
function handleSetShare() {
    var urlToShare = urlToShareBase + '/timer';
    var titleToShare = 'Timer App'
    // Try this instead of set share. Uncomment below to add a error check. uncomment above to also make this work.
    //meeting.setPresentationUrl(urlToShare, "Timer App", Webex.Application.ShareOptimizationMode.AUTO_DETECT, false).then(() => {
    app.setShareUrl(urlToShare, '', titleToShare).then(() => {
            // checking for an exisiting session
/*        if (app.isShared) {
            log('ERROR: setShareUrl() should not be called while session is active');
               return;
        }*/
        log('Set share URL', urlToShare);
        // Redirect to the timer page
        window.location.href = '/timer';
    }).catch((errorcode) => {
        log('Error: ', Webex.Application.ErrorCodes[errorcode]);
    });
}

// Utility function to display app messages
function log(type, data) {
    var ul = document.getElementById("console");
    var li = document.createElement("li");
    var payload = document.createTextNode(`${type}: ${JSON.stringify(data)}`);
    li.appendChild(payload)
    ul.prepend(li);
}
