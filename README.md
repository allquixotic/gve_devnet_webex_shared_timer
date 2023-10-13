# gve_devnet_webex_shared_timer
The goal is to create a similar feature to the "shared timer" to deploy it as a private embedded app.


## Contacts
* Mark Orszycki

## Solution Components
* Webex
* Python
* Javascript
* HTML


## Prerequisites
#### Create a Webex Embedded App 
1. Navigate to https://developer.webex.com/ and login. 
2. Click on your icon > My Webex Apps (https://developer.webex.com/my-apps)
3. Create new App
4. Select "Meeting" & "Messaging". 
5. Give your app a name in the “Embedded app name” field. This will be the name you see when launching your app in Webex.
6. Fill in the “App Hub Description”
7. Upload an icon or select a default. This will be the icon you see when launching your app in Webex.
8. Enter your application’s PUBLIC_URL without the protocol in the “Valid Domains” field. I.E. using ngrok to test, enter the public domain that points to your endpoint ‘abc1–xyz3-410-c0c8-1806-00-1fj1.ngrok-free.app’
9. Enter your application’s PUBLIC_URL in the “Start Page URL” field. I.E. using ngrok to test, enter public url that points to your endpoint ’https://abc1–xyz3-410-c0c8-1806-00-1fj1.ngrok-free.app’.
10. Select your layout preference (side panel or main view)
11. Add Embedded App
12. Copy/paste your public URL into the .env file into variable PUBLIC_URL=https://abc1–xyz3-410-c0c8-1806-00-1fj1.ngrok-free.app


> To read more about Webex Embedded Applications, you can find information [here](https://developer.webex.com/docs/embedded-apps)

#### Environment Variables Setup
For ease of configuration and better security, this application uses a `.env` file. Create a `.env` file in the root directory of your project and add the following entries:
```env
PUBLIC_URL=YOUR_FLASK_ENDPOINT_URL
```

## Installation/Configuration
1. Clone this repository with `git clone https://wwwin-github.cisco.com/gve/gve_devnet_webex_shared_timer.git`
2. Ensure Docker is installed.
3. Set up your `.env` file as per the instructions above.
4. Install the requirements with `pip3 install -r requirements.txt`


## Usage
1. Run the program.
2. If the app is still in development: "Open and share my personal information" & click "Open."

Run the program, using the command:
```shell
docker-compose up --build
```

* Note if using ngrok to test the application on a local machine, you will have to click 'visit' after step 2.


## Embedded Application Flow
1. The process starts with a meeting participant clicking the Apps button (in a meeting) or tab (in a space) to view the list of available apps, and then opening your app.
2. An ‘initiator app’ will open. This is URL specified in your "Start Page URL" when you create a new embedded app in the Developer Portal. The “Start Page URL” lands at the Flask endpoint index.html page (PUBLIC_URL in .env). The purpose of the initiator app is to share the URL of an app — timer.html + timer.js + app.py in our case — that is either opened with meeting participants in real-time, or added as a tab to a space. You can customize the "Start Page URL" page by editing index.html, index.js, and styles.css file. This page must contain a button that calls the embedded apps framework’s setShareUrl() method and pass the URL of your application (‘PUBLIC_URL/timer’ in our case). If you attempt to skip this step, the Open for all or Add to tab button will not appear.
3. Click the ‘Launch’ button. This will call the setshareURL() method and the application will appear for you. 
4. Click Open for all (or Add to tab for spaces) to open for all participants.

# Screenshots

![/IMAGES/0image.png](/IMAGES/0image.png)

### LICENSE

Provided under Cisco Sample Code License, for details see [LICENSE](LICENSE.md)

### CODE_OF_CONDUCT

Our code of conduct is available [here](CODE_OF_CONDUCT.md)

### CONTRIBUTING

See our contributing guidelines [here](CONTRIBUTING.md)

#### DISCLAIMER:
<b>Please note:</b> This script is meant for demo purposes only. All tools/ scripts in this repo are released for use "AS IS" without any warranties of any kind, including, but not limited to their installation, use, or performance. Any use of these scripts and tools is at your own risk. There is no guarantee that they have been through thorough testing in a comparable environment and we are not responsible for any damage or data loss incurred with their use.
You are responsible for reviewing and testing any scripts you run thoroughly before use in any non-testing environment.