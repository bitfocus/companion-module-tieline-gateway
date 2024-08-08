const { parseString } = require('xml2js');
const { makeRequest } = require('./api');
const auth = require('./auth');

module.exports = {
    async makeMatrixRequest(instance, outputId, inputId) {
        instance.log('debug', `Making matrix request: ${inputId} -> ${outputId}`)
        if (!instance.authHeader || !instance.csrfToken) {
            instance.log('debug', 'Auth header or CSRF token missing, re-authenticating')
            if (!(await instance.authenticate())) {
                instance.log('error', 'Re-authentication failed')
                return false
            }
        }

        const body = `<updateRuntime><base><output id="${outputId}">${inputId}</output></base></updateRuntime>`

        // Generate a new authorization header specifically for this request. 
        // All the headers is just a copy of the chrome dev panel request. 
        // I tried removing some of them, but connections seem less reliable without 
        const newAuthHeader = auth.digestAuth('POST', '/api/matrix', instance.realm, instance.nonce, instance.config.username, instance.config.password, instance.ncCounter++)

        const options = {
            hostname: instance.config.host,
            port: 8080,
            path: '/api/matrix',
            method: 'POST',
            headers: {
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate',
                'Accept-Language': 'en-US,en;q=0.9',
                'Connection': 'keep-alive',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Content-Length': Buffer.byteLength(body),
                'Host': `${instance.config.host}:8080`,
                'Origin': `http://${instance.config.host}:8080`,
                'Referer': `http://${instance.config.host}:8080/assets/base/home.html`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                'X-CSRF-Token': instance.csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': newAuthHeader
            }
        }

        instance.log('info', `Sending matrix request to ${options.hostname}:${options.port}: ${inputId} -> ${outputId}`)
        instance.log('debug', `Request headers: ${JSON.stringify(options.headers)}`)
        instance.log('debug', `Request body: ${body}`)

        try {
            const response = await makeRequest(options, body)
            instance.log('debug', `Matrix response status: ${response.statusCode}`)
            instance.log('debug', `Response headers: ${JSON.stringify(response.headers)}`)
            instance.log('debug', `Response body: ${response.data}`)
            
            if (response.statusCode === 200) {
                instance.log('debug', `Matrix request successful: ${inputId} -> ${outputId}`)
                return true
            } else {
                instance.log('error', `Matrix request failed with status ${response.statusCode}`)
                return false
            }
        } catch (error) {
            instance.log('error', 'Matrix request error: ' + error.message)
            return false
        }
    },

    async fetchMatrixFeatures(instance) {
        if (!instance.config.host || !instance.config.username || !instance.config.password) {
            instance.log('warn', 'Module not fully configured. Cannot fetch matrix features.')
            return false
        }
    
        instance.log('info', 'Fetching matrix features')
        if (!instance.authHeader || !instance.csrfToken) {
            instance.log('debug', 'Auth header or CSRF token missing, re-authenticating');
            if (!(await instance.authenticate())) {
                instance.log('error', 'Re-authentication failed');
                return false;
            }
        }

        const newAuthHeader = auth.digestAuth('GET', '/api/matrix?features', instance.realm, instance.nonce, instance.config.username, instance.config.password, instance.ncCounter++);

        const options = {
            hostname: instance.config.host,
            port: 8080, 
            path: '/api/matrix?features',
            method: 'GET',
            headers: {
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Authorization': newAuthHeader,
                'X-CSRF-Token': instance.csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': `http://${instance.config.host}/assets/base/home.html`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
            }
        };

        try {
            const response = await makeRequest(options);
            instance.log('debug', `Matrix features response status: ${response.statusCode}`);
            
            if (response.statusCode === 200) {
                await this.updateInputsAndOutputs(instance, response.data);
                return true;
            } else {
                instance.log('error', `Failed to fetch matrix features. Status: ${response.statusCode}`);
                return false;
            }
        } catch (error) {
            instance.log('error', 'Error fetching matrix features: ' + error.message);
            return false;
        }
    },

    async updateInputsAndOutputs(instance, xmlData) {
        return new Promise((resolve, reject) => {
            parseString(xmlData, (err, result) => {
                if (err) {
                    instance.log('error', 'Failed to parse XML: ' + err);
                    reject(err);
                    return;
                }
    
                const matrixFeatures = result.result['matrix-features'][0];
                const inputs = matrixFeatures.inputs[0].input.map(input => input.$.id);
                const outputs = matrixFeatures.outputs[0].output.map(output => output.$.id);
    
                // Update variables
                const variables = {
                    inputs: inputs,
                    outputs: outputs
                };
    
                instance.log('debug', `Setting variables: ${JSON.stringify(variables)}`);
                instance.setVariableValues(variables);
    
                // Store variables in the instance for later use
                instance.matrixVariables = variables;
    
                instance.log('info', 'Inputs and outputs list updated successfully');
                if (typeof instance.updateActions === 'function') {
                    instance.updateActions(); // Refresh actions to update dropdowns
                }
                resolve();
            });
        });
    }
}