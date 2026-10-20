import axios from 'axios';
import { getFirebaseAuth } from '@/lib/auth/firebase';

export const httpClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// 1. Request Interceptor: Her istekte Firebase'den güncel ID Token'ı al ve ekle
httpClient.interceptors.request.use(
  async (config) => {
    if (typeof window !== 'undefined') {
      try {
        const auth = getFirebaseAuth();
        const currentUser = auth.currentUser;

        if (currentUser) {
          // Firebase'in token'ı önbellekten almasını sağlar (gerekirse otomatik yeniler)
          const token = await currentUser.getIdToken(false);

          if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
      } catch (error) {
        console.error('Firebase token alınırken hata oluştu:', error);
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 2. Response Interceptor: 401 durumunda Firebase token'ı yenileyip isteği tekrar tetikle
httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Eğer 401 hatası alındıysa ve bu istek daha önce tekrar denenmediyse
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        if (typeof window !== 'undefined') {
          const auth = getFirebaseAuth();
          const currentUser = auth.currentUser;

          if (currentUser) {
            // Süresi dolmuş token'ı Firebase üzerinden ZORUNLU olarak yenile (forceRefresh: true)
            const newToken = await currentUser.getIdToken(true);

            if (newToken && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return httpClient(originalRequest); // Yarım kalan isteği yeni token ile tekrar et
            }
          }
        }
      } catch (refreshError) {
        // Token yenileme de başarısız olduysa oturum düşmüştür, login'e at
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
