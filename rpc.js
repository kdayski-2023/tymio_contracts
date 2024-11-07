const axios = require("axios")
const express = require('express')
const cors = require("cors")
const bodyParser = require('body-parser')
const jayson = require('jayson')
const router = require('./rpc/router')

const app = express()
app.use(cors())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.get('/', (req, res) => {
    res.send('Version 0.1')
  })
app.post('/rpc', jayson.server(router.rpc).middleware())
app.post('/tymio', jayson.server(router.tymio).middleware())
app.listen(5001, async () => {
    console.log(`Server started on port ${5001}`)
    // setTimeout(() => {
    //     axios.post(`http://dev2.fanil.ru:${port}/tymio`,
    //         {
    //             "jsonrpc": "2.0",
    //             "method": "checkExpiration",
    //             "id": 1,
    //             "params": {
    //                 chainId: 1,
    //                 sessionToken: 'xxx'
    //             }
    //         },
    //         {
    //             "Content-type": "application/json",
    //             "Accept": "*/*"
    //         }
    //     ).then((res) => {
    //         console.log(res.data)
    //     })
    //         .catch((error) => {
    //             console.log(error)
    //         })
    // }, 5000)


})