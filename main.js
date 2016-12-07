let isOff = true;
const timeout = 25 * 60 * 1000;
const wifi = require('Wifi');
const http = require('http');
import configFactory from './config';
const {ssid, password, apiKey} = configFactory();
const RELAY = NodeMCU.D2;
const BTN = NodeMCU.D3

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
  digitalWrite(RELAY, false);
  clearTimeout();
  setTimeout(() => {
    isOff = fpOff();
  }, timer)
  return false;
}

function fpOff() {
  digitalWrite(RELAY, true);
  return true;
}

function main() {
  http.createServer((req, res) => {
    let auth;
    if (req.headers.Authorization === apiKey) auth = true;
    if (req.method === 'GET') {
      if (req.url === '/on' && auth) {
        isOff = fpOn(timeout);
        res.writeHead(200, headers('application/json'));
        return res.end('{"message":"Fireplace turned on!"}');
      } else if (req.url === '/off' && auth) {
        isOff = fpOff();
        res.writeHead(200, headers('application/json'));
        return res.end('{"message":"Fireplace turned off!"}');
      } else if (req.url === '/status' && auth) {
        res.writeHead(200, headers('application/json'));
        let status = isOff ? 'off' : 'on';
        let result = {
          message: `The fireplace is currently ${status}`,
          status: isOff,
          timeout: `The current timer is ${timeout / 1000 / 60} minutes.`
        };
        return res.end(JSON.stringify(result));
      } else {
        res.writeHead(400, {'Content/Type': 'application/json'});
        return res.end(`{"error":"Unknown endpoint ${req.url}"}`);
      }
    } else if (req.method === 'POST') {
      let parsed = url.parse(req.url);
      let newTimeout = parsed.query.split('=')[1];
      timeout = newTimeout * 60 * 1000;
      let result = {message: `Timeout set to ${newTimeout} minutes`};
      res.writeHead(200, headers('application/json'));
      return res.end(JSON.stringify(result));
    }
    res.writeHead(404, {'Content-Type': 'text/plain'});
    return res.end('Not found');
  }).listen(80);

  setWatch(() => {
    if (isOff) {
      isOff = fpOn(timeout);
    } else {
      isOff = fpOff();
    }
  }, BTN, {repeat: true, edge: 'rising', debounce: 500});

  wifi.connect(ssid, {password}, err => {
    if (err) console.log('Problem: ', err);
    console.log('** connected.  IP address: ',wifi.getIP().ip);
  });
  wifi.save();
}
