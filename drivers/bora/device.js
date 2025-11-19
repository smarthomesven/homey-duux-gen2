'use strict';

const Homey = require('homey');
const axios = require('axios');

module.exports = class BoraDevice extends Homey.Device {

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    try {
      this.log('Bora device has been initialized');
      
      // Register capability listeners
      this.registerCapabilityListener("onoff", async (value) => {
        let command;
        if (value === true) {
          command = "tune set power 1";
        } else {
          command = "tune set power 0";
        }
        await this.sendCommand(command);
      });

      this.registerCapabilityListener("target_humidity", async (value) => {
        let command;
        command = `tune set sp ${Math.round(value * 100)}`;
        await this.sendCommand(command);
      });

      this.registerCapabilityListener("mode", async (value) => {
        let command;
        if (value === "auto") {
          command = "tune set mode 0";
        } else if (value === "continuous") {
          command = "tune set mode 1";
        } else return;
        await this.sendCommand(command);
      });

      this.registerCapabilityListener("fanmode", async (value) => {
        let command;
        if (value === "two") {
          command = "tune set fan 0";
        } else if (value === "one") {
          command = "tune set fan 1";
        } else return;
        await this.sendCommand(command);
      });

      this.registerCapabilityListener("child_lock", async (value) => {
        let command;
        if (value === true) {
          command = "tune set lock 1";
        } else if (value === false) {
          command = "tune set lock 0";
        } else return;
        await this.sendCommand(command);
      });

      this.registerCapabilityListener("laundry_mode", async (value) => {
        let command;
        if (value === true) {
          command = "tune set laundr 1";
        } else if (value === false) {
          command = "tune set laundr 0";
        } else return;
        await this.sendCommand(command);
      });

      this.homey.settings.set('firstRun', true);

      // Start polling
      this.startPolling();

      const enableLaundryModeAction = this.homey.flow.getActionCard('enable_laundry_mode');
      const disableLaundryModeAction = this.homey.flow.getActionCard('disable_laundry_mode');
      const enableChildLockAction = this.homey.flow.getActionCard('enable_child_lock');
      const disableChildLockAction = this.homey.flow.getActionCard('disable_child_lock');
      const enableNightModeAction = this.homey.flow.getActionCard('enable_night_mode');
      const disableNightModeAction = this.homey.flow.getActionCard('disable_night_mode');
      const setModeAction = this.homey.flow.getActionCard('set_mode');
      const setFanSpeedAction = this.homey.flow.getActionCard('set_fan_speed');
      const childLockCondition = this.homey.flow.getConditionCard('child_lock_condition');
      const laundryModeCondition = this.homey.flow.getConditionCard('laundry_mode_condition');

      childLockCondition.registerRunListener(async (args, state) => {
        const isLocked = this.getCapabilityValue('child_lock');
        return isLocked;
      });

      laundryModeCondition.registerRunListener(async (args, state) => {
        const isLaundry = this.getCapabilityValue('laundry_mode');
        return isLaundry;
      });

      setModeAction.registerRunListener(async (args, state) => {
        if (args.mode === 'auto') {
          await this.sendCommand("tune set mode 0");
        } else if (args.mode === 'continuous') {
          await this.sendCommand("tune set mode 1");
        }
        return true;
      });

      setFanSpeedAction.registerRunListener(async (args, state) => {
        if (args.speed === 'two') {
          await this.sendCommand("tune set fan 0");
        } else if (args.speed === 'one') {
          await this.sendCommand("tune set fan 1");
        }
        return true;
      });

      enableLaundryModeAction.registerRunListener(async (args, state) => {
        await this.sendCommand("tune set laundr 1");
        return true;
      });

      disableLaundryModeAction.registerRunListener(async (args, state) => {
        await this.sendCommand("tune set laundr 0");
        return true;
      });

      enableChildLockAction.registerRunListener(async (args, state) => {
        await this.sendCommand("tune set lock 1");
        return true;
      });

      disableChildLockAction.registerRunListener(async (args, state) => {
        await this.sendCommand("tune set lock 0");
        return true;
      });

      enableNightModeAction.registerRunListener(async (args, state) => {
        await this.sendCommand("tune set sleep 1");
        return true;
      });

      disableNightModeAction.registerRunListener(async (args, state) => {
        await this.sendCommand("tune set sleep 0");
        return true;
      });
    } catch (error) {
      this.error('Error during Bora device initialization:', error);
    }
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('Bora device has been added');
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
    this.log('Bora device settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('Bora device was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('Bora device has been deleted');
    this.stopPolling();
  }

  startPolling() {
    // Clear any existing interval
    this.stopPolling();
    
    // Poll immediately
    this.pollDeviceStatus();
    
    // Then poll every 10 seconds
    this.pollInterval = this.homey.setInterval(() => {
      this.pollDeviceStatus();
    }, 10000);
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

      const response = await axios.get(
        `https://v5.api.cloudgarden.nl/data/${mac}/status`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      const status = response.data.data;
      
      if (status) {
        // Update onoff capability (0=off, 1=on)
        const isOn = status.power === 1;
        if (this.hasCapability('onoff')) {
          await this.setCapabilityValue('onoff', isOn).catch(err => {
            this.error('Error setting onoff capability:', err);
          });
        }

        // Update humidity (if you have this capability)
        if (this.hasCapability('measure_humidity') && status.hum !== undefined) {
          await this.setCapabilityValue('measure_humidity', status.hum).catch(err => {
            this.error('Error setting humidity capability:', err);
          });
        }

        // Update target humidity setpoint (if you have this capability)
        if (this.hasCapability('target_humidity') && status.sp !== undefined) {
          const setpoint = status.sp / 100;
          await this.setCapabilityValue('target_humidity', setpoint).catch(err => {
            this.error('Error setting target humidity capability:', err);
          });
        }

        // Log if device is in error state
        if (status.err && status.err !== 0) {
          this.error('Device reported error code:', status.err);
        }

          await this.setAvailable();

        if (this.hasCapability('mode') && status.mode !== undefined) {
          let modeValue;
          if (status.mode === 0) {
            modeValue = "auto";
          } else if (status.mode === 1) {
            modeValue = "continuous";
          } else return;
          await this.setCapabilityValue('mode', modeValue).catch(err => {
            this.error('Error setting mode capability:', err);
          });
        }

        if (this.hasCapability('fanmode') && status.fan !== undefined) {
          let fanValue;
          if (status.fan === 0) {
            fanValue = "two";
          } else if (status.fan === 1) {
            fanValue = "one";
          } else return;
          await this.setCapabilityValue('fanmode', fanValue).catch(err => {
            this.error('Error setting fanmode capability:', err);
          });
        }

        const isFirstRun = this.homey.settings.get('firstRun');

        const isLocked = status.lock === 1;
        this.setStoreValue('child_lock', isLocked);
        if (this.hasCapability('child_lock')) {
          if (isLocked !== this.getCapabilityValue('child_lock')) {
            if (isFirstRun !== true) {
              if (this.getCapabilityValue('child_lock') === true) {
                await this.driver.triggerFlow('child_lock_disabled', this);
              } else if (this.getCapabilityValue('child_lock') === false) {
                await this.driver.triggerFlow('child_lock_enabled', this);
              }
            }
          }
          await this.setCapabilityValue('child_lock', isLocked).catch(err => {
            this.error('Error setting child_lock capability:', err);
          });
        }

        const isLaundry = status.laundr === 1;
        if (this.hasCapability('laundry_mode')) {
          if (isLaundry !== this.getCapabilityValue('laundry_mode')) {
            if (isFirstRun !== true) {
              if (this.getCapabilityValue('laundry_mode') === true) {
                await this.driver.triggerFlow('laundry_mode_disabled', this);
              } else if (this.getCapabilityValue('laundry_mode') === false) {
                await this.driver.triggerFlow('laundry_mode_enabled', this);
              }
            }
          }
          await this.setCapabilityValue('laundry_mode', isLaundry).catch(err => {
            this.error('Error setting laundry_mode capability:', err);
          });
        }

        if (isFirstRun === true) {
          this.homey.settings.set('firstRun', false);
        }

        this.log('Status updated successfully');
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

      await axios.post(
        `https://v5.api.cloudgarden.nl/sensor/${mac}/commands`,
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