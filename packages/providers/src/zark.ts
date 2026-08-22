import { createHash } from "node:crypto";
import type { AIProviderAdapter, GenerateRequest, GenerateResult, ProviderModel, UsageRecord } from "@routie/domain";
import { assertCapability, ProviderRequestError, redactSecrets, toDataUrl } from "./base";

const DEFAULT_BASE_URL = "https://api.zarklab.ai";
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const models = [
  {
    id: "auto",
    label: "Zark Auto (Pilot)",
    capabilities: ["IMAGE"],
    lifecycle: "PREVIEW"
  }
] as const satisfies readonly ProviderModel[];

type ZarkMcpResponse = {
  jsonrpc?: string;
  id?: number | string | null;
  error?: { code?: string | number; message?: string; data?: unknown };
  result?: {
    isError?: boolean;
    structuredContent?: unknown;
    content?: Array<{ type?: string; text?: string }>;
  };
};

type ZarkGenerationResponse = {
  success?: boolean;
  run_id?: string;
  response?: string;
  generated_file_ids?: string[];
  media_items?: Array<{ file_id?: string; media_type?: string }>;
  usage?: { credits_used?: number; creditsUsed?: number };
  error?: string;
};

type ZarkFileResponse = {
  success?: boolean;
  file?: {
    file_id?: string;
    name?: string;
    content_type?: string;
    download_url?: string;
  };
};

type ZarkPilotEnvironment = {
  NODE_ENV?: string;
  ENABLE_ZARK_PROVIDER?: string;
  ZARK_PILOT_MONTHLY_IMAGE_LIMIT?: string | number;
};

export function isZarkPilotEnabled(environment: ZarkPilotEnvironment = process.env): boolean {
  return environment.NODE_ENV !== "production" && environment.ENABLE_ZARK_PROVIDER === "true";
}

export function zarkPilotMonthlyImageLimit(environment: ZarkPilotEnvironment = process.env): number {
  const parsed = Number(environment.ZARK_PILOT_MONTHLY_IMAGE_LIMIT ?? "25");
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 500) : 25;
}

function zarkBaseUrl(): string {
  const configured = process.env.ZARK_API_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const url = new URL(configured);
  const allowedHosts = new Set(["api.zarklab.ai", "dev-api.zarklab.ai"]);
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) {
    throw new Error("ZARK_API_BASE_URL must use an official Zark HTTPS endpoint");
  }
  return url.origin;
}

function stableSessionId(idempotencyKey: string): string {
  const digest = createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 32);
  return `sess_routie_${digest}`;
}

function stableRunId(idempotencyKey: string): string {
  const digest = createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 32);
  return `run_routie_${digest}`;
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

async function httpError(response: Response): Promise<ProviderRequestError> {
  const raw = (await response.text()).slice(0, 2_000);
  let providerCode = `HTTP_${response.status}`;
  let providerMessage = "";
  try {
    const parsed = JSON.parse(raw) as { code?: string; error?: string; message?: string };
    providerCode = parsed.code || providerCode;
    providerMessage = parsed.error || parsed.message || "";
  } catch {
    providerMessage = raw;
  }

  const friendlyMessage =
    response.status === 402
      ? "Kredit Zark tidak mencukupi. Tambahkan kredit atau tunggu kuota akun diperbarui."
      : response.status === 401 || response.status === 403
        ? "Kunci API Zark tidak valid atau sudah dicabut."
        : response.status >= 500
          ? "Layanan gambar Zark sedang mengalami gangguan. Routie akan mencoba sekali lagi secara aman."
        : providerMessage || `Zark request failed (${response.status})`;

  return new ProviderRequestError({
    code: providerCode,
    message: friendlyMessage,
    retryable: retryableStatus(response.status),
    provider: "ZARK",
    details: { httpStatus: response.status, sanitizedBody: redactSecrets(raw) }
  });
}

function parseMcpToolPayload<T>(response: ZarkMcpResponse): T {
  if (response.error) {
    throw new ProviderRequestError({
      code: `MCP_${response.error.code ?? "ERROR"}`,
      message: response.error.message || "Zark MCP menolak permintaan.",
      retryable: false,
      provider: "ZARK"
    });
  }

  const result = response.result;
  const text = result?.content?.find((item) => item.type === "text" && item.text)?.text;
  let payload = result?.structuredContent;
  if (!payload && text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { success: !result?.isError, response: text };
    }
  }
  if (!payload || result?.isError) {
    const message =
      typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : text || "Zark tidak dapat menyelesaikan permintaan gambar.";
    throw new ProviderRequestError({
      code: "MCP_TOOL_ERROR",
      message,
      retryable: false,
      provider: "ZARK"
    });
  }
  return payload as T;
}

