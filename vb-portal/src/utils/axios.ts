import axios, { AxiosRequestConfig } from 'axios';

const axiosServices = axios.create({ baseURL: import.meta.env.VITE_APP_API_URL || '' });

// ==============================|| AXIOS - FOR MOCK SERVICES ||============================== //

axiosServices.interceptors.request.use(
  async (config) => {
    const accessToken = localStorage.getItem('serviceToken');
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosServices.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const isLoginRequest = error.config?.url === '/api/account/login';
    if (status === 401 && !isLoginRequest) {
      localStorage.removeItem('serviceToken');
      redirectWithBasePath('/login');
    }

    const responseData = error.response?.data;
    const message =
      (typeof responseData === 'string' && responseData) || responseData?.detail || responseData?.message || error.message || 'Request failed';
    return Promise.reject(new Error(message));
  }
);

export default axiosServices;

export const fetcher = async (args: string | [string, AxiosRequestConfig]) => {
  const [url, config] = Array.isArray(args) ? args : [args];

  const res = await axiosServices.get(url, { ...config });

  return res.data;
};

export function redirectWithBasePath(path: string) {
  const basePath = import.meta.env.VITE_APP_BASE_NAME || process.env.VITE_APP_BASE_NAME || ''; // adjust for Vite, CRA, etc.
  window.location.pathname = `${basePath.replace(/\/$/, '')}${path}`;
}
