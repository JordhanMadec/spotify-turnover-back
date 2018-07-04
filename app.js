//-----------------------------------//
//  Server for Spotify Turnover API  //
//-----------------------------------//

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var SpotifyWebApi = require('spotify-web-api-node');
var Cookies = require('cookies');

console.log("API_URL: ", process.env.API_URL);

// Cookie identifiers
const STATE_KEY = 'spotify_auth_state',
    ACCESS_TOKEN = 'access_token',
    REFRESH_TOKEN = 'refresh_token',
    REQUIRER_URI = 'requirer_uri';

// CREDENTIALS
const SCOPES = ['user-read-private', 'user-read-email'],
    CLIENT_ID = process.env.CLIENT_ID,
    CLIENT_SECRET = process.env.CLIENT_SECRET,
    REDIRECT_URI = process.env.REDIRECT_URI;

var credentials = {
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUri: REDIRECT_URI
};








/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function (length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};










// INIT SERVER
var spotifyApi = new SpotifyWebApi(credentials);
var myRouter = express.Router(); 
var app = express();
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});








/*
 *   Set GET / PUT / UPDATE / DELETE methods for defined routes
 */


 /**
 * Route /
 */
myRouter.route('/').all(function (req, res) {
    console.log('ALL', '/');
    res.json("Welcome on Spotify Turnover API");
});


/**
 * Route /login
 */
myRouter.route('/login').get(function (req, res) {
    
    console.log('GET', '/login');
    
    // Create the authorization URL
    var state = generateRandomString(16);
    var authorizeURL = spotifyApi.createAuthorizeURL(SCOPES, state);

    console.log('LOGIN_URL', authorizeURL);

    // res.cookie(STATE_KEY, state);
    var cookies = new Cookies(req, res);
    cookies.set(STATE_KEY, state);
    cookies.set(REQUIRER_URI, '/#');

    res.redirect(authorizeURL);

});

/**
 * Route /callback
 */
myRouter.route('/callback').get(function (req, res) {

    console.log('GET', '/callback');

    var cookies = new Cookies(req, res);

    var code = req.query.code || null;
    var state = req.query.state || null;
    var storedState = cookies.get(STATE_KEY);
    var requirer_uri = cookies.get(REQUIRER_URI);

    if (state === null || state !== storedState) {
        res.redirect(requirer_uri + '#' +
            querystring.stringify({
                error: 'state_mismatch'
            }));
    } else {
        res.clearCookie(STATE_KEY);
        res.clearCookie(REQUIRER_URI);
        var authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            form: {
                code: code,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code'
            },
            headers: {
                'Authorization': 'Basic ' + (new Buffer(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'))
            },
            json: true
        };

        // Require access token
        request.post(authOptions, function (error, response, body) {
            if (!error && response.statusCode === 200) {

                var access_token = body.access_token,
                    refresh_token = body.refresh_token;

                // var options = {
                //     url: 'https://api.spotify.com/v1/me',
                //     headers: { 'Authorization': 'Bearer ' + access_token },
                //     json: true
                // };

                // // use the access token to access the Spotify Web API
                // request.get(options, function (error, response, body) {
                //     console.log(body);
                // });

                // Save tokens in a cookie
                spotifyApi.setAccessToken(access_token);
                spotifyApi.setRefreshToken(refresh_token);

                cookies.set(ACCESS_TOKEN, access_token);
                cookies.set(REFRESH_TOKEN, refresh_token);

                // Return the access token to the requirer
                res.redirect(requirer_uri + '#' +
                    querystring.stringify({
                        access_token: access_token,
                        refresh_token: refresh_token
                    })
                );
            } else {
                res.redirect(requirer_uri + '#' +
                    querystring.stringify({
                        error: 'invalid_token'
                    })
                );
            }
        });
    }
});


/**
 * Route /refresh_token
 */
myRouter.route('/refresh_token').get(function (req, res) {
    
    console.log('GET', '/refresh_token');

    spotifyApi.refreshAccessToken().then(
        function (data) {
            console.log('The access token has been refreshed!');

            // Save the access token so that it's used in future calls
            var access_token = data.body.access_token;
            spotifyApi.setAccessToken(access_token);
            cookies.set(ACCESS_TOKEN, access_token);
        },
        function (err) {
            console.log('Could not refresh access token', err);
        }
    );

});

/**
 * Route /logout
 */
myRouter.route('/logout').get(function (req, res) {
    spotifyApi.resetCredentials();
    res.clearCookie(ACCESS_TOKEN);
    res.clearCookie(REFRESH_TOKEN);
});

/**
 * Route /me
 */
myRouter.route('/me').get(function (req, res) {
    
    var cookies = new Cookies(req, res);

    if (cookies.get(ACCESS_TOKEN) && cookies.get(REFRESH_TOKEN)) {
        var access_token = cookies.get(ACCESS_TOKEN),
            refresh_token = cookies.get(REFRESH_TOKEN);

        var options = {
            url: 'https://api.spotify.com/v1/me',
            headers: { 'Authorization': 'Bearer ' + access_token },
            json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function (error, response, body) {
            res.json(body);
        });
    }

});








app.use(myRouter)
    .use(cors({ origin: 'http://localhost:4200' }))
    .use(cookieParser());

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log('App listening on port ${PORT}');
    console.log('Press Ctrl+C to quit');
});