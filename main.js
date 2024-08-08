const { InstanceBase, Regex, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const UpdateActions = require('./actions')
const UpdateFeedbacks = require('./feedbacks')
const UpdateVariableDefinitions = require('./variables')
const http = require('http')
const crypto = require('crypto')
const { getConfigFields } = require('./config')
const auth = require('./auth')
const { makeRequest } = require('./api')
const matrix = require('./matrix')
const heartbeat = require('./heartbeat')

class ModuleInstance extends InstanceBase {
    constructor(internal) {
        super(internal)
        this.authHeader = null
        this.csrfToken = null
        this.realm = null
        this.nonce = null
        this.ncCounter = 1
        this.heartbeatInterval = null
        this.lastAuthTime = null
        this.connectionFailed = false
        this.reconnectTimeout = null
        this.reconnectAttempts = 0
    }

    async init(config) {
        this.config = config
        this.updateStatus(InstanceStatus.Connecting)
        this.updateFeedbacks()
        this.updateVariableDefinitions()

        if (!this.config.host || !this.config.username || !this.config.password) {
            this.log('warn', 'Module not configured yet. Please configure the module settings.')
            this.updateStatus(InstanceStatus.BadConfig)
            return
        }

        this.log('info', 'Initializing tieline gateway module')
        await this.connect()
    }

	// The regular connect function
    async connect() {
        try {
            await this.authenticate()
            await matrix.fetchMatrixFeatures(this)
            this.log('debug', `Variables after initialization: ${JSON.stringify(this.matrixVariables)}`)
            this.updateActions()
            this.startHeartbeat()
            this.updateStatus(InstanceStatus.Ok)
            this.connectionFailed = false
            this.reconnectAttempts = 0
        } catch (error) {
            this.log('error', `Connection failed: ${error.message}`)
            this.updateStatus(InstanceStatus.ConnectionFailure)
            this.connectionFailed = true
            this.scheduleReconnect()
        }
    }

	//If we loose access, this should handle reconnecting
    scheduleReconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout)
        }
        const delay = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempts))
        this.reconnectAttempts++
        this.reconnectTimeout = setTimeout(() => this.connect(), delay)
        this.log('info', `Scheduling reconnect attempt in ${delay}ms`)
    }

    async configUpdated(config) {
        this.config = config

        if (!this.config.host || !this.config.username || !this.config.password) {
            this.log('warn', 'Module not fully configured. Please configure all required settings.')
            this.updateStatus(InstanceStatus.BadConfig)
            return
        }

        this.stopHeartbeat()
        await this.connect()
    }

    async authenticate() {
        if (!this.config.host || !this.config.username || !this.config.password) {
            throw new Error('Module not fully configured')
        }
        const result = await auth.authenticate(this)
        if (result) {
            this.authHeader = result.authHeader
            this.csrfToken = result.csrfToken
            this.realm = result.realm
            this.nonce = result.nonce
            return true
        }
        throw new Error('Authentication failed')
    }

	// We need a heartbeat at least every 60 seconds to renew the nounce digest auth.
	// I don't know if this is just my implementation, but I can see in the chrome inspector that the tieline config page does this with a pid request, so I'm doing it too.
	// I tried without, but that lead to disconnections due to 401 after a few minuttes.
    startHeartbeat() {
        this.stopHeartbeat()
        heartbeat.startHeartbeat(this)
        this.heartbeatInterval = setInterval(async () => {
            try {
                const result = await heartbeat.sendHeartbeat(this)
                if (result) {
                    this.authHeader = result.authHeader
                    this.csrfToken = result.csrfToken
                }
            } catch (error) {
                this.log('warn', `Heartbeat failed: ${error.message}`)
                this.updateStatus(InstanceStatus.ConnectionFailure)
                this.stopHeartbeat()
                this.scheduleReconnect()
            }
        }, 30000) // 30 seconds
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval)
            this.heartbeatInterval = null
        }
    }

    destroy() {
        this.stopHeartbeat()
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout)
        }
    }

	getConfigFields() {
        return getConfigFields()
    }

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this)
	}

	md5(data) {
        return auth.md5(data)
    }

    digestAuth(method, uri, realm, nonce, username, password) {
        return auth.digestAuth(method, uri, realm, nonce, username, password, this.ncCounter++)
    }

    makeRequest(options, body = null) {
        return makeRequest(options, body)
    }

	getVariableChoices(type) {
		this.log('debug', `Getting variable choices for type: ${type}`);
		try {
			const variables = this.matrixVariables || {};
			this.log('debug', `All variables: ${JSON.stringify(variables)}`);
			
			if (!variables[type] || variables[type].length === 0) {
				this.log('warn', `${type} not initialized or empty. Returning empty array.`);
				return [];
			}
	
			const choices = variables[type].map(value => ({ id: value, label: value }));
	
			this.log('debug', `Choices for ${type}: ${JSON.stringify(choices)}`);
			return choices;
		} catch (error) {
			this.log('error', `Error in getVariableChoices: ${error.message}`);
			return [];
		}
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)