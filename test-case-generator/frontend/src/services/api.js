import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

export const uploadFiles = async (files) => {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));

  const response = await axios.post(`${API_URL}/upload/files`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const clearDatabase = async () => {
  const response = await axios.delete(`${API_URL}/upload/clear`);
  return response.data;
};

export const generateTests = async (params) => {
  const response = await axios.post(`${API_URL}/generate/tests`, params);
  return response.data;
};