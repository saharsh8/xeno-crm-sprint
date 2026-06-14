import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api/v1';

export const crmApi = {
  getCustomers: async () => {
    const response = await axios.get(`${API_BASE_URL}/customers`);
    return response.data;
  },
  dispatchCampaign: async (campaignData: { name: string, audience_criteria: string, message_template: string, channel: string }) => {
    const response = await axios.post(`${API_BASE_URL}/campaigns`, campaignData);
    return response.data;
  },
  getAnalytics: async (campaignId: number) => {
    const response = await axios.get(`${API_BASE_URL}/campaigns/${campaignId}/analytics`);
    return response.data;
  }
};