const http = require('http');
const https = require('https');

class HTTP_Client {

    constructor(timeout = 12000){
        this.timeout = timeout;
    }

    _request(r){
        return r.protocol == 'https:' ? this.http_request(r,https) : this.http_request(r);
    }

    http_request(r, mod = http){
        return new Promise( (resolve, reject) => {
            const req = mod.request(r, (res) => {

                let body = '';

                res.on('data', (data) => body += data );

                res.on('end', () => {resolve({
                        'body': body,
                        'response': res
                    })
                });

                res.on('error', (err) => reject(Error(err)) );
            });

            req.setTimeout(this.timeout);

            req.on('error', err => reject(Error(err)) );

            req.on('timeout', () => reject(Error(`Request timed out after ${this.timeout} ms.`)) );

            if (r.body){
                req.write(r.body);
            }

            req.end();

        });
    }
}

module.exports = HTTP_Client;
