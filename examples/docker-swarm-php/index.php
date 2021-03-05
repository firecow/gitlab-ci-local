const express = require('express');
const app = express();
app.disable('x-powered-by');

app.get('/', function (req, res) {
    res.send('Hello World');
});

app.listen(3000);
