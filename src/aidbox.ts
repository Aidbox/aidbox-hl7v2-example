function getAidboxUrl(): string {
  return process.env.AIDBOX_URL || "http://localhost:8080";
}

function getCredentials(): string {
  const clientId = process.env.AIDBOX_CLIENT_ID || "root";
  const clientSecret = process.env.AIDBOX_CLIENT_SECRET || "Vbro4upIT1";
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`HTTP ${status}: ${body}`);
    this.name = "HttpError";
  }
}

export async function aidboxFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${getAidboxUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${getCredentials()}`,
      "Content-Type": "application/fhir+json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json() as Promise<T>;
}

export interface Bundle<T> {
  total?: number;
  entry?: Array<{ resource: T }>;
}

export async function getResources<T>(
  resourceType: string,
  params = "",
): Promise<T[]> {
  const bundle = await aidboxFetch<Bundle<T>>(
    `/fhir/${resourceType}?_count=100${params ? `&${params}` : ""}`,
  );
  return bundle.entry?.map((e) => e.resource) || [];
}

export async function putResource<T>(
  resourceType: string,
  id: string,
  resource: T,
): Promise<T> {
  return aidboxFetch<T>(`/fhir/${resourceType}/${id}`, {
    method: "PUT",
    body: JSON.stringify(resource),
  });
}

export class PreconditionFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreconditionFailedError";
  }
}

export class NotFoundError extends Error {
  constructor(resourceType: string, id: string) {
    super(`${resourceType}/${id} not found`);
    this.name = "NotFoundError";
  }
}

export interface ResourceWithETag<T> {
  resource: T;
  etag: string;
}

export async function getResourceWithETag<T>(
  resourceType: string,
  id: string,
): Promise<ResourceWithETag<T>> {
  const response = await fetch(`${getAidboxUrl()}/fhir/${resourceType}/${id}`, {
    headers: {
      Authorization: `Basic ${getCredentials()}`,
      "Content-Type": "application/fhir+json",
    },
  });

  if (response.status === 404) {
    throw new NotFoundError(resourceType, id);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const etag = response.headers.get("ETag") || "";
  const resource = (await response.json()) as T;

  return { resource, etag };
}

export async function updateResourceWithETag<T>(
  resourceType: string,
  id: string,
  resource: T,
  etag: string,
): Promise<T> {
  // Only include If-Match header when etag is present.
  // Some resource types (e.g., ConceptMap) may not have versioning enabled in Aidbox,
  // resulting in empty etag. In those cases, we skip optimistic locking.
  const headers: Record<string, string> = {
    Authorization: `Basic ${getCredentials()}`,
    "Content-Type": "application/fhir+json",
  };
  if (etag) {
    headers["If-Match"] = etag;
  }

  const response = await fetch(`${getAidboxUrl()}/fhir/${resourceType}/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(resource),
  });

  if (response.status === 412) {
    throw new PreconditionFailedError(
      `Resource ${resourceType}/${id} was modified by another process`,
    );
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}
