'use strict';

const Homey = require('homey');

module.exports = class DuuxV2App extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('Duux Gen2 has been initialized');
  }

};
