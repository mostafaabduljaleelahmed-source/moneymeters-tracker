import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// غيّر القيمة دي لعنوان السيرفر الحقيقي عند البناء للإنتاج
export const API_URL = 'http://localhost:4000';

const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 15000 });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
