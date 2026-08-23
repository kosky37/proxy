export interface CertificateDto {
  name: string
  fileName: string
  type: string
  pfxPath?: string | null
  password?: string | null
}

export interface UploadedCertificateFileDto {
  pfxPath?: string | null
}

export interface ListenDto {
  url: string
  pathPrefix?: string | null
  hosts?: string[] | null
  serverCertificateId?: string | null
}

export interface DestinationDto {
  address: string
  clientCertificateId?: string | null
  acceptAnyServerCertificate: boolean
}

export interface ProxyListItemDto {
  id: string
  name: string
  enabled: boolean
  listenUrl: string
  destinationAddress: string
  mocksEnabled: boolean
  mockCount: number
  enabledMockCount: number
}

export interface ProxyDetailDto {
  id: string
  name: string
  enabled: boolean
  listen: ListenDto
  destination: DestinationDto
  mocksEnabled: boolean
  passthroughDelayMs: number
}

export interface UpsertProxyRequest {
  id?: string | null
  name: string
  enabled: boolean
  listen: ListenDto
  destination: DestinationDto
  mocksEnabled: boolean
  passthroughDelayMs: number
}

export interface MockMatchDto {
  methods?: string[] | null
  path?: string | null
  pathMode: string
  query?: Record<string, string> | null
  headers?: Record<string, string> | null
  bodyContains?: string | null
  bodyRegex?: string | null
  jsonPath?: string | null
  jsonPathEquals?: string | null
  soapAction?: string | null
  operation?: string | null
  xpath?: string | null
}

export interface MockResponseDto {
  statusCode: number
  contentType?: string | null
  headers?: Record<string, string> | null
  body?: string | null
  bodyFile?: string | null
  delayMs: number
  block?: boolean
}

export interface IgnoredPathDto {
  name: string
  fileName: string
  path: string
  pathMode: string
  methods?: string[] | null
}

export interface MockDto {
  name: string
  fileName: string
  enabled: boolean
  type: string
  match: MockMatchDto
  response: MockResponseDto
}

export interface LogListItemDto {
  id: number
  timestampUtc: string
  method: string
  path: string
  query?: string | null
  protocol: string
  statusCode?: number | null
  durationMs: number
  mode: string
  mockName?: string | null
  error?: string | null
}

export interface LogDetailDto extends LogListItemDto {
  requestHeaders?: string | null
  requestBody?: string | null
  requestBodyTruncated: boolean
  responseHeaders?: string | null
  responseBody?: string | null
  responseBodyTruncated: boolean
}

export interface LogListDto {
  items: LogListItemDto[]
  total: number
}

export interface ProxyStatsDto {
  totalRequests: number
  mockRequests: number
  passthroughRequests: number
  averageDurationMs: number
  lastStatusCode?: number | null
  lastRequestUtc?: string | null
}

export interface LogQueryArgs {
  proxyId: string
  path?: string
  mode?: string
  protocol?: string
  statusCode?: number
  skip?: number
  take?: number
}
