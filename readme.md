# Criteo API Node.js Client

### Features

- Promise and Callback compatible
- Authentication retry system
- Inline documentation (JSDoc specification)
- Save reporting results to file

### Installation

`$ npm install --save criteo-api-retail`

### Basic Code Examples　

##### Initialization
``` js
const Criteo_API = require( 'criteo-api-retail' );

const criteo = new Criteo_API( 'key', 'secret' );
```

##### A Basic Request (Promise / then-able)

Results from an API request can be returned as a settled Javascript Promise:

``` js
criteo.getAudiencesByAdvertiser( '12345' )
	.then( (response) => console.log(response.data) )
	.catch ( (err) => console.log(err) )
```

##### A Basic Request (Callback)

Alternately, data can be returned via a standard callback function if one is provided as the final parameter:

``` js
criteo.getAudiencesByAdvertiser( '12345', (err, response) => {
	if (!err){
		console.log(response.data);
	}
});
```

### Authentication Retry

Oauth2 Tokens retrieved from the `/oauth2/token` endpoint are valid for 15 minutes.

For the first request after initialization, the Criteo API Client will request an authentication token based on the app key and secret provided and proceed with the request.

##### First Request (No Stored Auth)
![API Authentication Retry](http://criteo.work/api/img/api-1.png)

For subsequent requests, the stored token may have become invalid for long-running processes. The Criteo API Client will automatically detect the need for a refreshed token and retry a request that fails once because of a `401 Unauthorized` error.

##### Request with Expired or Invalid Token
![API Authentication Retry](http://criteo.work/api/img/api-2.png)

### Other Features

##### Saving Reports to File

For Statistics API calls, a filepath can be provided to optionally save results to a local path.

``` js
const query = {
    'advertiserIds': '12345',
    'startDate': '2020-09-10T04:00:00.000Z',
    'endDate': '2020-09-14T04:00:00.000Z',
    'format': 'csv',
    'dimensions': ['AdsetId','Day'],
    'metrics': ['Displays','Clicks'],
    'timezone': 'PST',
    'currency': 'USD'
};

criteo.getStatsReport(query, './reports/results.csv')
	.then( (res) => console.log(res) )
	.catch( (err) => console.log(err) )

```

### Further Documentation

[Full Technical Documentation - JSDoc](https://criteo.work/api/jsdoc/Criteo_API_Client.html)

[Criteo Developer Portal](https://developers.criteo.com)


### License
[MIT](MIT-LICENSE)
