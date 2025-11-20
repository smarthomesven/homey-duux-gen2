module.exports = {
  async getLinksData({ homey }) {
    return await homey.app.getHomeData();
  }
};