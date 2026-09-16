import { emptySplitApi } from './emptyApi'
import type {
  LogClearResultDto,
  LogDetailDto,
  LogListDto,
  GlobalLogQueryArgs,
  LogQueryArgs,
  LogStorageDto,
  LogTimelineDto,
  ManualSendRequestDto,
  CertificateDto,
  IgnoredPathDto,
  MockDto,
  MockSetDto,
  ProxyDetailDto,
  ProxyListItemDto,
  UploadedCertificateFileDto,
  UpsertProxyRequest,
  WindowsStoreCertificateDto,
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
      invalidatesTags: ['Proxies'],
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
    getMockSets: build.query<MockSetDto[], string>({
      query: (proxyId) => `/api/proxies/${proxyId}/mock-sets`,
      providesTags: ['MockSets'],
    }),
    createMockSet: build.mutation<MockSetDto, { proxyId: string; body: MockSetDto }>({
      query: ({ proxyId, body }) => ({ url: `/api/proxies/${proxyId}/mock-sets`, method: 'POST', body }),
      invalidatesTags: ['MockSets'],
    }),
    updateMockSet: build.mutation<MockSetDto, { proxyId: string; name: string; body: MockSetDto }>({
      query: ({ proxyId, name, body }) => ({
        url: `/api/proxies/${proxyId}/mock-sets/${encodeURIComponent(name)}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['MockSets'],
    }),
    deleteMockSet: build.mutation<void, { proxyId: string; name: string }>({
      query: ({ proxyId, name }) => ({
        url: `/api/proxies/${proxyId}/mock-sets/${encodeURIComponent(name)}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['MockSets'],
    }),
    applyMockSet: build.mutation<MockDto[], { proxyId: string; name: string }>({
      query: ({ proxyId, name }) => ({
        url: `/api/proxies/${proxyId}/mock-sets/${encodeURIComponent(name)}/apply`,
        method: 'POST',
      }),
      invalidatesTags: ['MockSets', 'Mocks', 'Proxies'],
    }),
    getIgnores: build.query<IgnoredPathDto[], string>({
      query: (proxyId) => `/api/proxies/${proxyId}/ignores`,
      providesTags: ['Ignores'],
    }),
    createIgnore: build.mutation<IgnoredPathDto, { proxyId: string; body: IgnoredPathDto }>({
      query: ({ proxyId, body }) => ({ url: `/api/proxies/${proxyId}/ignores`, method: 'POST', body }),
      invalidatesTags: ['Ignores'],
    }),
    updateIgnore: build.mutation<IgnoredPathDto, { proxyId: string; name: string; body: IgnoredPathDto }>({
      query: ({ proxyId, name, body }) => ({
        url: `/api/proxies/${proxyId}/ignores/${encodeURIComponent(name)}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Ignores'],
    }),
    deleteIgnore: build.mutation<void, { proxyId: string; name: string }>({
      query: ({ proxyId, name }) => ({
        url: `/api/proxies/${proxyId}/ignores/${encodeURIComponent(name)}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Ignores'],
    }),
    getCertificates: build.query<CertificateDto[], void>({
      query: () => '/api/certificates',
      providesTags: ['Certificates'],
    }),
    getWindowsStoreCertificates: build.query<
      WindowsStoreCertificateDto[],
      { location?: string; store?: string } | void
    >({
      query: (args) => {
        const location = args?.location ?? 'CurrentUser'
        const store = args?.store ?? 'My'
        return `/api/certificates/windows-store?location=${encodeURIComponent(location)}&store=${encodeURIComponent(store)}`
      },
    }),
    createCertificate: build.mutation<CertificateDto, CertificateDto>({
      query: (body) => ({ url: '/api/certificates', method: 'POST', body }),
      invalidatesTags: ['Certificates', 'Proxies'],
    }),
    updateCertificate: build.mutation<CertificateDto, { name: string; body: CertificateDto }>({
      query: ({ name, body }) => ({
        url: `/api/certificates/${encodeURIComponent(name)}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Certificates', 'Proxies'],
    }),
    deleteCertificate: build.mutation<void, string>({
      query: (name) => ({
        url: `/api/certificates/${encodeURIComponent(name)}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Certificates', 'Proxies'],
    }),
    uploadCertificate: build.mutation<UploadedCertificateFileDto, { file: File; name?: string }>({
      query: ({ file, name }) => {
        const body = new FormData()
        body.append('file', file)
        if (name?.trim()) {
          body.append('name', name.trim())
        }
        return { url: '/api/certificates/file', method: 'POST', body }
      },
    }),
    getGlobalLogs: build.query<LogListDto, GlobalLogQueryArgs>({
      query: ({ proxyIds, ...params }) => ({
        url: '/api/logs',
        params: { ...params, proxyIds },
      }),
      providesTags: ['Logs'],
    }),
    getGlobalLogTimeline: build.query<
      LogTimelineDto,
      { proxyIds: string[]; from?: string; to?: string; buckets?: number }
    >({
      query: ({ proxyIds, ...params }) => ({
        url: '/api/logs/timeline',
        params: { ...params, proxyIds },
      }),
      providesTags: ['Logs'],
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
    getLogStorage: build.query<LogStorageDto, string>({
      query: (proxyId) => `/api/proxies/${proxyId}/logs/storage`,
      providesTags: ['Logs'],
    }),
    getLogTimeline: build.query<
      LogTimelineDto,
      { proxyId: string; from?: string; to?: string; buckets?: number }
    >({
      query: ({ proxyId, ...params }) => ({
        url: `/api/proxies/${proxyId}/logs/timeline`,
        params,
      }),
      providesTags: ['Logs'],
    }),
    clearLogs: build.mutation<LogClearResultDto, { proxyId: string; from?: string; to?: string }>({
      query: ({ proxyId, ...params }) => ({
        url: `/api/proxies/${proxyId}/logs`,
        method: 'DELETE',
        params,
      }),
      invalidatesTags: ['Logs'],
    }),
    sendManualRequest: build.mutation<LogDetailDto, { proxyId: string; body: ManualSendRequestDto }>({
      query: ({ proxyId, body }) => ({ url: `/api/proxies/${proxyId}/send`, method: 'POST', body }),
      invalidatesTags: ['Logs'],
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
  useGetMockSetsQuery,
  useCreateMockSetMutation,
  useUpdateMockSetMutation,
  useDeleteMockSetMutation,
  useApplyMockSetMutation,
  useGetIgnoresQuery,
  useCreateIgnoreMutation,
  useUpdateIgnoreMutation,
  useDeleteIgnoreMutation,
  useGetCertificatesQuery,
  useGetWindowsStoreCertificatesQuery,
  useCreateCertificateMutation,
  useUpdateCertificateMutation,
  useDeleteCertificateMutation,
  useUploadCertificateMutation,
  useGetGlobalLogsQuery,
  useGetGlobalLogTimelineQuery,
  useGetLogsQuery,
  useGetLogQuery,
  useGetLogStorageQuery,
  useGetLogTimelineQuery,
  useClearLogsMutation,
  useSendManualRequestMutation,
} = proxyApi
