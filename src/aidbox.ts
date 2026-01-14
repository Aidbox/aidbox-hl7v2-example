const AIDBOX_URL = process.env.AIDBOX_URL || "http://localhost:8080";
const CLIENT_ID = process.env.AIDBOX_CLIENT_ID || "root";
const CLIENT_SECRET = process.env.AIDBOX_CLIENT_SECRET || "Vbro4upIT1";

const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
  "base64",
);

export async function aidboxFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${AIDBOX_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/fhir+json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
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

export interface ResourceWithETag<T> {
  resource: T;
  etag: string;
}

export async function getResourceWithETag<T>(
  resourceType: string,
  id: string,
): Promise<ResourceWithETag<T>> {
  const response = await fetch(`${AIDBOX_URL}/fhir/${resourceType}/${id}`, {
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/fhir+json",
    },
  });

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
  const response = await fetch(`${AIDBOX_URL}/fhir/${resourceType}/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/fhir+json",
      "If-Match": etag,
    },
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
