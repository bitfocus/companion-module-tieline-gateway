const { Regex } = require('@companion-module/base')

module.exports = {
    getConfigFields() {
        return [
            {
                type: 'textinput',
                id: 'host',
                label: 'Tieline IP',
                width: 8,
                regex: Regex.IP,
            },
            {
                type: 'textinput',
                id: 'username',
                label: 'Tieline username',
                width: 12,
                default: '',
            },
            {
                type: 'textinput',
                id: 'password',
                label: 'Tieline password',
                width: 12,
                default: '',
            },
        ]
    }
}