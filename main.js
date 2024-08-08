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
    }

    async init(config) {
		this.config = config
		this.updateStatus(InstanceStatus.Ok)
		this.updateFeedbacks()
		this.updateVariableDefinitions()
	
		if (!this.config.host || !this.config.username || !this.config.password) {
			this.log('warn', 'Module not configured yet. Please configure the module settings.')
			this.updateStatus(InstanceStatus.BadConfig)
			return
		}
	
		this.log('info', 'Initializing tieline gateway module')
		try {
			await this.authenticate()
			await matrix.fetchMatrixFeatures(this)
			this.log('debug', `Variables after initialization: ${JSON.stringify(this.matrixVariables)}`)
			this.updateActions() // Move this here, after fetching matrix features
			this.startHeartbeat()
		} catch (error) {
			this.log('error', `Initialization failed: ${error.message}`)
			this.updateStatus(InstanceStatus.ConnectionFailure)
		}
	}

    async configUpdated(config) {
		this.config = config
	
		if (!this.config.host || !this.config.username || !this.config.password) {
			this.log('warn', 'Module not fully configured. Please configure all required settings.')
			this.updateStatus(InstanceStatus.BadConfig)
			return
		}
	
		try {
			await this.authenticate()
			await matrix.fetchMatrixFeatures(this)
			this.updateActions() // Refresh actions after fetching new data
			this.startHeartbeat()
			this.updateStatus(InstanceStatus.Ok)
		} catch (error) {
			this.log('error', `Configuration update failed: ${error.message}`)
			this.updateStatus(InstanceStatus.ConnectionFailure)
		}
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

	startHeartbeat() {
        heartbeat.startHeartbeat(this)
        this.heartbeatInterval = setInterval(async () => {
            const result = await heartbeat.sendHeartbeat(this)
            if (result) {
                this.authHeader = result.authHeader
                this.csrfToken = result.csrfToken
            }
        }, 60000) // 60 seconds
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