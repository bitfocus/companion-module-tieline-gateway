const auth = require('./auth')
const { makeRequest } = require('./api')

module.exports = {
    startHeartbeat(instance) {
        this.stopHeartbeat(instance)
        instance.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat(instance)
        }, 60000) // 60 seconds
    },

    stopHeartbeat(instance) {
        if (instance.heartbeatInterval) {
            clearInterval(instance.heartbeatInterval)
            instance.heartbeatInterval = null
        }
    },

    async sendHeartbeat(instance) {
        const path = '/api/ppm?skip=0&width=8&interval=50&version=1&c=enc1&c=enc2&c=enc3&c=enc4&c=enc5&c=enc6&c=enc7&c=enc8&c=enc9&c=enc10&c=enc11&c=enc12&c=enc13&c=enc14&c=enc15&c=enc16&c=dec1&c=dec2&c=dec3&c=dec4&c=dec5&c=dec6&c=dec7&c=dec8&c=dec9&c=dec10&c=dec11&c=dec12&c=dec13&c=dec14&c=dec15&c=dec16&c=hpl&c=hpr'
        
        const newAuthHeader = auth.digestAuth('GET', path, instance.realm, instance.nonce, instance.config.username, instance.config.password, instance.ncCounter++)

        const options = {
            hostname: instance.config.host,
            port: 8080,
            path: path,
            method: 'GET',
            headers: {
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Authorization': newAuthHeader,
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Referer': `http://${instance.config.host}:8080/assets/base/home.html`
            }
        }

        try {
            const response = await makeRequest(options)
            if (response.statusCode === 200) {
                instance.log('debug', 'Heartbeat successful')
                // Update authentication information
                instance.authHeader = newAuthHeader
                instance.lastAuthTime = Date.now()

                // Check for new CSRF token
                if (response.headers['set-cookie']) {
                    const csrfCookie = response.headers['set-cookie'].find(cookie => cookie.startsWith('csrfCookie='))
                    if (csrfCookie) {
                        instance.csrfToken = csrfCookie.split(';')[0].split('=')[1]
                    }
                }

                instance.log('debug', 'Updated auth info after successful heartbeat')
                return true
            } else {
                instance.log('info', `Heartbeat failed with status ${response.statusCode}`)
                if (response.statusCode === 401) {
                    instance.log('info', 'Re-authenticating due to 401 response')
                    const authResult = await instance.authenticate()
                    return authResult
                }
            }
        } catch (error) {
            instance.log('error', 'Heartbeat error: ' + error.message)
        }
        return false
    }
}