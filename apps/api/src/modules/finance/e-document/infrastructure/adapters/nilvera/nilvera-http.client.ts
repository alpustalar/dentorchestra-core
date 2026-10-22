import { Injectable } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import type { EDocumentEnvironment } from '@modules/finance/e-document/domain/contracts/e-document.contracts';

export class NilveraApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly responseData: unknown
  ) {
    super(message);
    this.name = NilveraApiError.name;
  }
}

@Injectable()
export class NilveraHttpClient {
  private readonly http: AxiosInstance = axios.create({
    timeout: 30000,
    headers: { Accept: 'application/json' },
  });

  get<T>(
    connection: NilveraConnection,
    path: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.request<T>(connection, {
      ...config,
      method: 'GET',
      url: path,
    });
  }

  post<T>(
    connection: NilveraConnection,
    path: string,
    data: unknown
  ): Promise<T> {
    return this.request<T>(connection, {
      method: 'POST',
      url: path,
      data,
      headers: { 'Content-Type': 'application/json-patch+json' },
    });
  }

  put<T>(connection: NilveraConnection, path: string): Promise<T> {
    return this.request<T>(connection, { method: 'PUT', url: path });
  }

  private async request<T>(
    connection: NilveraConnection,
    config: AxiosRequestConfig
  ): Promise<T> {
    try {
      const response = await this.http.request<T>({
        ...config,
        baseURL:
          connection.environment === 'PRODUCTION'
            ? 'https://api.nilvera.com'
            : 'https://apitest.nilvera.com',
        headers: {
          ...config.headers,
          Authorization: `Bearer ${connection.apiKey}`,
        },
      });
      return response.data;
    } catch (error) {
      if (!(error instanceof AxiosError)) throw error;

      const axiosError = error as AxiosError<unknown>;
      const status = axiosError.response?.status ?? null;
      const responseData: unknown = axiosError.response?.data ?? null;
      throw new NilveraApiError(
        `Nilvera isteği başarısız (${status ?? 'ağ hatası'}): ${
          config.method ?? 'GET'
        } ${config.url ?? ''}`,
        status,
        responseData
      );
    }
  }
}

export interface NilveraConnection {
  environment: EDocumentEnvironment;
  apiKey: string;
}
