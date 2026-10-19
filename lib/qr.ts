export type QRPayload = {
  v: 1;
  event: string;
  title?: string;
  start?: string;
  end?: string;
};

export type QRPayloadInput = Omit<QRPayload, 'v'>;

export function buildQRPayload(payload: QRPayloadInput): string {
  return JSON.stringify({ v: 1, ...payload });
}

export function parseQRPayload(raw: string): QRPayload {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('Invalid QR code.');
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    !('v' in value) ||
    !('event' in value) ||
    value.v !== 1 ||
    typeof value.event !== 'string' ||
    !value.event.trim()
  ) {
    throw new Error('Not an attendance QR code.');
  }
  return {
    v: 1,
    event: value.event,
    ...('title' in value && typeof value.title === 'string' ? { title: value.title } : {}),
    ...('start' in value && typeof value.start === 'string' ? { start: value.start } : {}),
    ...('end' in value && typeof value.end === 'string' ? { end: value.end } : {}),
  };
}