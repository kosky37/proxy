import { emptySplitApi as api } from "./emptyApi";
export const addTagTypes = ["Health", "Logs", "Mocks", "Proxies"] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getApiHealth: build.query<GetApiHealthApiResponse, GetApiHealthApiArg>({
        query: () => ({ url: `/api/health` }),
        providesTags: ["Health"],
      }),
      getApiProxiesByProxyIdLogs: build.query<
        GetApiProxiesByProxyIdLogsApiResponse,
        GetApiProxiesByProxyIdLogsApiArg
      >({
        query: (queryArg) => ({
          url: `/api/proxies/${queryArg.proxyId}/logs`,
          params: {
            from: queryArg["from"],
            to: queryArg.to,
            path: queryArg.path,
            mode: queryArg.mode,
            statusCode: queryArg.statusCode,
            protocol: queryArg.protocol,
            skip: queryArg.skip,
            take: queryArg.take,
          },
        }),
        providesTags: ["Logs"],
      }),
      getApiProxiesByProxyIdLogsAndEntryId: build.query<
        GetApiProxiesByProxyIdLogsAndEntryIdApiResponse,
        GetApiProxiesByProxyIdLogsAndEntryIdApiArg
      >({
        query: (queryArg) => ({
          url: `/api/proxies/${queryArg.proxyId}/logs/${queryArg.entryId}`,
        }),
        providesTags: ["Logs"],
      }),
      getApiProxiesByProxyIdStats: build.query<
        GetApiProxiesByProxyIdStatsApiResponse,
        GetApiProxiesByProxyIdStatsApiArg
      >({
        query: (queryArg) => ({
          url: `/api/proxies/${queryArg.proxyId}/stats`,
        }),
        providesTags: ["Logs"],
      }),
      getApiProxiesByProxyIdMocks: build.query<
        GetApiProxiesByProxyIdMocksApiResponse,
        GetApiProxiesByProxyIdMocksApiArg
      >({
        query: (queryArg) => ({
          url: `/api/proxies/${queryArg.proxyId}/mocks`,
        }),
        providesTags: ["Mocks"],
      }),
      postApiProxiesByProxyIdMocks: build.mutation<
        PostApiProxiesByProxyIdMocksApiResponse,
        PostApiProxiesByProxyIdMocksApiArg
      >({
        query: (queryArg) => ({
          url: `/api/proxies/${queryArg.proxyId}/mocks`,
          method: "POST",
          body: queryArg.mockDto,
        }),
        invalidatesTags: ["Mocks"],
      }),
      getApiProxiesByProxyIdMocksAndName: build.query<
        GetApiProxiesByProxyIdMocksAndNameApiResponse,
        GetApiProxiesByProxyIdMocksAndNameApiArg
      >({
        query: (queryArg) => ({
          url: `/api/proxies/${queryArg.proxyId}/mocks/${queryArg.name}`,
        }),
        providesTags: ["Mocks"],
      }),
      putApiProxiesByProxyIdMocksAndName: build.mutation<
        PutApiProxiesByProxyIdMocksAndNameApiResponse,
        PutApiProxiesByProxyIdMocksAndNameApiArg
      >({
        query: (queryArg) => ({
          url: `/api/proxies/${queryArg.proxyId}/mocks/${queryArg.name}`,
          method: "PUT",
          body: queryArg.mockDto,
        }),
        invalidatesTags: ["Mocks"],
      }),
      deleteApiProxiesByProxyIdMocksAndName: build.mutation<
        DeleteApiProxiesByProxyIdMocksAndNameApiResponse,
        DeleteApiProxiesByProxyIdMocksAndNameApiArg
      >({
        query: (queryArg) => ({
          url: `/api/proxies/${queryArg.proxyId}/mocks/${queryArg.name}`,
          method: "DELETE",
        }),
        invalidatesTags: ["Mocks"],
      }),
      postApiProxiesByProxyIdMocksAndNameToggle: build.mutation<
        PostApiProxiesByProxyIdMocksAndNameToggleApiResponse,
        PostApiProxiesByProxyIdMocksAndNameToggleApiArg
      >({
        query: (queryArg) => ({
          url: `/api/proxies/${queryArg.proxyId}/mocks/${queryArg.name}/toggle`,
          method: "POST",
        }),
        invalidatesTags: ["Mocks"],
      }),
      getApiProxies: build.query<GetApiProxiesApiResponse, GetApiProxiesApiArg>({
        query: () => ({ url: `/api/proxies` }),
        providesTags: ["Proxies"],
      }),
      postApiProxies: build.mutation<PostApiProxiesApiResponse, PostApiProxiesApiArg>({
        query: (queryArg) => ({
          url: `/api/proxies`,
          method: "POST",
          body: queryArg.upsertProxyRequest,
        }),
        invalidatesTags: ["Proxies"],
      }),
      getApiProxiesById: build.query<GetApiProxiesByIdApiResponse, GetApiProxiesByIdApiArg>({
        query: (queryArg) => ({ url: `/api/proxies/${queryArg.id}` }),
        providesTags: ["Proxies"],
      }),
      putApiProxiesById: build.mutation<PutApiProxiesByIdApiResponse, PutApiProxiesByIdApiArg>({
        query: (queryArg) => ({
          url: `/api/proxies/${queryArg.id}`,
          method: "PUT",
          body: queryArg.upsertProxyRequest,
        }),
        invalidatesTags: ["Proxies"],
      }),
      deleteApiProxiesById: build.mutation<
        DeleteApiProxiesByIdApiResponse,
        DeleteApiProxiesByIdApiArg
      >({
        query: (queryArg) => ({
          url: `/api/proxies/${queryArg.id}`,
          method: "DELETE",
        }),
        invalidatesTags: ["Proxies"],
      }),
      putApiProxiesByIdMocksEnabled: build.mutation<
        PutApiProxiesByIdMocksEnabledApiResponse,
        PutApiProxiesByIdMocksEnabledApiArg
      >({
        query: (queryArg) => ({
          url: `/api/proxies/${queryArg.id}/mocks-enabled`,
          method: "PUT",
          body: queryArg.mocksEnabledRequest,
        }),
        invalidatesTags: ["Proxies"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as generatedProxyApi };
export type GetApiHealthApiResponse = /** status 200 OK */ HealthDto;
export type GetApiHealthApiArg = void;
export type GetApiProxiesByProxyIdLogsApiResponse = /** status 200 OK */ LogListDto;
export type GetApiProxiesByProxyIdLogsApiArg = {
  proxyId: string;
  from?: string;
  to?: string;
  path?: string;
  mode?: string;
  statusCode?: number;
  protocol?: string;
  skip?: number;
  take?: number;
};
export type GetApiProxiesByProxyIdLogsAndEntryIdApiResponse = /** status 200 OK */ LogDetailDto;
export type GetApiProxiesByProxyIdLogsAndEntryIdApiArg = {
  proxyId: string;
  entryId: number;
};
export type GetApiProxiesByProxyIdStatsApiResponse = /** status 200 OK */ ProxyStatsDto;
export type GetApiProxiesByProxyIdStatsApiArg = {
  proxyId: string;
};
export type GetApiProxiesByProxyIdMocksApiResponse = /** status 200 OK */ MockDto[];
export type GetApiProxiesByProxyIdMocksApiArg = {
  proxyId: string;
};
export type PostApiProxiesByProxyIdMocksApiResponse = /** status 201 Created */ MockDto;
export type PostApiProxiesByProxyIdMocksApiArg = {
  proxyId: string;
  mockDto: MockDto;
};
export type GetApiProxiesByProxyIdMocksAndNameApiResponse = /** status 200 OK */ MockDto;
export type GetApiProxiesByProxyIdMocksAndNameApiArg = {
  proxyId: string;
  name: string;
};
export type PutApiProxiesByProxyIdMocksAndNameApiResponse = /** status 200 OK */ MockDto;
export type PutApiProxiesByProxyIdMocksAndNameApiArg = {
  proxyId: string;
  name: string;
  mockDto: MockDto;
};
export type DeleteApiProxiesByProxyIdMocksAndNameApiResponse = unknown;
export type DeleteApiProxiesByProxyIdMocksAndNameApiArg = {
  proxyId: string;
  name: string;
};
export type PostApiProxiesByProxyIdMocksAndNameToggleApiResponse = /** status 200 OK */ MockDto;
export type PostApiProxiesByProxyIdMocksAndNameToggleApiArg = {
  proxyId: string;
  name: string;
};
export type GetApiProxiesApiResponse = /** status 200 OK */ ProxyListItemDto[];
export type GetApiProxiesApiArg = void;
export type PostApiProxiesApiResponse = /** status 201 Created */ ProxyDetailDto;
export type PostApiProxiesApiArg = {
  upsertProxyRequest: UpsertProxyRequest;
};
export type GetApiProxiesByIdApiResponse = /** status 200 OK */ ProxyDetailDto;
export type GetApiProxiesByIdApiArg = {
  id: string;
};
export type PutApiProxiesByIdApiResponse = /** status 200 OK */ ProxyDetailDto;
export type PutApiProxiesByIdApiArg = {
  id: string;
  upsertProxyRequest: UpsertProxyRequest;
};
export type DeleteApiProxiesByIdApiResponse = unknown;
export type DeleteApiProxiesByIdApiArg = {
  id: string;
};
export type PutApiProxiesByIdMocksEnabledApiResponse = /** status 200 OK */ ProxyDetailDto;
export type PutApiProxiesByIdMocksEnabledApiArg = {
  id: string;
  mocksEnabledRequest: MocksEnabledRequest;
};
export type HealthDto = {
  status: string | null;
};
export type LogListItemDto = {
  id?: number;
  timestampUtc?: string;
  method: string | null;
  path: string | null;
  query?: string | null;
  protocol: string | null;
  statusCode?: number | null;
  durationMs?: number;
  mode: string | null;
  mockName?: string | null;
  error?: string | null;
};
export type LogListDto = {
  items: LogListItemDto[] | null;
  total: number;
};
export type ProblemDetails = {
  type?: string | null;
  title?: string | null;
  status?: number | null;
  detail?: string | null;
  instance?: string | null;
  [key: string]: any;
};
export type LogDetailDto = {
  id?: number;
  timestampUtc?: string;
  method: string | null;
  path: string | null;
  query?: string | null;
  protocol: string | null;
  statusCode?: number | null;
  durationMs?: number;
  mode: string | null;
  mockName?: string | null;
  error?: string | null;
  requestHeaders?: string | null;
  requestBody?: string | null;
  requestBodyTruncated?: boolean;
  responseHeaders?: string | null;
  responseBody?: string | null;
  responseBodyTruncated?: boolean;
};
export type ProxyStatsDto = {
  totalRequests?: number;
  mockRequests?: number;
  passthroughRequests?: number;
  averageDurationMs?: number;
  lastStatusCode?: number | null;
  lastRequestUtc?: string | null;
};
export type MockMatchDto = {
  methods?: string[] | null;
  path?: string | null;
  pathMode?: string | null;
  query?: {
    [key: string]: string;
  } | null;
  headers?: {
    [key: string]: string;
  } | null;
  bodyContains?: string | null;
  bodyRegex?: string | null;
  jsonPath?: string | null;
  jsonPathEquals?: string | null;
  soapAction?: string | null;
  operation?: string | null;
  xPath?: string | null;
};
export type MockResponseDto = {
  statusCode?: number;
  contentType?: string | null;
  headers?: {
    [key: string]: string;
  } | null;
  body?: string | null;
  bodyFile?: string | null;
  delayMs?: number;
};
export type MockDto = {
  name: string | null;
  fileName: string | null;
  enabled?: boolean;
  type: string | null;
  match?: MockMatchDto;
  response?: MockResponseDto;
};
export type ProxyListItemDto = {
  id: string | null;
  name: string | null;
  enabled?: boolean;
  listenUrl: string | null;
  destinationAddress: string | null;
  mocksEnabled?: boolean;
  mockCount?: number;
  enabledMockCount?: number;
};
export type CertificateDto = {
  pfxPath?: string | null;
  password?: string | null;
};
export type ListenDto = {
  url: string | null;
  pathPrefix?: string | null;
  hosts?: string[] | null;
  serverCertificate?: CertificateDto;
};
export type DestinationDto = {
  address: string | null;
  clientCertificate?: CertificateDto;
  acceptAnyServerCertificate?: boolean;
};
export type ProxyDetailDto = {
  id: string | null;
  name: string | null;
  enabled?: boolean;
  listen: ListenDto;
  destination: DestinationDto;
  mocksEnabled?: boolean;
  passthroughDelayMs?: number;
};
export type UpsertProxyRequest = {
  id?: string | null;
  name: string | null;
  enabled?: boolean;
  listen: ListenDto;
  destination: DestinationDto;
  mocksEnabled?: boolean;
  passthroughDelayMs?: number;
};
export type MocksEnabledRequest = {
  mocksEnabled?: boolean;
};
export const {
  useGetApiHealthQuery,
  useGetApiProxiesByProxyIdLogsQuery,
  useGetApiProxiesByProxyIdLogsAndEntryIdQuery,
  useGetApiProxiesByProxyIdStatsQuery,
  useGetApiProxiesByProxyIdMocksQuery,
  usePostApiProxiesByProxyIdMocksMutation,
  useGetApiProxiesByProxyIdMocksAndNameQuery,
  usePutApiProxiesByProxyIdMocksAndNameMutation,
  useDeleteApiProxiesByProxyIdMocksAndNameMutation,
  usePostApiProxiesByProxyIdMocksAndNameToggleMutation,
  useGetApiProxiesQuery,
  usePostApiProxiesMutation,
  useGetApiProxiesByIdQuery,
  usePutApiProxiesByIdMutation,
  useDeleteApiProxiesByIdMutation,
  usePutApiProxiesByIdMocksEnabledMutation,
} = injectedRtkApi;
