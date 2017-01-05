import configFactory from './config';
const {ssid, password, apiKey} = configFactory();
const wifi = require('Wifi');
const http = require('http');
const sensor = require('DS18B20').connect(ow);
const ow = new OneWire(NodeMCU.D6);
const RELAY = NodeMCU.D2;
const BTN = NodeMCU.D3
let isOn = false;
let timeout = 25 * 60 * 1000;

function headers (type) {
  return {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Request-Method': '*',
    'Access-Control-Allow-Methods': 'OPTIONS, GET',
    'Access-Control-Allow-Headers': '*'
  };
}

function fpOn(timer) {
  digitalWrite(RELAY, true);
  clearTimeout();
  setTimeout(() => {
    isOn = fpOff();
  }, timer)
  return true;
}

function fpOff() {
  digitalWrite(RELAY, false);
  return false;
}

function reportTemp() {
  sensor.getTemp(temp => {
    console.log(`Temp is ${temp*(9/5)+32}F`);
  });
}

function main() {
  let server = http.createServer((req, res) => {
    let auth;
    if (req.headers.Authorization === apiKey) auth = true;
    if (req.method === 'GET') {
      if (req.url === '/on' && auth) {
        isOn = fpOn(timeout);
        res.writeHead(200, headers('application/json'));
        return res.end('{"message":"Fireplace turned on!"}');
      } else if (req.url === '/off' && auth) {
        isOn = fpOff();
        res.writeHead(200, headers('application/json'));
        return res.end('{"message":"Fireplace turned off!"}');
      } else if (req.url === '/status' && auth) {
        res.writeHead(200, headers('application/json'));
        let status = isOn ? 'on' : 'off';
        let result = {
          message: `The fireplace is currently ${status}`,
          status: isOn,
          timeout: `The current timer is ${timeout / 1000 / 60} minutes.`
        };
        return res.end(JSON.stringify(result));
      } else {
        res.writeHead(400, {'Content/Type': 'application/json'});
        return res.end(`{"error":"Unknown endpoint ${req.url}"}`);
      }
    } else if (req.method === 'POST' && auth) {
      let result = ''
      let parsed = url.parse(req.url);
      let newTimeout = Math.ceil(parsed.query.split('=')[1]);
      if (newTimeout < 1) {
        result = {message: `Timeout set to minimum value of 1 minute`};
        timeout = 60 * 1000;
      } else {
        timeout = newTimeout * 60 * 1000;
        result = {message: `Timeout set to ${newTimeout} minutes`};
      }
      res.writeHead(200, headers('application/json'));
      return res.end(JSON.stringify(result));
    }
    res.writeHead(404, {'Content-Type': 'text/plain'});
    return res.end('Not found');
  });



  setWatch(() => {
    if (isOn) {
      isOn = fpOff();
    } else {
      isOn = fpOn(timeout);
    }
  }, BTN, {repeat: true, edge: 'rising', debounce: 500});

  wifi.connect(ssid, {password}, err => {
    if (err) console.log('Problem: ', err);
    console.log('** connected. IP address: ',wifi.getIP().ip);
    reportTemp();
    server.listen(80);
  });
  wifi.save();
}
