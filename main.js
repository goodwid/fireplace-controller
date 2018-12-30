import { config } from './config';
const wifi = require('Wifi');
const mqtt = require('MQTT').create(config.server);
const controlTopic = `homeassist/${config.deviceId}/control`
const statusTopic = `homeassist/${config.deviceId}/status`;
const timerTopic = `homeassist/${config.deviceId}/timer`;
// const http = require('http');
const RELAY = NodeMCU.D2;
const BTN = NodeMCU.D3
let isOn = false;
let timeout = 25 * 60 * 1000;

function fpOn(timer) {
  digitalWrite(RELAY, true);
  mqtt.publish(statusTopic, 'on');
  clearTimeout();
  setTimeout(() => {
    isOn = fpOff();
  }, timer)
  return true;
}

function fpOff() {
  digitalWrite(RELAY, false);
  mqtt.publish(statusTopic, 'off');
  return false;
}

function main() {
  mqtt.on('connected', function() {
    mqtt.subscribe(controlTopic);
    mqtt.subscribe(timerTopic);
  });

  mqtt.on('publish', pub => {
    const {topic, message} = pub;
    console.log(`topic: ${topic}\nmessage: ${message}`);
    if (topic === controlTopic) {
      if (message === 'on') {
        isOn = fpOn(timeout);
      }
      if (message === 'off') {
        isOn = fpOff();
      }
    } else if (topic === timerTopic) {
      let newTimeout = parseInt(message);
      if (message < 1) timeout = 60 * 1000;
      else timeout = newTimeout * 60 * 1000;
    }
  })

  setWatch(() => {
    if (isOn) {
      isOn = fpOff();
    } else {
      isOn = fpOn(timeout);
    }
  }, BTN, {repeat: true, edge: 'rising', debounce: 500});

  wifi.connect(config.ssid, {password: config.password}, err => {
    if (err) console.log('Problem: ', err);
    console.log('** connected. IP address: ',wifi.getIP().ip);
    mqtt.connect();
  });
  wifi.save();
}
