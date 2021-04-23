/**
 * Criteo API Node.js Client
 * @version 2021.01.3
 * @author Joe Pikowski <j.pikowski@criteo.com>
 */

const API_Client = require('./api_client.js');
const fs = require('fs');
const cookie = require('cookie');
const moment = require('moment');
const sha512 = require('js-sha512').sha512;

/**
 * Creates a new Criteo API Client.
 * @class
 * @extends API_Client
 */
class Criteo_API_Client extends API_Client {

    constructor(id, secret, host = 'api.criteo.com', endpoint = '', version = '2021-01'){
        super(host);
        this.endpoint = endpoint;
        this.version = version;
        this.id = id;
        this.secret = secret;
        this.token = '';
    }

    checkAuthentication(r){
        return new Promise( (resolve, reject) => {
            if ((this.token && !r.retry) || r.path === '/oauth2/token'){
                resolve();
            }else{
                reject();
            }
        });
    }

    /**
     * Get oauth2 token from id and secret provided on initialization.
     * @param {function} [callback] - Optional callback
     */
    authenticate(callback){
        const auth = {
            client_id: encodeURIComponent(this.id),
            client_secret: encodeURIComponent(this.secret),
            grant_type: 'client_credentials'
        };
        return this.criteoApiRequest({
            'method': 'post',
            'path': `/oauth2/token`,
            'body': this.toFormData(auth),
            'headers': {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            'handler': this.processAuth.bind(this),
            'callback': callback
        });
    }

    /**
     * Get user's portfolio of advertiser accounts.
     * @param {function} [callback] - Optional callback
     */
    getAdvertiserPortfolio(callback){
        return this.criteoApiRequest({
            'method': 'get',
            'path': `/${this.version}/advertisers/me`,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }


    /**
     * Get reporting on ad set performance.
     * @param {object} query
     * @param {string} [query.advertiserIds] - List of advertiser IDs, comma-separated.
     * @param {string} [query.currency] - ISO Format, three letters
     * @param {string} query.startDate - Start date of the report, will be auto-converted to ISO for convenience
     * @param {string} query.endDate - End date of the report, will be auto-converted to ISO for convenience
     * @param {string} query.format - CSV, EXCEL, XML or JSON
     * @param {string[]} query.dimensions - AdvertiserId, CampaignId, Hour, Day, etc.
     * @param {string[]} query.metrics - Clicks, Displays, AdvertiserCost, etc.
     * @param {string} [query.timezone] - GMT, PST, JST, etc.
     * @param {string} [filepath] - The directory path of a file to save the results to.
     * @param {function} [callback] - Optional callback
     */
    getStatsReport(query, filepath, callback){
        let handler = this.determineStatsHandler(query, filepath);
        query.startDate = new Date(query.startDate).toISOString();
        query.endDate = new Date(query.endDate).toISOString();
        return this.criteoApiRequest({
            'method': 'post',
            'path': `/${this.version}/statistics/report`,
            'body': JSON.stringify(query),
            'handler': handler,
            'callback': callback
        });
    }

    /**
     * Get transaction-based reporting.
     * @param {object[]} queries
     * @param {string} [queries[].advertiserIds] - List of advertiser IDs, comma-separated.
     * @param {string} queries[].startDate - Start date of the report, will be auto-converted to ISO for convenience
     * @param {string} queries[].endDate - End date of the report, will be auto-converted to ISO for convenience
     * @param {string} queries[].timezone - GMT, PST, JST, etc.
     * @param {string} queries[].currency - ISO Format, three letters
     * @param {string} [queries[].format] - CSV, EXCEL, XML or JSON
     * @param {string} [queries[].eventType] - Click or Display
     * @param {string} [filepath] - The directory path of a file to save the results to.
     * @param {function} [callback] - Optional callback
     */
    getTransactionReport(queries = [], filepath, callback){
        const payload = {
            'data': queries.map( query => {
                query.startDate = new Date(query.startDate).toISOString();
                query.endDate = new Date(query.endDate).toISOString();
                return { 'type': 'Report', 'attributes': query };
            })
        };
        return this.criteoApiRequest({
            'method': 'post',
            'path': `/${this.version}/transactions/report`,
            'body': JSON.stringify(payload),
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get the audiences for an advertiser.
     * @param {(integer|string)} [advertiser] - Criteo advertiser ID
     * @param {function} [callback] - Optional callback
     */
    getAudiencesByAdvertiser(advertiser, callback){
        const data = {
            'advertiser-id': advertiser
        };
        return this.criteoApiRequest({
            'method': 'get',
            'path': `/${this.version}/audiences`,
            'query': data,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Create an audience for an advertiser.
     * @param {(integer|string)} advertiser - Criteo advertiser ID
     * @param {object} options
     * @param {string} options.name - Audience name
     * @param {string} [options.description] - Audience description
     * @param {function} [callback] - Optional callback
     */
    createAudience(advertiser, options, callback){
        const payload = {
            'data': {
                'type': 'Audience',
                'attributes': {
                    'advertiserId': advertiser,
                    'name': options.name,
                    'description': options.description
                }
            }
        };
        return this.criteoApiRequest({
            'method': 'post',
            'path': `/${this.version}/audiences`,
            'body': JSON.stringify(payload),
            'handler': this.processJSON.bind(this),
            'headers': {
                'Content-Type': 'application/json'
            },
            'callback': callback
        });
    }

    /**
     * Delete an audience by ID.
     * @param {(integer|string)} audience - Audience ID
     * @param {function} [callback] - Optional callback
     */
    deleteAudience(audience, callback){
        return this.criteoApiRequest({
            'method': 'delete',
            'path': `/${this.version}/audiences/${audience}`,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Update the metadata of an audience.
     * @param {(integer|string)} audience - Audience ID
     * @param {object} options
     * @param {string} options.name - Audience name
     * @param {string} [options.description] - Audience description
     * @param {function} [callback] - Optional callback
     */
    updateAudience(audience, options, callback){
        const payload = {
            'data': {
                'type': 'Audience',
                'attributes': {
                    'name': options.name,
                    'description': options.description
                }
            }
        };
        return this.criteoApiRequest({
            'method': 'patch',
            'path': `/${this.version}/audiences/${audience}`,
            'body': JSON.stringify(payload),
            'handler': this.processJSON.bind(this),
            'headers': {
                'Content-Type': 'application/json'
            },
            'callback': callback
        });
    }

    /**
     * Add users to an audience.
     * @param {(integer|string)} audience - Audience ID
     * @param {object} options
     * @param {string} options.identifierType - 'email', 'madid', 'identityLink', or 'gum'
     * @param {string[]} options.identifiers - An array of ids (limit 50000 per call)
     * @param {(integer|string)} [options.gumCallerId] - Required when adding audience via gum IDs.
     * @param {function} [callback] - Optional callback
     */
    addToAudience(audience, options, callback, internalIdentifiers = false){
        const payload = {
            'data': {
                'type': 'ContactlistAmendment',
                'attributes': {
                    'operation': 'add',
                    'identifierType': options.identifierType,
                    'identifiers': options.identifiers,
                    'internalIdentifiers': internalIdentifiers,
                    'gumCallerId': options.gumCallerId
                }
            }
        };
        return this.criteoApiRequest({
            'method': 'patch',
            'path': `/${this.version}/audiences/${audience}/contactlist`,
            'body': JSON.stringify(payload),
            'handler': this.processJSON.bind(this),
            'headers': {
                'Content-Type': 'application/json'
            },
            'callback': callback
        });
    }

    /**
     * Remove users from an audience.
     * @param {(integer|string)} audience - Audience ID
     * @param {object} options
     * @param {string} options.identifierType - 'email', 'madid', 'identityLink', or 'gum'
     * @param {string[]} options.identifiers - An array of ids (limit 50000 per call)
     * @param {(integer|string)} [options.gumCallerId] - Required when adding audience via gum IDs.
     * @param {function} [callback] - Optional callback
     */
    removeFromAudience(audience, options, callback, internalIdentifiers = false){
        const payload = {
            'data': {
                'type': 'ContactlistAmendment',
                'attributes': {
                    'operation': 'remove',
                    'identifierType': options.identifierType,
                    'identifiers': options.identifiers,
                    'internalIdentifiers': internalIdentifiers,
                    'gumCallerId': options.gumCallerId
                }
            }
        };
        return this.criteoApiRequest({
            'method': 'patch',
            'path': `/${this.version}/audiences/${audience}/contactlist`,
            'body': JSON.stringify(payload),
            'handler': this.processJSON.bind(this),
            'headers': {
                'Content-Type': 'application/json'
            },
            'callback': callback
        });
    }

    /**
     * Remove all users from an audience.
     * @param {(integer|string)} audience - Audience ID
     * @param {function} [callback] - Optional callback
     */
    wipeAudience(audience, callback){
        return this.criteoApiRequest({
            'method': 'delete',
            'path': `/${this.version}/audiences/${audience}/contactlist`,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get ad sets by filtering. No filter will return all ad sets.
     * @param {object} filters
     * @param {string[]} filters.adSetIds - An array of ad set IDs
     * @param {function} [callback] - Optional callback
     */
    getAdSets(filters = {}, callback){
        const payload = {
            'filters': filters
        };
        return this.criteoApiRequest({
            'method': 'post',
            'path': `/${this.version}/marketing-solutions/ad-sets/search`,
            'body': JSON.stringify(payload),
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get a specific ad set by ID.
     * @param {(integer|string)} adset - An ad set ID
     * @param {function} [callback] - Optional callback
     */
    getAdSet(adset, callback){
        return this.criteoApiRequest({
            'method': 'get',
            'path': `/${this.version}/marketing-solutions/ad-sets/${adset}`,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Update attributes of one or many ad sets.
     * @param {object[]} updates
     * @param {(integer|string)} updates[].id - Ad set ID. Auto-converted to string for convenience
     * @param {object} updates[].attributes - Can contain name, schedule, bidding, targeting and budget objects
     * @param {string} [updates[].attributes.name] - Ad set name
     * @param {object} [updates[].attributes.schedule]
     * @param {string} [updates[].attributes.schedule.startDate] - Start date of the ad set, will be auto-converted to ISO for convenience
     * @param {string} [updates[].attributes.schedule.endDate] - End date of the ad set, will be auto-converted to ISO for convenience
     * @param {object} [updates[].attributes.bidding]
     * @param {number} [updates[].attributes.bidding.bidAmount] - Value for the bidStrategy
     * @param {string} [updates[].attributes.bidding.bidStrategy] - actions, clicks, conversions, displays, installs, revenue, storeConversions, value, viewedImpressions or visits
     * @param {string} [updates[].attributes.bidding.costController] - COS, CPC, CPI, CPM, CPO, CPSV, CPV, dailyBudget
     * @param {object} [updates[].attributes.targeting]
     * @param {object} [updates[].attributes.targeting.frequencyCapping]
     * @param {integer} [updates[].attributes.targeting.frequencyCapping.maximumImpressions] - Max impressions per frequency
     * @param {string} [updates[].attributes.targeting.frequencyCapping.frequency] - hourly, daily, lifetime
     * @param {object} [updates[].attributes.targeting.geoLocation]
     * @param {string} [updates[].attributes.targeting.geoLocation.countries]
     * @param {string[]} [updates[].attributes.targeting.geoLocation.countries.values] - Two letter country codes, ISO-3166 format
     * @param {string} [updates[].attributes.targeting.geoLocation.countries.operand] - in or notIn
     * @param {string} [updates[].attributes.targeting.geoLocation.subdivisions]
     * @param {string[]} [updates[].attributes.targeting.geoLocation.subdivisions.values] - Geo subdivisions, ISO-3166 format
     * @param {string} [updates[].attributes.targeting.geoLocation.subdivisions.operand] - in or notIn
     * @param {string} [updates[].attributes.targeting.geoLocation.zipCodes]
     * @param {string[]} [updates[].attributes.targeting.geoLocation.zipCodes.values] - Zip codes, ISO-3166 format
     * @param {string} [updates[].attributes.targeting.geoLocation.zipCodes.operand] - in or notIn
     * @param {object} [updates[].attributes.targeting.deliveryLimitations]
     * @param {string[]} [updates[].attributes.targeting.deliveryLimitations.devices] - desktop, mobile, tablet, other
     * @param {string[]} [updates[].attributes.targeting.deliveryLimitations.operatingSystems] - android, ios, other
     * @param {string[]} [updates[].attributes.targeting.deliveryLimitations.environments] - inApp, web
     * @param {function} [callback] - Optional callback
     */
    updateAdSets(updates = [], callback){
        const payload = {
            'data': updates.map( update => {
                update.id = update.id.toString();
                if (update.attributes.schedule && update.attributes.schedule.startDate){ update.attributes.schedule.startDate = new Date(update.attributes.schedule.startDate).toISOString(); }
                if (update.attributes.schedule && update.attributes.schedule.endDate){ update.attributes.schedule.endDate = new Date(update.attributes.schedule.endDate).toISOString(); }
                return { 'type': 'PatchAdSet', ...update };
            })
        };
        return this.criteoApiRequest({
            'method': 'patch',
            'path': `/${this.version}/marketing-solutions/ad-sets`,
            'body': JSON.stringify(payload),
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Start one or many ad sets.
     * @param {string[]} adsets - Array of ad set IDs
     * @param {function} [callback] - Optional callback
     */
    startAdSets(adsets = [], callback){
        const payload = {
            'data': adsets.map( adset => {
                return { 'type': 'AdSetId', 'id': adset.toString() };
            })
        };
        return this.criteoApiRequest({
            'method': 'post',
            'path': `/${this.version}/marketing-solutions/ad-sets/start`,
            'body': JSON.stringify(payload),
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Start one or many ad sets.
     * @param {string[]} adsets - Array of ad set IDs
     * @param {function} [callback] - Optional callback
     */
    stopAdSets(adsets = [], callback){
        const payload = {
            'data': adsets.map( adset => {
                return { 'type': 'AdSetId', 'id': adset.toString() };
            })
        };
        return this.criteoApiRequest({
            'method': 'post',
            'path': `/${this.version}/marketing-solutions/ad-sets/stop`,
            'body': JSON.stringify(payload),
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Generates a consent URL for a user to delegate permissions to an app.
     * @param {string} publicSigningKey - Public Consent URL Signing Key
     * @param {string} signingSecret - Secret Consent URL Signing Key
     * @param {string} redirect - App URL to redirect to after consent is delegated
     * @param {string} state - Arbitrary string (e.g. your app user ID) to be included in consent callback
     */
    generateConsentURL(publicSigningKey, signingSecret, state, redirect){
        const timestamp = Math.round(Date.now() / 1000);
        const query = `?key=${publicSigningKey}&timestamp=${timestamp}&state=${state}&redirect-uri=${redirect}`;
        return `https://consent.criteo.com/request${query}&signature=${sha512.hmac(signingSecret, query)}`;
    }

    /**
     * Validate the x-criteo-hmac-sha512 header value of a consent callback.
     * @param {string} headerValue - String value of the callback header to validate
     * @param {string} signingSecret - Secret Consent URL Signing Key
     * @param {string} body - Consent callback body for reproducing the header value
     */
    validateConsentHeader(headerValue, signingSecret, body){
        return sha512.hmac(signingSecret, body)  === headerValue;
    }

    /**
     * Get user's portfolio of advertiser accounts.
     * @deprecated
     * @param {function} [callback] - Optional callback
     */
    getMAPIPortfolio(callback){
        return this.criteoApiRequest({
            'method': 'get',
            'path': `/legacy/marketing/v1/portfolio`,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get reporting on campaign performance.
     * @deprecated
     * @param {object} query
     * @param {string} [query.advertiserIds] - List of advertiser IDs, comma-separated.
     * @param {string} [query.currency] - ISO Format, three letters
     * @param {string} query.startDate - Start date of the report, will be auto-converted to ISO for convenience
     * @param {string} query.endDate - End date of the report, will be auto-converted to ISO for convenience
     * @param {string} query.format - CSV, Excel, XML or JSON
     * @param {string[]} query.dimensions - AdvertiserId, CampaignId, Hour, Day, etc.
     * @param {string[]} query.metrics - Clicks, Displays, AdvertiserCost, etc.
     * @param {string} [query.timezone] - GMT, PST or JST
     * @param {string} [filepath] - The directory path of a file to save the results to.
     * @param {function} [callback] - Optional callback
     */
    getMAPIReport(query, filepath, callback){
        let handler = this.determineStatsHandler(query, filepath);
        query.startDate = new Date(query.startDate).toISOString();
        query.endDate = new Date(query.endDate).toISOString();
        return this.criteoApiRequest({
            'method': 'post',
            'path': `/legacy/marketing/v1/statistics`,
            'body': JSON.stringify(query),
            'headers': {
                'Content-Type': 'application/json'
            },
            'handler': handler,
            'callback': callback
        });
    }

    /**
     * Get publisher-level data by advertisers.
     * @deprecated
     * @param {object} options
     * @param {string} [options.advertiserIds] - Criteo advertiser IDs, comma-separated
     * @param {string} options.startDate - Starting date string, will be auto-converted to ISO for convenience
     * @param {string} options.endDate - Ending date string, will be auto-converted to ISO for convenience
     * @param {function} [callback] - Optional callback
     */
    getMAPIPublisherStats(options = {}, callback){
        const data = {
            'advertiserIds': options.advertiserIds,
            'startDate': new Date(options.startDate).toISOString(),
            'endDate': new Date(options.endDate).toISOString()
        };
        return this.criteoApiRequest({
            'method': 'post',
            'path': `/legacy/marketing/v1/publishers/stats`,
            'body': JSON.stringify(data),
            'headers': {
                'Content-Type': 'application/json'
            },
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get the audiences for an advertiser.
     * @deprecated
     * @param {(integer|string)} [advertiser] - Criteo advertiser ID
     * @param {function} [callback] - Optional callback
     */
    getMAPIAudiences(advertiser, callback){
        const data = {
            'advertiserId': advertiser
        };
        return this.criteoApiRequest({
            'method': 'get',
            'path': `/legacy/marketing/v1/audiences/`,
            'query': data,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Create an audience for an advertiser.
     * @deprecated
     * @param {(integer|string)} advertiser - Criteo advertiser ID
     * @param {object} options
     * @param {string} options.name - Audience name
     * @param {string} [options.description] - Audience description
     * @param {function} [callback] - Optional callback
     */
    createMAPIAudience(advertiser, options, callback){
        const data = {
            'advertiserId': advertiser,
            'name': options.name,
            'description': options.description
        };
        return this.criteoApiRequest({
            'method': 'post',
            'path': `/legacy/marketing/v1/audiences/userlist`,
            'body': JSON.stringify(data),
            'headers': {
                'Content-Type': 'application/json'
            },
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Delete an audience by ID.
     * @deprecated
     * @param {(integer|string)} audience - Audience ID
     * @param {function} [callback] - Optional callback
     */
    deleteMAPIAudience(audience, callback){
        return this.criteoApiRequest({
            'method': 'delete',
            'path': `/legacy/marketing/v1/audiences/${audience}`,
            'handler': this.processResponse.bind(this),
            'callback': callback
        });
    }

    /**
     * Update the metadata of an audience.
     * @deprecated
     * @param {(integer|string)} audience - Audience ID
     * @param {object} options
     * @param {string} options.name - Audience name
     * @param {string} [options.description] - Audience description
     * @param {function} [callback] - Optional callback
     */
    updateMAPIAudience(audience, options = {}, callback){
        const data = {
            'name': options.name,
            'description': options.description
        };
        return this.criteoApiRequest({
            'method': 'put',
            'path': `/legacy/marketing/v1/audiences/${audience}`,
            'body': JSON.stringify(data),
            'headers': {
                'Content-Type': 'application/json'
            },
            'handler': this.processResponse.bind(this),
            'callback': callback
        });
    }

    /**
     * Remove all users from an audience.
     * @deprecated
     * @param {(integer|string)} audience - Audience ID
     * @param {function} [callback] - Optional callback
     */
    wipeMAPIAudience(audience, callback){
        return this.criteoApiRequest({
            'method': 'delete',
            'path': `/legacy/marketing/v1/audiences/userlist/${audience}/users`,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Add users to an audience.
     * @deprecated
     * @param {(integer|string)} audience - Audience ID
     * @param {object} options
     * @param {string} options.schema - 'email', 'madid', 'identityLink', or 'gum'
     * @param {string[]} options.identifiers - An array of ids (limit 50000 per call)
     * @param {(integer|string)} [options.gumCallerId] - Required when adding audience via gum IDs.
     * @param {function} [callback] - Optional callback
     */
    addToMAPIAudience(audience, options = {}, callback){
        const data = {
            'operation': 'add',
            'schema': options.schema,
            'identifiers': options.identifiers,
            'gumCallerId': options.gumCallerId
        };
        return this.criteoApiRequest({
            'method': 'patch',
            'path': `/legacy/marketing/v1/audiences/userlist/${audience}`,
            'body': JSON.stringify(data),
            'headers': {
                'Content-Type': 'application/json'
            },
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Remove users from an audience.
     * @deprecated
     * @param {(integer|string)} audience - Audience ID
     * @param {object} options
     * @param {string} options.schema - 'email', 'madid', 'identityLink', or 'gum'
     * @param {string[]} options.identifiers - An array of ids (limit 50000 per call)
     * @param {(integer|string)} [options.gumCallerId] - Required when adding audience via gum IDs.
     * @param {function} [callback] - Optional callback
     */
    removeFromMAPIAudience(audience, options = {}, callback){
        const data = {
            'operation': 'remove',
            'schema': options.schema,
            'identifiers': options.identifiers,
            'gumCallerId': options.gumCallerId
        };
        return this.criteoApiRequest({
            'method': 'patch',
            'path': `/legacy/marketing/v1/audiences/userlist/${audience}`,
            'body': JSON.stringify(data),
            'headers': {
                'Content-Type': 'application/json'
            },
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get campaigns for a single advertiser.
     * @deprecated
     * @param {(integer|string)} advertiser - Criteo advertiser ID
     * @param {function} [callback] - Optional callback
     */
    getMAPICampaignsByAdvertiser(advertiser, callback){
        return this.criteoApiRequest({
            'method': 'get',
            'path': `/legacy/marketing/v1/advertisers/${advertiser}/campaigns`,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get campaigns by advertiser IDs or campaign IDs.
     * @deprecated
     * @param {object} options
     * @param {(integer|string)} [options.advertiserIds]
     * @param {(integer|string)} [options.campaignIds]
     * @param {string} [options.campaignStatus] - Running, Archived or NotRunning
     * @param {string} [options.bidType] - Unknown, CPC, COS, or CPO
     * @param {function} [callback] - Optional callback
     */
    getMAPICampaigns(options = {}, callback){
        return this.criteoApiRequest({
            'method': 'get',
            'path': `/legacy/marketing/v1/campaigns/`,
            'query': options,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get campaign by ID.
     * @deprecated
     * @param {(integer|string)} id
     * @param {function} [callback] - Optional callback
     */
    getMAPICampaign(id, callback){
        return this.criteoApiRequest({
            'method': 'get',
            'path': `/legacy/marketing/v1/campaigns/${id}`,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get bids by advertisers, campaigns or categories.
     * @deprecated
     * @param {object} options
     * @param {(integer|string)} [options.advertiserIds]
     * @param {(integer|string)} [options.budgetIds]
     * @param {(integer|string)} [options.categoryHashCodes]
     * @param {string} [options.bidType] - Unknown, CPC, COS, or CPO
     * @param {string} [options.campaignStatus] - Running, Archived or NotRunning
     * @param {boolean} [options.pendingChanges] - true or false
     * @param {function} [callback] - Optional callback
     */
    getMAPIBids(options = {}, callback){
        return this.criteoApiRequest({
            'method': 'get',
            'path': `/legacy/marketing/v1/campaigns/bids`,
            'query': options,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Update bids by campaign (campaign- and category-level).
     * @deprecated
     * @param {object[]} campaigns
     * @param {(integer|string)} campaigns[].campaignId
     * @param {(number|string)} campaigns[].bidValue
     * @param {object[]} [campaigns[].categories] - An array of category objects, specifying bids that overwrite the overall campaign bid value.
     * @param {(integer|string)} [campaigns[].categories[].categoryHashCode]
     * @param {(number|string)} [campaigns[].categories[].bidValue]
     * @param {function} [callback] - Optional callback
     */
    updateMAPIBids(campaigns = [], callback){
        return this.criteoApiRequest({
            'method': 'put',
            'path': `/legacy/marketing/v1/campaigns/bids`,
            'body': JSON.stringify(campaigns),
            'headers': {
                'Content-Type': 'application/json'
            },
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get categories by campaigns, advertisers, or a list of categories.
     * @deprecated
     * @param {object} options
     * @param {(integer|string)} [options.campaignIds]
     * @param {(integer|string)} [options.advertiserIds]
     * @param {(integer|string)} [options.categoryHashCodes]
     * @param {boolean} [enabled=false] - Filter for enabled categories
     * @param {function} [callback] - Optional callback
     */
    getMAPICategories(options = {}, enabled = false, callback){
        const data = {
            'campaignIds': options.campaignIds,
            'advertiserIds': options.advertiserIds,
            'categoryHashCodes': options.categoryHashCodes,
            'enabledOnly': enabled
        };
        return this.criteoApiRequest({
            'method': 'get',
            'path': `/legacy/marketing/v1/categories`,
            'query': data,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get categories by campaign ID.
     * @deprecated
     * @param {(integer|string)} id
     * @param {boolean} [enabled=false] - Filter for enabled categories
     * @param {function} [callback] - Optional callback
     */
    getMAPICategoriesByCampaign(id, enabled = false, callback){
        const data = {
            'enabledOnly': enabled
        };
        return this.criteoApiRequest({
            'method': 'get',
            'path': `/legacy/marketing/v1/campaigns/${id}/categories`,
            'query': data,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get a specific campaign category.
     * @deprecated
     * @param {(integer|string)} campaign - Campaign ID
     * @param {(integer|string)} category - Category ID
     * @param {function} [callback] - Optional callback
     */
    getMAPICategoryByCampaign(campaign, category, callback){
        return this.criteoApiRequest({
            'method': 'get',
            'path': `/legacy/marketing/v1/campaigns/${campaign}/categories/${category}`,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get budgets for a list of advertisers or budget IDs.
     * @deprecated
     * @param {object} options
     * @param {(integer|string)} [options.advertiserIds]
     * @param {(integer|string)} [options.budgetIds]
     * @param {boolean} [active=true] - Filter for budgets with active campaigns.
     * @param {function} [callback] - Optional callback
     */
    getMAPIBudgets(options = {}, active = true, callback){
        const data = {
            'advertiserIds': options.advertiserIds,
            'budgetIds': options.budgetIds,
            'onlyActiveCampaigns': active
        };
        return this.criteoApiRequest({
            'method': 'get',
            'path': `/legacy/marketing/v1/budgets`,
            'query': data,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get all categories for all campaigns of a single advertiser.
     * @deprecated
     * @param {(integer|string)} advertiser - Criteo advertiser ID
     * @param {boolean} [enabled=false] - Filter for enabled categories
     * @param {function} [callback] - Optional callback
     */
    getMAPICategoriesByAdvertiser(advertiser, enabled = false, callback){
        const data = {
            'enabledOnly': enabled
        };
        return this.criteoApiRequest({
            'method': 'get',
            'path': `/legacy/marketing/v1/advertisers/${advertiser}/categories`,
            'query': data,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get category information for an advertiser, irrespective of specific campaigns.
     * @deprecated
     * @param {(integer|string)} advertiser - Criteo advertiser ID
     * @param {(integer|string)} category - Category ID
     * @param {function} [callback] - Optional callback
     */
    getMAPICategoryByAdvertiser(advertiser, category, callback){
        return this.criteoApiRequest({
            'method': 'get',
            'path': `/legacy/marketing/v1/advertisers/${advertiser}/categories/${category}`,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get categories by campaigns, advertisers, or a list of categories.
     * @deprecated
     * @param {object} options
     * @param {(integer|string)} [options.campaignIds]
     * @param {(integer|string)} [options.advertiserIds]
     * @param {(integer|string)} [options.categoryHashCodes]
     * @param {boolean} [enabled=false] - Filter for enabled categories
     * @param {function} [callback] - Optional callback
     */
    getMAPICategories(options = {}, enabled = false, callback){
        const data = {
            'campaignIds': options.campaignIds,
            'advertiserIds': options.advertiserIds,
            'categoryHashCodes': options.categoryHashCodes,
            'enabledOnly': enabled
        };
        return this.criteoApiRequest({
            'method': 'get',
            'path': `/legacy/marketing/v1/categories`,
            'query': data,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Update categories by catalog.
     * @deprecated
     * @param {object[]} catalogs
     * @param {(integer|string)} catalogs[].catalogId
     * @param {object[]} catalogs[].categories - An array of category objects, specifying enabled or disabled.
     * @param {(integer|string)} catalogs[].categories[].categoryHashCode
     * @param {boolean} catalogs[].categories[].enabled
     * @param {function} [callback] - Optional callback
     */
    updateMAPICategories(catalogs = [], callback){
        return this.criteoApiRequest({
            'method': 'put',
            'path': `/legacy/marketing/v1/categories`,
            'body': JSON.stringify(catalogs),
            'headers': {
                'Content-Type': 'application/json'
            },
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get the accounts
     * @param {function} [callback] - Optional callback
     */
    getAccounts(callback){
        return this.criteoApiRequest({
            'method': 'get',
            'path': `/preview/retail-media/accounts`,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get catalogs by accountId
     * @param {integer} accountId
     */
    getCatalogsByAccountId(accountId, callback){
        return this.criteoApiRequest({
            'method': 'post',
            'path': `/preview/retail-media/accounts/${accountId}/catalogs`,
            'body': JSON.stringify({}),
            'headers': {
                'Content-Type': 'application/json'
            },
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get the catalog output
     * @param {string} catalogId
     * @param {function} [callback] - Optional callback
     */
    // This returns a string since the return is not valid JSON technically.
    // Each line is valid JSON separated by newlines
    getCatalogOutput(catalogId, callback){
        return this.criteoApiRequest({
            'method': 'get',
            'path': `/preview/retail-media/catalogs/${catalogId}/output`,
            'handler': this.processResponse.bind(this),
            'callback': callback
        });
    }

    /**
     * Get campaigns by accountId
     * @param {string} accountId
     * @param {object} pageInfo - Optional paging
     * @param {number} [pageInfo.pageIndex]
     * @param {number} [pageInfo.pageSize]
     * @param {function} [callback] - Optional callback
     */
    getCampaignsByAccountId(accountId, pageInfo, callback){

        const pageQueryString = pageInfo ? `?pageIndex=${pageInfo.pageIndex}&pageSize=${pageInfo.pageSize}` : '';

        return this.criteoApiRequest({
            'method': 'get',
            'path': `/preview/retail-media/accounts/${accountId}/campaigns${pageQueryString}`,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get campaigns by id
     * @param {string} campaignId
     * @param {function} [callback] - Optional callback
     */
    getCampaignById(campaignId, callback){
        return this.criteoApiRequest({
            'method': 'get',
            'path': `/preview/retail-media/campaigns/${campaignId}`,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Create Campaign
     * @param {string} accountId
     * @param {object} campaignData
     * @param {function} [callback] - Optional callback
     */
    createCampaignByAccountId(accountId, campaignData, callback){

        const payload = {
            'data': { 'type': 'RetailMediaCampaign',
                      'attributes': campaignData }
        };

        return this.criteoApiRequest({
            'method': 'post',
            'path': `/preview/retail-media/accounts/${accountId}/campaigns`,
            'body': JSON.stringify(payload),
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Update Campaign
     * @param {string} campaignId
     * @param {object} campaignData
     * @param {function} [callback] - Optional callback
     */
    updateCampaignById(campaignId, campaignData, callback){

        const payload = {
            'data': {
                'id': campaignId,
                'type': 'RetailMediaCampaign',
                'attributes': campaignData }
        };

        return this.criteoApiRequest({
            'method': 'put',
            'path': `/preview/retail-media/campaigns/${campaignId}`,
            'body': JSON.stringify(payload),
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get line items by campaignId
     * @param {string} campaignId
     * @param {object} pageInfo - Optional paging
     * @param {number} [pageInfo.pageIndex]
     * @param {number} [pageInfo.pageSize]
     * @param {function} [callback] - Optional callback
     */
    getLineItemsByCampaignId(campaignId, pageInfo, callback){

        const pageQueryString = pageInfo ? `?pageIndex=${pageInfo.pageIndex}&pageSize=${pageInfo.pageSize}` : '';

        return this.criteoApiRequest({
            'method': 'get',
            'path': `/preview/retail-media/campaigns/${campaignId}/line-items${pageQueryString}`,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get line-items by id
     * @param {string} lineItemId
     * @param {function} [callback] - Optional callback
     */
    getLineItemById(lineItemId, callback){
        return this.criteoApiRequest({
            'method': 'get',
            'path': `/preview/retail-media/line-items/${lineItemId}`,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Create lineItem
     * @param {string} campaignId
     * @param {object} lineItemData
     * @param {function} [callback] - Optional callback
     */
    createLineItemByCampaignId(campaignId, lineItemData, callback){

        const payload = {
            'data': {
                'type': 'RetailMediaLineItem',
                'attributes': lineItemData }
        };

        return this.criteoApiRequest({
            'method': 'post',
            'path': `/preview/retail-media/campaigns/${campaignId}/line-items`,
            'body': JSON.stringify(payload),
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Update lineItem
     * @param {string} lineItemId
     * @param {object} lineItemData
     * @param {function} [callback] - Optional callback
     */
    updateLineItemById(lineItemId, lineItemData, callback){

        const payload = {
            'data': {
                'id': lineItemId,
                'type': 'RetailMediaLineItem',
                'attributes': lineItemData }
        };

        return this.criteoApiRequest({
            'method': 'put',
            'path': `/preview/retail-media/line-items/${lineItemId}`,
            'body': JSON.stringify(payload),
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }   

    /**
     * Get Campaign or Line Item reporting
     * @param {string} reportType campaigns or line-items
     * @param {object} query
     * @param {string} [query.id] - Campaign or Line Item ID of the desired report
     * @param {string} [query.reportType] - Type of report requested
     * @param {string} [query.startDate] - Start date of the report, will be auto-converted to ISO for convenience
     * @param {string} [query.endDate] - End date of the report, will be auto-converted to ISO for convenience
     * @param {string} [query.timezone] - GMT, PST, JST, etc.
     * @param {string} [query.clickAttributionWindow] - The post-click attribution window, defined as the maximum number of days considered between a click and a conversion for attribution
     * @param {string} [query.viewAttributionWindow] - The post-view attribution window, defined as the maximum number of days considered between an impression and a conversion for attribution
     * @param {string} [query.format] - CSV, EXCEL, XML or JSON
     * @param {function} [callback] - Optional callback
     */
    getReport(reportType, query, callback){

        const payload = {
            'data': { 'type': 'RetailMediaReportRequest',
                      'attributes': query }
        };

        return this.criteoApiRequest({
            'method': 'post',
            'path': `/preview/retail-media/reports/${reportType}`,
            'body': JSON.stringify(payload),
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get report status
     * @param {string} reportId
     * @param {function} [callback] - Optional callback
     */
    getReportStatus(reportId, callback){
        return this.criteoApiRequest({
            'method': 'get',
            'path': `/preview/retail-media/reports/${reportId}/status`,
            'handler': this.processJSON.bind(this),
            'callback': callback
        });
    }

    /**
     * Get report output
     * @param {string} reportId
     * @param {string} filepath - Optional filepath to save the report with
     * @param {function} [callback] - Optional callback
     */
    getReportOutput(reportId, filepath, callback){

        let handler = this.determineReportHandler(filepath);

        return this.criteoApiRequest({
            'method': 'get',
            'path': `/preview/retail-media/reports/${reportId}/output`,
            'handler': handler,
            'callback': callback
        });
    }

    criteoApiRequest(r){
        return new Promise( (resolve, reject) => {
        this.checkAuthentication(r)
            .catch(this.authenticate.bind(this))
            .then(this.executeRequest.bind(this,r))
            .catch(this.decideWhetherToRequeue.bind(this,r))
            .then(this.resolveRequest.bind(this,r,resolve))
            .catch(this.rejectRequest.bind(this,r,reject))
        });
    }

    executeRequest(r){
        return this[r.method]({
            'path': r.path,
            'body': r.body,
            'query': r.query,
            'headers': r.headers
        })
        .then(r.handler)
        .catch((err) => {
            return Promise.reject(err);
        })
    }

    decideWhetherToRequeue(r, err){
        return new Promise( (resolve, reject) => {
            if (err.toString().indexOf('401') > -1 && !r.retry){
                r.retry = true;
                resolve(this.criteoApiRequest(r));
            }else{
                reject(err);
            }
        });
    }

    resolveRequest(r, resolve, res){
        if (r.callback && !r.callbackExecuted){
            r.callbackExecuted = true;
            r.callback(null, res);
        }
        resolve(res);
    }

    rejectRequest(r, reject, err){
        if (r.callback && !r.callbackExecuted){
            r.callbackExecuted = true;
            r.callback(err)
        }else{
            reject(err);
        }
    }

    processAuth(res){
        return new Promise( (resolve, reject) => {
            try{
                const response = JSON.parse(res.body);
                this.token = response.access_token;
                resolve(this.token);
            }catch(e){
                reject(new Error('Error Retrieving Session Token from Authentication Response!'));
            }
        });
    }

    processJSON(res){
        return this.process(res, this.parseJSON);
    }

    processFile(filepath, res){
        return this.process(res, this.saveToFile.bind(this,filepath));
    }

    processResponse(res){
        return this.process(res, this.parseResponse);
    }

    process(res, parser){
        return new Promise( (resolve, reject) => {
            try{
                const status = res.response.statusCode;
                if (status.toString().match(/20[0-9]/) === null){
                    reject(new Error(`Bad Response From API: Status Code ${status} | ${res.body}`));
                }
                parser(res.body.trim(), resolve, reject);
            }catch(e){
                reject(new Error(`Error Parsing Response from API: Status Code ${status} | ${e}`));
            }
        });
    }

    parseJSON(body, resolve, reject){
        try {
            if (body){
                resolve(JSON.parse(body));
            }else{
                resolve(true);
            }
        }catch(e){
            reject(new Error(`Error Parsing JSON Response: ${e}`));
        }
    }

    parseResponse(body, resolve, reject){
        try {
            if (body){
                resolve(body);
            }else{
                resolve(true);
            }
        }catch(e){
            reject(new Error(`Error Parsing Response: ${e}`));
        }
    }

    saveToFile(filepath, body, resolve, reject){
        fs.writeFile(filepath, body, (err) => {
            if (err){
                reject(new Error(`Error Saving Response to File. ${err}`));
            }else{
                resolve(`Results saved to ${filepath}.`);
            }
        });
    }

    toFormData(obj){
        let formdata = '';
        for (const key in obj){
            formdata += `${key}=${obj[key]}&`
        }
        return formdata.slice(0,-1);
    }

    determineStatsHandler(query, filepath){
        if (filepath){
            return this.processFile.bind(this,filepath);
        }else if (query.format.toLowerCase() === 'json'){
            return this.processJSON.bind(this);
        }else{
            return this.processResponse.bind(this);
        }
    }

    determineReportHandler(filepath){
        if (filepath){
            return this.processFile.bind(this,filepath);
        }else{
            return this.processResponse.bind(this);
        }
    }

    get(req){
        return this.request('apiGet', req);
    }

    post(req){
        return this.request('apiPost', req);
    }

    put(req){
        return this.request('apiPut', req);
    }

    patch(req){
        return this.request('apiPatch', req);
    }

    delete(req){
        return this.request('apiDelete', req);
    }

    request(method, req){
        const headers = {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'application/json, text/xml',
            'Content-Type': 'application/*+json',
            'User-Agent': `criteo-api-nodejs-client/v${this.version}`
        };

        return this[method]({
            'path': this.endpoint + req.path,
            'body': req.body,
            'query': req.query,
            'headers': {
                ...headers,
                ...req.headers
            }
        });
    }
}

module.exports = Criteo_API_Client;
