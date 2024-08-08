const http = require('http')

module.exports = {
    makeRequest(options, body = null) {
        return new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let data = ''
                res.on('data', (chunk) => {
                    data += chunk
                })
                res.on('end', () => {
                    if (res.headers['set-cookie']) {
                        const csrfCookie = res.headers['set-cookie'].find(cookie => cookie.startsWith('csrfCookie='))
                        if (csrfCookie) {
                            this.csrfToken = csrfCookie.split(';')[0].split('=')[1]
                        }
                    }
                    resolve({ statusCode: res.statusCode, headers: res.headers, data })
                })
            })

            req.on('error', (error) => {
                reject(error)
            })

            if (body) {
                req.write(body)
            }
            req.end()
        })
    }
}