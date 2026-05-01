const base = () =>
  process.env.NEXT_PUBLIC_PIPELINE_API_URL ?? "https://api.almostcrackd.ai";

async function json<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 400)}`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON: ${text.slice(0, 200)}`);
  }
}

export async function generatePresignedUrl(
  token: string,
  contentType: string
): Promise<{ presignedUrl: string; cdnUrl: string }> {
  const res = await fetch(`${base()}/pipeline/generate-presigned-url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contentType }),
  });
  return json(res);
}

export async function putToPresignedUrl(
  url: string,
  body: ArrayBuffer,
  contentType: string
) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
  if (!res.ok) throw new Error(`S3 PUT ${res.status}: ${await res.text()}`);
}

export async function registerImageUrl(
  token: string,
  cdnUrl: string
): Promise<{ imageId: string }> {
  const res = await fetch(`${base()}/pipeline/upload-image-from-url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false }),
  });
  return json(res);
}

export async function generateCaptions(
  token: string,
  imageId: string,
  humorFlavorId?: number
): Promise<unknown> {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  async function request(body: { imageId: string; humorFlavorId?: number }) {
    const res = await fetch(`${base()}/pipeline/generate-captions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    return res;
  }

  const withFlavor =
    typeof humorFlavorId === "number" && Number.isFinite(humorFlavorId)
      ? { imageId, humorFlavorId }
      : null;

  if (withFlavor) {
    const first = await request(withFlavor);
    if (first.ok) return json(first);

    // Backward compatibility: some pipeline deployments still accept only imageId.
    const fallback = await request({ imageId });
    if (fallback.ok) return json(fallback);

    const firstText = await first.text();
    const fallbackText = await fallback.text();
    throw new Error(
      `generate-captions failed with and without humorFlavorId. first=${first.status}: ${firstText.slice(0, 300)} fallback=${fallback.status}: ${fallbackText.slice(0, 300)}`
    );
  }

  const res = await request({ imageId });
  return json(res);
}

/** Normalize caption payloads from the pipeline */
export function captionTexts(payload: unknown): string[] {
  const rows = Array.isArray(payload) ? payload : payload ? [payload] : [];
  const out: string[] = [];
  for (const row of rows) {
    if (typeof row === "string") {
      out.push(row);
      continue;
    }
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const cand =
      o.text ?? o.caption ?? o.caption_text ?? o.content ?? o.body;
    if (typeof cand === "string") out.push(cand);
    else if (cand && typeof cand === "object" && "text" in cand)
      out.push(String((cand as { text?: unknown }).text ?? ""));
  }
  return out.filter(Boolean);
}
