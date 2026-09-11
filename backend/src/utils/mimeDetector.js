'use strict';

/**
 * MimeDetector — Inspects binary magic byte headers of buffers.
 * Never trust client-provided Content-Type headers alone.
 */
class MimeDetector {
  /**
   * Detect real MIME type and file extension from a buffer.
   *
   * @param {Buffer} buffer
   * @returns {{ mimeType: string, extension: string, category: 'image'|'audio'|'video'|'document'|'unknown' } | null}
   */
  static detect(buffer) {
    if (!buffer || buffer.length < 4) {
      return null;
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return { mimeType: 'image/jpeg', extension: 'jpg', category: 'image' };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4E &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0D &&
      buffer[5] === 0x0A &&
      buffer[6] === 0x1A &&
      buffer[7] === 0x0A
    ) {
      return { mimeType: 'image/png', extension: 'png', category: 'image' };
    }

    // WebP: RIFF....WEBP (52 49 46 46 ... 57 45 42 50)
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
      return { mimeType: 'image/webp', extension: 'webp', category: 'image' };
    }

    // GIF: GIF87a (47 49 46 38 37 61) or GIF89a (47 49 46 38 39 61)
    if (
      buffer.length >= 6 &&
      buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38 &&
      (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61
    ) {
      return { mimeType: 'image/gif', extension: 'gif', category: 'image' };
    }

    // WAV: RIFF....WAVE (52 49 46 46 ... 57 41 56 45)
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x41 && buffer[10] === 0x56 && buffer[11] === 0x45
    ) {
      return { mimeType: 'audio/wav', extension: 'wav', category: 'audio' };
    }

    // FLAC: fLaC (66 4C 61 43)
    if (buffer[0] === 0x66 && buffer[1] === 0x4C && buffer[2] === 0x61 && buffer[3] === 0x43) {
      return { mimeType: 'audio/flac', extension: 'flac', category: 'audio' };
    }

    // Ogg container (audio/ogg): OggS (4F 67 67 53)
    if (buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
      return { mimeType: 'audio/ogg', extension: 'ogg', category: 'audio' };
    }

    // MP3 with ID3 tag: ID3 (49 44 33)
    if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
      return { mimeType: 'audio/mpeg', extension: 'mp3', category: 'audio' };
    }

    // MP3 raw frame sync: FF FB, FF F3, FF F2, FF E3
    if (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) {
      return { mimeType: 'audio/mpeg', extension: 'mp3', category: 'audio' };
    }

    // MP4 / M4A: ....ftyp (66 74 79 70 at offset 4)
    if (
      buffer.length >= 8 &&
      buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70
    ) {
      // Check brand for audio vs video
      const brand = buffer.toString('utf8', 8, 12);
      if (brand === 'M4A ' || brand === 'M4B ' || brand === 'm4a ') {
        return { mimeType: 'audio/mp4', extension: 'm4a', category: 'audio' };
      }
      return { mimeType: 'video/mp4', extension: 'mp4', category: 'video' };
    }

    // WebM / MKV: 1A 45 DF A3 (EBML ID)
    if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
      return { mimeType: 'audio/webm', extension: 'webm', category: 'audio' };
    }

    // PDF: %PDF (25 50 44 46)
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return { mimeType: 'application/pdf', extension: 'pdf', category: 'document' };
    }

    return null;
  }

  /**
   * Validate that buffer matches expected category (e.g. 'image', 'audio').
   */
  static validateCategory(buffer, expectedCategory) {
    const detected = this.detect(buffer);
    if (!detected || detected.category !== expectedCategory) {
      return {
        valid: false,
        error: `File content is not a valid ${expectedCategory}. Detected: ${detected?.mimeType || 'unknown'}`,
      };
    }
    return {
      valid: true,
      detected,
    };
  }
}

module.exports = MimeDetector;
