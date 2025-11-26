// functions/src/smartGenerateImage.ts
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenerativeAI, type Part, type Content } from "@google/generative-ai";
import { GoogleAuth } from "google-auth-library";
import { adminAuth } from "./firebaseAdmin";
import { chargeUserForCreation } from "./utils/billing";

// ────────────────────────────────────────────────────────────────────────────────
// Common config
// ────────────────────────────────────────────────────────────────────────────────
const HOST = "https://us-central1-aiplatform.googleapis.com";
const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "narratum";
const SERVICE_ACCOUNT = "vertex-runner@narratum.iam.gserviceaccount.com";

function setCors(res: any) {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
}

async function verifyAuth(req: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }
  const token = authHeader.split("Bearer ")[1];
  return await adminAuth.verifyIdToken(token);
}

interface VertexPredictResponse {
  predictions?: Array<{
    bytesBase64Encoded?: string;
  }>;
}

async function getToken(): Promise<string> {
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to obtain access token");
  return token;
}

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

export const generateWithGemini = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "1GiB",
    invoker: "public",
    secrets: [GEMINI_API_KEY],
  },
  async (req, res): Promise<void> => {
    if (req.method === "OPTIONS") {
      setCors(res);
      res.status(204).end();
      return;
    }

    try {
      setCors(res);

      let uid: string;
      try {
        const decoded = await verifyAuth(req);
        uid = decoded.uid;
      } catch (err) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // 💰 Freemium Charge (Images)
      await chargeUserForCreation(uid, 1, { 
        type: "image_generation_gemini", 
        description: "Generated 1 image with Gemini",
        resourceType: 'image'
      });

      const { prompt, images: inputImages } = (req.body ?? {}) as {
        prompt?: string;
        images?: string[];
      };

      if (!prompt) {
        res.status(400).json({ error: "Missing prompt" });
        return;
      }

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const modelsToTry = [
        "gemini-3-pro-image-preview",
        'gemini-2.5-flash-image',
        "gemini-2.5-flash-image-preview"
      ];
      
      const imageParts: Part[] = (inputImages ?? [])
        .filter((img) => img && img.startsWith("data:image/"))
        .map((imgDataUrl) => {
          const [header, data] = imgDataUrl.split(",");
          const mimeType = header.match(/:(.*?);/)?.[1] || "image/png";
          return { inlineData: { data, mimeType } };
        });
      const contents: Content[] = [{ role: "user", parts: [...imageParts, { text: prompt }] }];

      let result: any = null;
      let usedModel = "";
      let lastError: any = null;

      for (const modelName of modelsToTry) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          result = await model.generateContent({ contents });
          usedModel = modelName;
          break;
        } catch (err: any) {
          console.warn(`Model ${modelName} failed:`, err?.message || err);
          lastError = err;
        }
      }

      if (!result) throw lastError || new Error("All Gemini image models failed.");

      const response = result.response;
      const imagePart = response.candidates?.[0]?.content?.parts?.find(
        (p: any) => p?.inlineData
      ) as { inlineData?: { data?: string } } | undefined;

      if (!imagePart?.inlineData?.data) {
        throw new Error("The model did not return an image (possibly blocked by safety filters).");
      }

      res.status(200).json({
        model: usedModel,
        images: [imagePart.inlineData.data],
      });
    } catch (e: any) {
      console.error("Critical error in generateWithGemini:", e);
      if (e?.code === 'failed-precondition') {
        res.status(402).json({ error: e.message }); // Send billing error message to client
        return;
      }
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  }
);

const IMAGEN_MODELS = [
  "imagen-4.0-fast-generate-001",
  "imagen-4.0-generate-001",
  "imagen-3.0-fast-generate-001",
  "imagen-3.0-generate-002",
];

export const generateWithImagen = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "1GiB",
    serviceAccount: SERVICE_ACCOUNT,
    invoker: "public",
  },
  async (req, res): Promise<void> => {
    if (req.method === "OPTIONS") {
      setCors(res);
      res.status(204).end();
      return;
    }

    try {
      setCors(res);

      let uid: string;
      try {
        const decoded = await verifyAuth(req);
        uid = decoded.uid;
      } catch (err) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { prompt, count = 1, aspectRatio } = (req.body ?? {}) as {
        prompt?: string;
        count?: number;
        aspectRatio?: string;
      };

      if (!prompt) {
        res.status(400).json({ error: "Missing prompt" });
        return;
      }

      // 💰 Freemium Charge (Images)
      const quantity = Math.max(Number(count) || 1, 1);
      await chargeUserForCreation(uid, quantity, { 
        type: "image_generation_imagen", 
        description: `Generated ${quantity} image(s) with Imagen`,
        resourceType: 'image'
      });

      const token = await getToken();

      for (const model of IMAGEN_MODELS) {
        const url = `${HOST}/v1/projects/${PROJECT_ID}/locations/us-central1/publishers/google/models/${model}:predict`;
        const body = {
          instances: [{ prompt, ...(aspectRatio ? { aspectRatio } : {}) }],
          parameters: { sampleCount: quantity },
        };

        const r = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (r.ok) {
          const data = (await r.json()) as VertexPredictResponse;
          const images = data.predictions
            ?.map((p) => p?.bytesBase64Encoded)
            .filter(Boolean) as string[] | undefined;

          if (images?.length) {
            res.status(200).json({ model: `${model}@us-central1`, images });
            return;
          }
        } else {
          console.warn(`Imagen model ${model} HTTP ${r.status}`);
        }
      }

      res.status(503).json({ error: "All Imagen models were unavailable." });
    } catch (e: any) {
      console.error("Critical error in generateWithImagen:", e);
      if (e?.code === 'failed-precondition') {
        res.status(402).json({ error: e.message });
        return;
      }
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  }
);
