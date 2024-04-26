const Validatorjs = require('validatorjs')
const Validator = {
    validate: (args, rules) => {
        let errors
        let result = { success: true }
        let validation = new Validatorjs(args, rules)

        if (validation.fails()) {
            result.success = false
            result.errors = validation.errors.all()
        }
        return result
    },
    convertToRules: (data) => {
        let result = {}
        for (const item of data) {
            const required = item.required ? 'required|' : ''
            result[item.name] = `${required}${item.type}`
        }
        return result
    }
}
module.exports = Validator