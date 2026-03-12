import fs from 'node:fs';
import path from 'node:path';
import vision from '@google-cloud/vision';

const DEFAULT_VISION_CREDENTIALS_FILE = 'src/data/aaron-ocr-488214-2f3e615a0344.json';

let visionClient: InstanceType<typeof vision.ImageAnnotatorClient> | null = null;

export function resolveVisionCredentialsPath(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): string | undefined {
  const configuredPath = env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (configuredPath) {
    return path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(cwd, configuredPath);
  }

  const bundledPath = path.resolve(cwd, DEFAULT_VISION_CREDENTIALS_FILE);
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  return undefined;
}

export function getVisionClientOptions(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
) {
  const keyFilename = resolveVisionCredentialsPath(env, cwd);
  return keyFilename ? { keyFilename } : {};
}

function getVisionClient() {
  if (!visionClient) {
    visionClient = new vision.ImageAnnotatorClient(getVisionClientOptions());
  }

  return visionClient;
}

export async function ocrImageUrl(imageUrl: string): Promise<string> {
  const [result] = await getVisionClient().textDetection({
    image: {
      source: {
        imageUri: imageUrl,
      },
    },
  });

  const annotations = result?.textAnnotations || [];
  const fullText = annotations[0]?.description || '';
  return fullText.trim();
}
