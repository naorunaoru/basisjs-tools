var fs = require('fs');

module.exports = {
  key: fs.readFileSync(__dirname + '/key.pem'),
  cert: fs.readFileSync(__dirname + '/cert.pem'),
  passphrase: 'pass123'
};
