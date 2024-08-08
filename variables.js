module.exports = async function (self) {
    const variables = []; // Initialize the variables array

    // Add input variables
    for (let i = 1; i <= 32; i++) {
        variables.push({ variableId: `input_${i}`, name: `Input ${i}` });
    }

    // Add output variables
    for (let i = 1; i <= 34; i++) {
        variables.push({ variableId: `output_${i}`, name: `Output ${i}` });
    }

    self.setVariableDefinitions(variables);

}