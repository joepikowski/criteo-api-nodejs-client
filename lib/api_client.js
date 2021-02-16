const HTTP_Client = require('./http.js');
const querystring = require('querystring');

class API_Client extends HTTP_Client {

    constructor(host){
        super();
        this.host = host;
    }

    apiGet(req){
        return this.apiRequest('GET', req);
    }

    apiPost(req){
        return this.apiRequest('POST', req);
    }

    apiPut(req){
        return this.apiRequest('PUT', req);
    }

    apiPatch(req){
        return this.apiRequest('PATCH', req);
    }

    apiDelete(req){
        return this.apiRequest('DELETE', req);
    }

    apiRequest(method, req){
        let { protocol = 'https:', path = '/', headers = {}, body, query } = req;
        path = query ? `${path}?${querystring.stringify(query)}` : path;
        return this._request({
            'method': method,
            'protocol': protocol,
            'hostname': this.host,
            'path': path,
            'timeout': this.timeout,
            'headers': headers,
            'body': body
        });
    }
}

module.exports = API_Client;
