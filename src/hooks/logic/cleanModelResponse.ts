/** Removes prompt-template tokens leaked by inference servers from a response. */
export function cleanModelResponse(content: string): string {
  if (!content) {
    return '';
  }

  let cleaned = content;
  const assistantMarkers = ['<｜Assistant｜>', '<|assistant|>', '### Assistant:'];
  let assistantMarkerFound = false;

  for (const marker of assistantMarkers) {
    const index = cleaned.lastIndexOf(marker);
    if (index !== -1) {
      cleaned = cleaned.slice(index + marker.length);
      assistantMarkerFound = true;
      break;
    }
  }

  const templateStartMarkers = [
    '<｜begin▁of▁sentence｜>',
    '<|begin_of_text|>',
    '<|begin▁of▁sentence|>',
    '<|system|>',
    '<|user|>',
  ];

  if (
    templateStartMarkers.some((marker) => content.includes(marker)) &&
    !assistantMarkerFound
  ) {
    return '';
  }

  return cleaned
    .replaceAll('<｜begin▁of▁sentence｜>', '')
    .replaceAll('<｜end▁of▁sentence｜>', '')
    .replaceAll('<|begin_of_text|>', '')
    .replaceAll('<|endoftext|>', '')
    .replaceAll('<|end|>', '')
    .replaceAll('<|eot_id|>', '')
    .replaceAll('<|eot|>', '')
    .trim();
}
