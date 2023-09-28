// Create a new Webex app instance
var app = new window.Webex.Application();
var meetingID = null;
// Retrieving PUBLIC_URL
const urlToShareBase = document.getElementById('publicUrl').value;

// Wait for onReady() promise to fulfill before using framework
app.onReady().then(() => {
    log("App ready. Instance", app);
    getMeetingInfo();
}).catch((errorcode) =>  {
    log("Error with code: ", Webex.Application.ErrorCodes[errorcode])
});

// Define a function to handle getting the meeting info
function getMeetingInfo() {
    app.context.getMeeting().then((m) => {
        log('getMeeting()', m);
        meetingID = m.id;  // Store the meeting identifier
    }).catch((error) => {
        log('getMeeting() promise failed with error', Webex.Application.ErrorCodes[error]);
    });
}

// Button click handler to set share URL
function handleSetShare() {
    var urlToShare = urlToShareBase + '/timer';
    var titleToShare = 'Timer App'
    app.setShareUrl(urlToShare, '', titleToShare).then(() => {
        log('Set share URL', urlToShare);
        // Redirect to timer page & Append meetingID as a query parameter
        window.location.href = '/timer?meetingID=' + encodeURIComponent(meetingID);
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
