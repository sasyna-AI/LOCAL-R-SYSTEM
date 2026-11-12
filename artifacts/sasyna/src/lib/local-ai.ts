export type LocalModel = { id: string };

export type GenerationInput = {
  endpoint: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  signal?: AbortSignal;
};

function normalizeHost(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

export function isSasynaRunningLocally(): boolean {
  const host = normalizeHost(window.location.hostname);
  return ["localhost", "127.0.0.1", "::1"].includes(host);
}

export function localV1Endpoint(rawEndpoint: string): string {
  const url = new URL(rawEndpoint.trim());
  const host = normalizeHost(url.hostname);
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error("SASYNA only accepts a local LM Studio endpoint on this device.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Use the HTTP endpoint shown by LM Studio.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("The LM Studio address must not contain credentials or query values.");
  }

  const path = url.pathname.replace(/\/+$/, "");
  const v1Path = path.endsWith("/v1") ? path : `${path}/v1`;
  return `${url.origin}${v1Path}`;
}

export async function listLocalModels(rawEndpoint: string): Promise<LocalModel[]> {
  if (!isSasynaRunningLocally()) {
    throw new Error(
      "This hosted preview cannot connect to LM Studio on your laptop. Run SASYNA locally on Windows to check models.",
    );
  }
  const response = await fetch(`${localV1Endpoint(rawEndpoint)}/models`, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error(`LM Studio returned HTTP ${response.status}.`);
  const body = (await response.json()) as { data?: { id?: unknown }[] };
  return (body.data ?? [])
    .filter((item): item is { id: string } => typeof item.id === "string")
    .map(({ id }) => ({ id }));
}

export async function generateWithLocalModel({
  endpoint,
  model,
  systemPrompt,
  userPrompt,
  signal,
}: GenerationInput): Promise<string> {
  if (!isSasynaRunningLocally()) {
    throw new Error(
      "AI generation is disabled in the hosted preview. Run SASYNA locally on the same laptop as LM Studio.",
    );
  }
  if (!model.trim()) throw new Error("Select a model returned by LM Studio first.");

  const response = await fetch(`${localV1Endpoint(endpoint)}/chat/completions`, {
    method: "POST",
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
    referrerPolicy: "no-referrer",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model,
      temperature: 0.25,
      max_tokens: 2200,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `LM Studio returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ""}`,
    );
  }
  const body = (await response.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("LM Studio returned an empty response. No section was saved.");
  }
  return content.trim();
}
