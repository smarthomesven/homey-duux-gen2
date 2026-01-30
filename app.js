'use strict';

const Homey = require('homey');
const axios = require('axios');

module.exports = class DuuxV2App extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('Duux Gen2 has been initialized');
  }

  async getHomeData() {
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
      
            // Filter for type 56 (as STRING!)
            return allDevices;
    } catch (error) {
      this.error('Error in getHomeData:', error.message);
      return { error: error.message };
    }
  }

  async codeLogin(data, session, type) {
    try {
      const code = data.code;
      this.homey.settings.set('code', code);
      const codeVerifier = this.homey.settings.get('verifier');
      const cloudId = await this.homey.cloud.getHomeyId();
      const response = await axios.post('https://v5.api.cloudgarden.nl/auth/token', {
        code: code,
        codeVerifier: codeVerifier,
        grantType: 'authorization_code',
        clientId: '83f34a5fa5faca9023c78980a57a87b41f6972fc4ee45e9c',
        redirectUri: `https://smarthomesven.github.io/homey-duux-gen2-auth/#/${cloudId}`,
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
        if (type === 'pair') {
          await session.showView('list_devices');
        } else if (type === 'repair') {
          await session.done();
        }
        return true;
      } else {
        return false;
      }
    } catch (error) {
      this.error('Login error:', error);
      return false;
    }
  }

};
