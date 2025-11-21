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

};
