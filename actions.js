const matrix = require('./matrix')

module.exports = function (self) {
    self.log('debug', 'Updating actions');
    const inputChoices = self.getVariableChoices('inputs');
    const outputChoices = self.getVariableChoices('outputs');
    self.log('debug', `Input choices: ${JSON.stringify(inputChoices)}`);
    self.log('debug', `Output choices: ${JSON.stringify(outputChoices)}`);

    self.setActionDefinitions({
        matrix_action: {
            name: 'Set matrix routing',
            description: 'To turn off all audio on an output, simply choose no channels in the input channel field',
            options: [
                {
                    id: 'input',
                    type: 'multidropdown',
                    label: 'Input channel(s)',
                    choices: inputChoices,
                    default: inputChoices.length > 0 ? inputChoices[0].id : undefined,
                },
                {
                    id: 'output',
                    type: 'dropdown',
                    label: 'Output channel',
                    choices: outputChoices,
                    default: outputChoices.length > 0 ? outputChoices[0].id : undefined,
                },
            ],
            callback: async (event) => {
                self.log('info', `Action triggered: Input ${event.options.input} to Output ${event.options.output}`);
                const result = await matrix.makeMatrixRequest(self, event.options.output, event.options.input);
                if (result) {
                    self.log('info', `Matrix updated successfully: ${event.options.input} -> ${event.options.output}`);
                } else {
                    self.log('warn', `Failed to update matrix: ${event.options.input} -> ${event.options.output}`);
                }
            },
        },
    });
}