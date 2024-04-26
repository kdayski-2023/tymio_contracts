const fs = require('fs')

module.exports = {
    writeLogData: (file, data) => {
        const logFile = process.cwd() + '/logs/' + file + '.json'
        fs.writeFileSync(logFile, JSON.stringify(data), null, 4)
    },
    readLogData: (file) => {
        let res
        const logFile = process.cwd() + '/logs/' + file + '.json'
        try {
            res = JSON.parse(fs.readFileSync(logFile, 'utf8'))
        } catch (error) {
            console.log(error)
            res = {}
        }
        return res
    },
    clearLog: (file) => {
        const logFile = process.cwd() + '/logs/' + file + '.json'
        fs.writeFileSync(logFile, JSON.stringify({ contracts: [] }), () => { })//CLEAR LOG
    }
}