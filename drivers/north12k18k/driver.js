'use strict';

const Homey = require('homey');
const axios = require('axios');
const crypto = require('crypto');

module.exports = class NorthDriver extends Homey.Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('North driver has been initialized');
  }

  async triggerFlow(card_id, device) {
    this.homey.flow.getDeviceTriggerCard(card_id).trigger(device, {}, {});
  }

  generateCodeVerifier() {
    const buffer = crypto.randomBytes(64);
    return this.base64URLEncode(buffer);
  }

  generateCodeChallenge(verifier) {
    const hash = crypto.createHash('sha256').update(verifier).digest();
    return this.base64URLEncode(hash);
  }

  base64URLEncode(buffer) {
    return buffer.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  async onPair(session) {
    this.log('North pairing started');

    session.setHandler('showView', async (viewId) => {
      if (viewId === 'email') {
        const loggedIn = this.homey.settings.get('loggedIn');
        if (loggedIn) {
          await session.showView('list_devices');
          return;
        }
      }
    });
    
    session.setHandler('login', async (data) => {
      try {
        this.homey.settings.set('email', data.email);
        const codeVerifier = this.generateCodeVerifier();
        const codeChallenge = this.generateCodeChallenge(codeVerifier);
        this.homey.settings.set('verifier', codeVerifier);
        this.homey.settings.set('challenge', codeChallenge);
        this.log('Login with email:', data.email);
        
        const response = await axios.post('https://v5.api.cloudgarden.nl/auth/passwordlessLogin/code', {
          email: data.email,
          clientId: '83f34a5fa5faca9023c78980a57a87b41f6972fc4ee45e9c',
          codeChallenge: codeChallenge,
          codeChallengeMethod: 'sha256',
          redirectUri: 'https://duux-deeplink.vercel.app/login/verify',
          tenantId: 44
        });
        
        if (response.data && response.data.data === 'ok') {
          await session.showView('code');
        } else {
          return false;
        }
      } catch (error) {
        this.error('Login error:', error);
        return false;
      }
    });

    session.setHandler('code', async (data) => {
      try {
        this.homey.settings.set('code', data.code);
        const codeVerifier = this.homey.settings.get('verifier');
        const response = await axios.post('https://v5.api.cloudgarden.nl/auth/token', {
          code: data.code,
          codeVerifier: codeVerifier,
          grantType: 'authorization_code',
          clientId: '83f34a5fa5faca9023c78980a57a87b41f6972fc4ee45e9c',
          redirectUri: 'https://duux-deeplink.vercel.app/login/verify',
          makeAccessTokenLongLasting: true
        });
        
        if (response.data && response.data.data.token) {
          const userResponse = await axios.get('https://v5.api.cloudgarden.nl/user/me', {
            headers: {
              'Authorization': `Bearer ${response.data.data.token}`
            }
          });
          
          this.homey.settings.set('userId', userResponse.data.data.id);
          this.homey.settings.set('loggedIn', true);
          this.homey.settings.set('accessToken', response.data.data.token);
          this.homey.settings.set('codeVerifier', null);
          this.homey.settings.set('codeChallenge', null);
          this.homey.settings.set('email', null);
          this.homey.settings.set('code', null);
          await session.showView('list_devices');
          return true;
        } else {
          return false;
        }
      } catch (error) {
        this.error('Login error:', error);
        return false;
      }
    });

    session.setHandler("list_devices", async () => {
      try {
        return await this.onPairListDevices();
      } catch (error) {
        throw new Error("Error while fetching devices: " + error.message);
      }
    });
  }

  async onRepair(session) {
    this.log('North repairing started');
    
    session.setHandler('login', async (data) => {
      try {
        this.homey.settings.set('email', data.email);
        const codeVerifier = this.generateCodeVerifier();
        const codeChallenge = this.generateCodeChallenge(codeVerifier);
        this.homey.settings.set('verifier', codeVerifier);
        this.homey.settings.set('challenge', codeChallenge);
        this.log('Login with email:', data.email);
        
        const response = await axios.post('https://v5.api.cloudgarden.nl/auth/passwordlessLogin/code', {
          email: data.email,
          clientId: '83f34a5fa5faca9023c78980a57a87b41f6972fc4ee45e9c',
          codeChallenge: codeChallenge,
          codeChallengeMethod: 'sha256',
          redirectUri: 'https://duux-deeplink.vercel.app/login/verify',
          tenantId: 44
        });
        
        if (response.data && response.data.data === 'ok') {
          await session.showView('code');
        } else {
          return false;
        }
      } catch (error) {
        this.error('Login error:', error);
        return false;
      }
    });

    session.setHandler('code', async (data) => {
      try {
        this.homey.settings.set('code', data.code);
        const codeVerifier = this.homey.settings.get('verifier');
        const response = await axios.post('https://v5.api.cloudgarden.nl/auth/token', {
          code: data.code,
          codeVerifier: codeVerifier,
          grantType: 'authorization_code',
          clientId: '83f34a5fa5faca9023c78980a57a87b41f6972fc4ee45e9c',
          redirectUri: 'https://duux-deeplink.vercel.app/login/verify',
          makeAccessTokenLongLasting: true
        });
        
        if (response.data && response.data.data.token) {
          const userResponse = await axios.get('https://v5.api.cloudgarden.nl/user/me', {
            headers: {
              'Authorization': `Bearer ${response.data.data.token}`
            }
          });
          
          this.homey.settings.set('userId', userResponse.data.data.id);
          this.homey.settings.set('loggedIn', true);
          this.homey.settings.set('accessToken', response.data.data.token);
          this.homey.settings.set('codeVerifier', null);
          this.homey.settings.set('codeChallenge', null);
          this.homey.settings.set('email', null);
          this.homey.settings.set('code', null);
          await session.done();
          return true;
        } else {
          return false;
        }
      } catch (error) {
        this.error('Login error:', error);
        return false;
      }
    });
  }

  /**
   * onPairListDevices is called when a user is adding a device
   * and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    try {
      const accessToken = this.homey.settings.get('accessToken');
      if (!accessToken) {
        throw new Error('Not logged in');
      }

      // Get all tenants (homes) for the user
      const tenantsResponse = await axios.get('https://v5.api.cloudgarden.nl/tenant/?tenantQueryType=1&issuesOnly=false&sortDescendent=false&skip=0&take=25&returnModel=2', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const tenants = tenantsResponse.data.data;
      
      // Filter out the parent Duux tenant (id 44)
      const userTenants = tenants.filter(tenant => tenant.parentTenantId !== null);
      
      // Fetch devices from all user tenants
      const allDevices = [];
      for (const tenant of userTenants) {
        try {
          const devicesResponse = await axios.get(`https://v5.api.cloudgarden.nl/sensor/?tenantId=${tenant.id}&returnModel=2&skip=0&take=25`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });
          
          // Add tenant info to each device for reference
          const devicesWithTenant = devicesResponse.data.data.map(device => ({
            ...device,
            tenantId: tenant.id,
            tenantName: tenant.name
          }));
          
          allDevices.push(...devicesWithTenant);
        } catch (error) {
          this.error(`Error fetching devices for tenant ${tenant.id}:`, error.message);
        }
      }

      const availableDevices = allDevices
        .filter(device => device.type !== '56' && device.type !== '32' && device.type !== '23' && device.type !== '21' && device.type !== '50' && device.type !== '26' && device.type !== '53' && device.type !== '52')
        .map(device => ({
          name: device.displayName,
          data: {
            id: device.id
          },
          store: {
            id: device.id,
            mac: device.deviceId,
            tenantId: device.tenantId,
            spaceId: device.spaceId,
            type: device.type
          }
        }));

      return availableDevices;
    } catch (error) {
      this.error('Error in onPairListDevices:', error.message);
    }
  }

};