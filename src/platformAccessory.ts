import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { ExampleHomebridgePlatform } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class ExamplePlatformAccessory {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private states = {
    On: false,
    Brightness: 100,
  };

  private timeout;

  constructor(
    private readonly platform: ExampleHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Aerogarden')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .on('set', this.setOn.bind(this))                // SET - bind to the `setOn` method below
      .on('get', this.getOn.bind(this));               // GET - bind to the `getOn` method below

    // register handlers for the Brightness Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.Brightness)
      .on('set', this.setBrightness.bind(this));       // SET - bind to the 'setBrightness` method below


    /**
     * Creating multiple services of the same type.
     * 
     * To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
     * when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
     * this.accessory.getService('NAME') || this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE_ID');
     * 
     * The USER_DEFINED_SUBTYPE must be unique to the platform accessory (if you platform exposes multiple accessories, each accessory
     * can use the same sub type id.)
     */

    // Example: add two "motion sensor" services to the accessory
    // const motionSensorOneService = this.accessory.getService('Motion Sensor One Name') ||
    //   this.accessory.addService(this.platform.Service.MotionSensor, 'Motion Sensor One Name', 'YourUniqueIdentifier-1');

    // const motionSensorTwoService = this.accessory.getService('Motion Sensor Two Name') ||
    //   this.accessory.addService(this.platform.Service.MotionSensor, 'Motion Sensor Two Name', 'YourUniqueIdentifier-2');

    /**
     * Updating characteristics values asynchronously.
     * 
     * Example showing how to update the state of a Characteristic asynchronously instead
     * of using the `on('get')` handlers.
     * Here we change update the motion sensor trigger states on and off every 10 seconds
     * the `updateCharacteristic` method.
     * 
     */
    // let motionDetected = false;
    // setInterval(() => {
    //   // EXAMPLE - inverse the trigger
    //   motionDetected = !motionDetected;

    //   // push the new value to HomeKit
    //   // motionSensorOneService.updateCharacteristic(this.platform.Characteristic.MotionDetected, motionDetected);
    //   // motionSensorTwoService.updateCharacteristic(this.platform.Characteristic.MotionDetected, !motionDetected);

    //   this.platform.log.debug('Triggering motionSensorOneService:', motionDetected);
    //   this.platform.log.debug('Triggering motionSensorTwoService:', !motionDetected);
    // }, 10000);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    // implement your own code to turn your device on/off
    this.states.On = value as boolean;

    let update_url = 'http://ec2-54-86-39-88.compute-1.amazonaws.com:8080/'

    this.platform.log.debug('Toggle ', value ? 'On' : 'Off');
    // this.platform.log.debug('Brightness ->', this.states.Brightness);

    if (value == false && this.states.Brightness == 100) {
      this.togglePower().then(res => 
        { 
          setTimeout(this.togglePower.bind(this), 300);
        }
      );
    }
    else if (value == false && this.states.Brightness < 100 && this.states.Brightness > 0)
    {
      this.togglePower();
    }
    else if (value == true && this.states.Brightness == 0)
    {
      this.togglePower();
    }

    clearInterval(this.timeout);

    this.timeout = setTimeout(function() {
      callback(null);
    }, 30000);
  }

  togglePower()
  {
    this.platform.log.debug('togglePower');

    let prevBrightness = this.states.Brightness;

    if (this.states.Brightness == 100) {
      this.states.On = true;
      this.states.Brightness = 50;
      this.service.updateCharacteristic(this.platform.Characteristic.On, true);
      this.service.updateCharacteristic(this.platform.Characteristic.Brightness, 50);
    }
    else if (this.states.Brightness > 0 && this.states.Brightness < 100) {
      this.states.On = false;
      this.states.Brightness = 0;
      this.service.updateCharacteristic(this.platform.Characteristic.On, false);
      this.service.updateCharacteristic(this.platform.Characteristic.Brightness, 0);
    }
    else {
      this.states.On = true;
      this.states.Brightness = 100;
      this.service.updateCharacteristic(this.platform.Characteristic.On, true);
      this.service.updateCharacteristic(this.platform.Characteristic.Brightness, 100);
    }

    let params = {
      airGuid: this.platform.config.macAddress,
      chooseGarden: 0,
      userID: this.platform.config.userID,
      plantConfig: JSON.stringify({lightStat: this.states.On ? 1 : 0 })
    };

    return this.aerogarden('/api/Custom/UpdateDeviceConfig', params)
        .then(res => {
          this.platform.log.debug('Changing brightness from ', prevBrightness, ' to ', this.states.Brightness);
        })
        .catch(error => {
          this.platform.log.error('setOnError', error);
        });
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   * 
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   * 
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  getOn(callback: CharacteristicGetCallback) {

    // implement your own code to check if the device is on
    let isOn = this.states.On;

    // let update_url = 'http://ec2-54-86-39-88.compute-1.amazonaws.com:8080/api/CustomData/QueryUserDevice'

    this.aerogarden('/api/CustomData/QueryUserDevice', { userID: this.platform.config.userID})
        .then(res => {
          // this.platform.log.debug('getOn=', res.data);
          this.platform.log.debug('lightStat=', res.data[0].lightStat);
          isOn = res.data[0].lightStat == 1;

          if (res.data[0].lightStat == 0) 
          {
            this.states.Brightness = 0;
            this.service.updateCharacteristic(this.platform.Characteristic.Brightness, 0);
          }
          else if (res.data[0].lightStat == 1 && this.states.Brightness == 0)
          {
            this.states.Brightness = 100;
            this.service.updateCharacteristic(this.platform.Characteristic.Brightness, 100);
          }

          // if (!isOn) {
            callback(null, isOn);
          // }
        })
        .catch(error => {
          this.platform.log.error('getOn', error);
          callback(null, isOn);
        });
  }

  aerogarden(api_path: string, params: object)
  {
    let base_url = 'http://ec2-54-86-39-88.compute-1.amazonaws.com:8080'

    let config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'HA-Aerogarden/0.1'
      }
    };

    const querystring = require('querystring');
    const params_qs = querystring.stringify(params);

    const axios = require('axios')
    axios.defaults.headers.common = {};
    return axios.post(base_url + api_path, params_qs, config)
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  setBrightness(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    // implement your own code to set the brightness
    // this.states.Brightness = value as number;

    this.platform.log.debug('Set Characteristic Brightness -> ', value);

    // this.aerogarden('/api/Custom/UpdateDeviceConfig', params)
    //     .then(res => {
    //       let prevBrightness = this.states.Brightness;

    //       if (this.states.Brightness == 100) {
    //         this.states.On = true;
    //         this.states.Brightness = 50;
    //         this.service.updateCharacteristic(this.platform.Characteristic.On, true);
    //         this.service.updateCharacteristic(this.platform.Characteristic.Brightness, 50);
    //       }
    //       else if (this.states.Brightness == 50) {
    //         this.states.On = false;
    //         this.states.Brightness = 0;
    //         this.service.updateCharacteristic(this.platform.Characteristic.On, false);
    //         this.service.updateCharacteristic(this.platform.Characteristic.Brightness, 0);
    //       }
    //       else {
    //         this.states.On = true;
    //         this.states.Brightness = 100;
    //         this.service.updateCharacteristic(this.platform.Characteristic.On, true);
    //         this.service.updateCharacteristic(this.platform.Characteristic.Brightness, 100);
    //       }

    //       this.platform.log.debug('Changing brightness from ', prevBrightness, ' to ', this.states.Brightness);
          
    //       clearInterval(this.timeout);
    //       this.timeout = setTimeout(function() {
    //         callback(null);
    //       }, 3000);
    //     })
    //     .catch(error => {
    //       this.platform.log.error('setOn', error);
    //       callback(null);
    //     });

    // you must call the callback function
    callback(null);
  }

}
