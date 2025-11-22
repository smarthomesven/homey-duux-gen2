const axios = require('axios');

module.exports = {
  async getLinksData({ homey }) {
    try {
      const accessToken = homey.settings.get('accessToken');
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
      const allDevicesWithStatus = [];
      for (const tenant of userTenants) {
        try {
          const devicesResponse = await axios.get(`https://v5.api.cloudgarden.nl/sensor/?tenantId=${tenant.id}&returnModel=2&skip=0&take=25`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });
          
          const devices = devicesResponse.data.data;
          
          // Fetch status for each device
          for (const device of devices) {
            try {
              const statusResponse = await axios.get(
                `https://v5.api.cloudgarden.nl/data/${device.deviceId}/status`,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`
                  }
                }
              );
              
              allDevicesWithStatus.push({
                tenantName: tenant.name,
                tenantId: tenant.id,
                deviceInfo: {
                  id: device.id,
                  displayName: device.displayName,
                  deviceId: device.deviceId,
                  type: device.type,
                  spaceId: device.spaceId,
                  name: device.name
                },
                status: statusResponse.data.data
              });
            } catch (statusError) {
              // If status fetch fails, still include the device info
              allDevicesWithStatus.push({
                tenantName: tenant.name,
                tenantId: tenant.id,
                deviceInfo: {
                  id: device.id,
                  displayName: device.displayName,
                  deviceId: device.deviceId,
                  type: device.type,
                  spaceId: device.spaceId,
                  name: device.name
                },
                statusError: statusError.message
              });
            }
          }
        } catch (error) {
          homey.app.error(`Error fetching devices for tenant ${tenant.id}:`, error.message);
        }
      }

      return allDevicesWithStatus;
    } catch (error) {
      homey.app.error('Error in getLinksData:', error.message);
      return { error: error.message };
    }
  },

  async send({ homey, body }) {
    try {
      const { message, deviceId, deviceName, data } = body;

      if (!message || !data) {
        throw new Error('Missing required fields');
      }

      const response = await axios.post('https://device-support-requests.vercel.app/api/send-report', {
        message: message,
        app: 'Duux Gen2',
        report: {
          deviceId: deviceId,
          deviceName: deviceName,
          data: data
        }
      });

      return {
        success: true,
        id: response.data.id
      };
    } catch (error) {
      homey.app.error('Error sending to support:', error.message);
      throw new Error(error.response?.data?.error || error.message);
    }
  }
};