async function callMcpTool<T>(
  apiKey: string,
  name: "zark_ai" | "get_file",
  args: Record<string, unknown>,
  timeoutMs: number
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${zarkBaseUrl()}/v1/mcp`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args }
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    throw new ProviderRequestError({
      code: "NETWORK_ERROR",
      message: "Routie tidak dapat terhubung ke layanan gambar Zark. Coba lagi beberapa saat lagi.",
      retryable: false,
      provider: "ZARK",
      details: { cause: error instanceof Error ? redactSecrets(error.message) : "network_error" }
    });
  }

  if (!response.ok) throw await httpError(response);
  let decoded: ZarkMcpResponse;
  try {
    decoded = (await response.json()) as ZarkMcpResponse;
  } catch {
    throw new ProviderRequestError({
      code: "INVALID_MCP_RESPONSE",
      message: "Zark mengirim respons yang tidak dapat dibaca.",
      retryable: false,
      provider: "ZARK"
    });
  }
  return parseMcpToolPayload<T>(decoded);
}

async function readLimitedBytes(response: Response): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_IMAGE_BYTES) throw new Error("Generated Zark image exceeds Routie's 25 MB limit");
  if (!response.body) throw new Error("Zark download returned an empty body");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) throw new Error("Generated Zark image exceeds Routie's 25 MB limit");
    chunks.push(value);
  }
  if (total === 0) throw new Error("Zark download returned an empty image");
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

async function downloadGeneratedImage(apiKey: string, fileId: string, chatSessionId: string): Promise<string> {
  const metadata = await callMcpTool<ZarkFileResponse>(
    apiKey,
    "get_file",
    { fileId, chatSessionId },
    30_000
  );
  const downloadUrl = metadata.file?.download_url;
  if (!downloadUrl) throw new Error("Zark returned no download URL for the generated image");
  const parsedDownloadUrl = new URL(downloadUrl);
  if (parsedDownloadUrl.protocol !== "https:") throw new Error("Zark returned an unsafe download URL");

  const downloadResponse = await fetch(parsedDownloadUrl, {
    signal: AbortSignal.timeout(60_000)
  });
  if (!downloadResponse.ok) {
    throw new ProviderRequestError({
      code: `DOWNLOAD_HTTP_${downloadResponse.status}`,
      message: "Gambar berhasil dibuat tetapi gagal diunduh dari penyimpanan Zark.",
      retryable: false,
      provider: "ZARK"
    });
  }

  const mimeType = (metadata.file?.content_type || downloadResponse.headers.get("content-type") || "")
    .split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (!mimeType || !ALLOWED_IMAGE_TYPES.has(mimeType)) throw new Error("Zark returned an unsupported image format");
  const bytes = await readLimitedBytes(downloadResponse);
  return toDataUrl(mimeType, bytes);
}

export class ZarkAdapter implements AIProviderAdapter {
  readonly provider = "ZARK" as const;

  listModels() {
    return models;
  }

  async validateCredential(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${zarkBaseUrl()}/v1/mcp`, {
        headers: { "X-API-Key": apiKey },
        signal: AbortSignal.timeout(20_000)
      });
      if (!response.ok) return false;
      const metadata = (await response.json()) as { tools?: string[] };
      return metadata.tools?.includes("zark_ai") === true && metadata.tools.includes("get_file");
    } catch {
      return false;
    }
  }

  async generate(apiKey: string, request: GenerateRequest): Promise<GenerateResult> {
    assertCapability(models, request.model, request.capability);
    if (request.inputAssetUrls?.length) {
      throw new ProviderRequestError({
        code: "REFERENCES_NOT_ENABLED",
        message: "Zark Pilot Routie saat ini hanya mendukung text-to-image tanpa gambar referensi.",
        retryable: false,
        provider: this.provider
      });
    }

    const chatSessionId = stableSessionId(request.idempotencyKey);
    const runId = stableRunId(request.idempotencyKey);
    const aspectRatio = request.aspectRatio ?? "1:1";
    const prompt = [
      `Create exactly one ${aspectRatio} social-media image. Return an image, not only a written concept or explanation.`,
      request.system,
      request.prompt
    ]
      .filter(Boolean)
      .join("\n\n");
    const generated = await callMcpTool<ZarkGenerationResponse>(
      apiKey,
      "zark_ai",
      {
        chatSessionId,
        wait: true,
        runId,
        prompt,
        fileIds: []
      },
      180_000
    );

    const fileIds = [
      ...(generated.generated_file_ids ?? []),
      ...(generated.media_items ?? [])
        .filter((item) => !item.media_type || item.media_type === "image")
        .map((item) => item.file_id)
        .filter((fileId): fileId is string => Boolean(fileId))
    ].filter((fileId, index, values) => values.indexOf(fileId) === index);

    if (generated.success === false || fileIds.length === 0) {
      throw new ProviderRequestError({
        code: "NO_IMAGE_OUTPUT",
        message: generated.error || "Zark menyelesaikan permintaan tanpa menghasilkan file gambar.",
        retryable: false,
        provider: this.provider
      });
    }

    const assetUrls = await Promise.all(
      fileIds.map((fileId) => downloadGeneratedImage(apiKey, fileId, chatSessionId))
    );
    const usage: UsageRecord = { images: fileIds.length };
    const credits = generated.usage?.credits_used ?? generated.usage?.creditsUsed;
    if (typeof credits === "number" && Number.isFinite(credits) && credits >= 0) usage.credits = credits;

    return {
      providerJobId: generated.run_id || fileIds[0]!,
      status: "COMPLETED",
      ...(generated.response ? { text: generated.response } : {}),
      assetUrls,
      usage
    };
  }
}
