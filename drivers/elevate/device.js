'use strict';

const Homey = require('homey');
const axios = require('axios');
const https = require('https');
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 10000,
  maxSockets: 10,
  maxFreeSockets: 4,
  timeout: 30000,
});
const apiClient = axios.create({
  baseURL: 'https://v5.api.cloudgarden.nl',
  httpsAgent,
  timeout: 20000,
});

module.exports = class ElevateDevice extends Homey.Device {

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    try {
      this.log('Elevate device has been initialized');
      
      this.registerCapabilityListener("onoff", async (value) => {
        let command;
        if (value === true) {
          command = "tune set power 1";
        } else {
          command = "tune set power 0";
        }
        await this.sendCommand(command);
      });

      this.registerCapabilityListener("fan_speed", async (value) => {
        let command;
        command = `tune set speed ${value}`;
        await this.sendCommand(command);
      });

      this.registerCapabilityListener("elevate_mode", async (value) => {
        let command;
        if (value === "normal") {
          command = "tune set mode 0";
        } else if (value === "nature") {
          command = "tune set mode 1";
        } else return;
        await this.sendCommand(command);
      });

      this.registerCapabilityListener("horizontal_oscillation", async (value) => {
        let command;
        if (value === true) {
          command = "tune set horosc 1";
        } else if (value === false) {
          command = "tune set horosc 0";
        } else return;
        await this.sendCommand(command);
      });

      this.registerCapabilityListener("ionizer", async (value) => {
        let command;
        if (value === true) {
          command = "tune set ion 1";
        } else if (value === false) {
          command = "tune set ion 0";
        } else return;
        await this.sendCommand(command);
      });

      this.registerCapabilityListener("night_mode", async (value) => {
        let command;
        if (value === true) {
          command = "tune set night 1";
        } else if (value === false) {
          command = "tune set night 0";
        } else return;
        await this.sendCommand(command);
      });

      this.setStoreValue('firstRun', true);

      // Start polling
      this.startPolling();
    } catch (error) {
      this.error('Error during Elevate device initialization:', error);
    }
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('Elevate device has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Elevate device settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('Elevate device was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('Elevate device has been deleted');
    this.stopPolling();
  }

  startPolling() {
    this.stopPolling();
    this.pollDeviceStatus();
    this.pollInterval = this.homey.setInterval(() => {
      this.pollDeviceStatus();
    }, 17000);
  }

  stopPolling() {
    if (this.pollInterval) {
      this.homey.clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async pollDeviceStatus() {
    try {
      const accessToken = this.homey.settings.get('accessToken');
      const mac = this.getStoreValue('mac');
      
      if (!accessToken || !mac) {
        this.error('Missing accessToken or MAC address');
        return;
      }

      const response = await apiClient.get(
        `/data/${mac}/status`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      const status = response.data.data;
      
      if (status) {
        // Update onoff capability
        const isOn = status.power === 1;
        await this.setAvailable();
        if (this.hasCapability('onoff')) {
          await this.setCapabilityValue('onoff', isOn).catch(err => {
            this.error('Error setting onoff capability:', err);
          });
        }

        // Update fan speed capability
        if (this.hasCapability('fan_speed') && status.sp !== undefined) {
          const speed = status.speed;
          await this.setCapabilityValue('fan_speed', speed).catch(err => {
            this.error('Error setting fan speed capability:', err);
          });
        }

        // Log if device is in error state
        if (status.err && status.err !== 0) {
          this.error('Device reported error code:', status.err);
        }

        if (this.hasCapability('elevate_mode') && status.mode !== undefined) {
          let modeValue;
          if (status.mode === 0) {
            modeValue = "normal";
          } else if (status.mode === 1) {
            modeValue = "nature";
          } else return;
          await this.setCapabilityValue('elevate_mode', modeValue).catch(err => {
            this.error('Error setting mode capability:', err);
          });
        }

        const isFirstRun = this.getStoreValue('firstRun');

        const isHorizontalOscillation = status.horosc === 1;
        this.setStoreValue('horizontal_oscillation', isHorizontalOscillation);
        if (this.hasCapability('horizontal_oscillation')) {
          if (isHorizontalOscillation !== this.getCapabilityValue('horizontal_oscillation')) {
            if (isFirstRun !== true) {
              if (this.getCapabilityValue('horizontal_oscillation') === true) {
                await this.driver.triggerFlow('horizontal_oscillation_disabled', this);
              } else if (this.getCapabilityValue('horizontal_oscillation') === false) {
                await this.driver.triggerFlow('horizontal_oscillation_disabled', this);
              }
            }
          }
          await this.setCapabilityValue('horizontal_oscillation', isHorizontalOscillation).catch(err => {
            this.error('Error setting horizontal_oscillation capability:', err);
          });
        }

        const isNight = status.night === 1;
        this.setStoreValue('night_mode', isNight);
        if (this.hasCapability('night_mode')) {
          if (isNight !== this.getCapabilityValue('night_mode')) {
            if (isFirstRun !== true) {
              if (this.getCapabilityValue('night_mode') === true) {
                await this.driver.triggerFlow('night_mode_enabled_elevate', this);
              } else if (this.getCapabilityValue('night_mode') === false) {
                await this.driver.triggerFlow('night_mode_disabled_elevate', this);
              }
            }
          }
          await this.setCapabilityValue('night_mode', isNight).catch(err => {
            this.error('Error setting night_mode capability:', err);
          });
        }

        const isIon = status.ion === 1;
        this.setStoreValue('ionizer', isIon);
        if (this.hasCapability('ionizer')) {
          if (isNight !== this.getCapabilityValue('ionizer')) {
            if (isFirstRun !== true) {
              if (this.getCapabilityValue('ionizer') === true) {
                await this.driver.triggerFlow('ionizer_enabled_elevate', this);
              } else if (this.getCapabilityValue('ionizer') === false) {
                await this.driver.triggerFlow('ionizer_enabled_elevate', this);
              }
            }
          }
          await this.setCapabilityValue('ionizer', isIon).catch(err => {
            this.error('Error setting ionizer capability:', err);
          });
        }

        if (isFirstRun === true) {
          this.setStoreValue('firstRun', false);
        }
      }
    } catch (error) {
      this.error('Error polling device status:', error.message);
      
      if (error.response && error.response.status === 401) {
        await this.setUnavailable('Authentication required. Please re-login.').catch(err => {
          this.error('Error setting unavailable:', err);
        });
      }
    }
  }

  async sendCommand(command) {
    try {
      const accessToken = this.homey.settings.get('accessToken');
      const mac = this.getStoreValue('mac');
      
      if (!accessToken || !mac) {
        this.error('Missing accessToken or MAC address');
      }

      await apiClient.post(
        `/sensor/${mac}/commands`,
        {
          command: command
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return true;
    } catch (error) {
      this.error('Error controlling device:', error.message);
    }
  }

};