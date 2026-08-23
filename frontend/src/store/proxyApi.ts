import { emptySplitApi } from './emptyApi'
import type {
  LogDetailDto,
  LogListDto,
  LogQueryArgs,
  MockDto,
  ProxyDetailDto,
  ProxyListItemDto,
  ProxyStatsDto,
  UploadedCertificateDto,
  UpsertProxyRequest,
} from './types'

export const proxyApi = emptySplitApi.injectEndpoints({
  endpoints: (build) => ({
    getHealth: build.query<{ status: string }, void>({
      query: () => '/api/health',
    }),
    getProxies: build.query<ProxyListItemDto[], void>({
      query: () => '/api/proxies',
      providesTags: ['Proxies'],
    }),
    getProxy: build.query<ProxyDetailDto, string>({
      query: (id) => `/api/proxies/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Proxies', id }],
    }),
    createProxy: build.mutation<ProxyDetailDto, UpsertProxyRequest>({
      query: (body) => ({ url: '/api/proxies', method: 'POST', body }),
      invalidatesTags: ['Proxies'],
    }),
    updateProxy: build.mutation<ProxyDetailDto, { id: string; body: UpsertProxyRequest }>({
      query: ({ id, body }) => ({ url: `/api/proxies/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Proxies', 'Stats'],
    }),
    deleteProxy: build.mutation<void, string>({
      query: (id) => ({ url: `/api/proxies/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Proxies'],
    }),
    setMocksEnabled: build.mutation<ProxyDetailDto, { id: string; mocksEnabled: boolean }>({
      query: ({ id, mocksEnabled }) => ({
        url: `/api/proxies/${id}/mocks-enabled`,
        method: 'PUT',
        body: { mocksEnabled },
      }),
      invalidatesTags: ['Proxies', 'Mocks'],
    }),
    getMocks: build.query<MockDto[], string>({
      query: (proxyId) => `/api/proxies/${proxyId}/mocks`,
      providesTags: ['Mocks'],
    }),
    createMock: build.mutation<MockDto, { proxyId: string; body: MockDto }>({
      query: ({ proxyId, body }) => ({ url: `/api/proxies/${proxyId}/mocks`, method: 'POST', body }),
      invalidatesTags: ['Mocks', 'Proxies'],
    }),
    updateMock: build.mutation<MockDto, { proxyId: string; name: string; body: MockDto }>({
      query: ({ proxyId, name, body }) => ({
        url: `/api/proxies/${proxyId}/mocks/${encodeURIComponent(name)}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Mocks'],
    }),
    deleteMock: build.mutation<void, { proxyId: string; name: string }>({
      query: ({ proxyId, name }) => ({
        url: `/api/proxies/${proxyId}/mocks/${encodeURIComponent(name)}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Mocks', 'Proxies'],
    }),
    toggleMock: build.mutation<MockDto, { proxyId: string; name: string }>({
      query: ({ proxyId, name }) => ({
        url: `/api/proxies/${proxyId}/mocks/${encodeURIComponent(name)}/toggle`,
        method: 'POST',
      }),
      invalidatesTags: ['Mocks', 'Proxies'],
    }),
    uploadCertificate: build.mutation<UploadedCertificateDto, { proxyId: string; file: File }>({
      query: ({ proxyId, file }) => {
        const body = new FormData()
        body.append('file', file)
        return { url: `/api/proxies/${proxyId}/certificates`, method: 'POST', body }
      },
    }),
    getLogs: build.query<LogListDto, LogQueryArgs>({
      query: ({ proxyId, ...params }) => ({
        url: `/api/proxies/${proxyId}/logs`,
        params,
      }),
      providesTags: ['Logs'],
    }),
    getLog: build.query<LogDetailDto, { proxyId: string; entryId: number }>({
      query: ({ proxyId, entryId }) => `/api/proxies/${proxyId}/logs/${entryId}`,
      providesTags: ['Logs'],
    }),
    getStats: build.query<ProxyStatsDto, string>({
      query: (proxyId) => `/api/proxies/${proxyId}/stats`,
      providesTags: ['Stats'],
    }),
  }),
})

export const {
  useGetHealthQuery,
  useGetProxiesQuery,
  useGetProxyQuery,
  useCreateProxyMutation,
  useUpdateProxyMutation,
  useDeleteProxyMutation,
  useSetMocksEnabledMutation,
  useGetMocksQuery,
  useCreateMockMutation,
  useUpdateMockMutation,
  useDeleteMockMutation,
  useToggleMockMutation,
  useUploadCertificateMutation,
  useGetLogsQuery,
  useGetLogQuery,
  useGetStatsQuery,
} = proxyApi
