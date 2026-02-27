import vision from '@google-cloud/vision';

const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: '/etc/secrets/googleOcr.json',
});

export async function ocrImageUrl(imageUrl: string): Promise<string> {
  const [result] = await visionClient.textDetection({
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
