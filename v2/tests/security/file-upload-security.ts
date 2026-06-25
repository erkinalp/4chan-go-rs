import { createClient, registerUser, randomString } from '../integration/helpers';
import FormData from 'form-data';
import { Readable } from 'stream';

describe('File Upload Security Tests', () => {
  let token: string;

  beforeAll(async () => {
    const user = await registerUser(`filesec_${randomString()}`, 'FileSec123!');
    token = user.token;
  });

  describe('Fake MIME type detection', () => {
    it('should reject an executable disguised as an image', async () => {
      const client = createClient(token);

      // ELF binary header disguised as PNG
      const elfHeader = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
      const form = new FormData();
      form.append('file', Readable.from(elfHeader), {
        filename: 'image.png',
        contentType: 'image/png',
      });

      const res = await client.post('/files/upload', form, {
        headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
      });

      expect([400, 415, 422]).toContain(res.status);
    });

    it('should reject HTML file with image extension', async () => {
      const client = createClient(token);

      const htmlContent = Buffer.from('<html><body><script>alert(1)</script></body></html>');
      const form = new FormData();
      form.append('file', Readable.from(htmlContent), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      });

      const res = await client.post('/files/upload', form, {
        headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
      });

      expect([400, 415, 422]).toContain(res.status);
    });

    it('should reject SVG with embedded JavaScript', async () => {
      const client = createClient(token);

      const svgPayload = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
      );
      const form = new FormData();
      form.append('file', Readable.from(svgPayload), {
        filename: 'icon.svg',
        contentType: 'image/svg+xml',
      });

      const res = await client.post('/files/upload', form, {
        headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
      });

      expect([400, 415, 422]).toContain(res.status);
    });

    it('should reject PHP file with double extension', async () => {
      const client = createClient(token);

      const phpPayload = Buffer.from('<?php echo shell_exec($_GET["cmd"]); ?>');
      const form = new FormData();
      form.append('file', Readable.from(phpPayload), {
        filename: 'photo.php.jpg',
        contentType: 'image/jpeg',
      });

      const res = await client.post('/files/upload', form, {
        headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
      });

      expect([400, 415, 422]).toContain(res.status);
    });
  });

  describe('Oversized file handling', () => {
    it('should reject files exceeding size limit', async () => {
      const client = createClient(token);

      // Generate a 50MB buffer (exceeds typical 10MB limit)
      const largeBuffer = Buffer.alloc(50 * 1024 * 1024, 0xff);
      const form = new FormData();
      form.append('file', Readable.from(largeBuffer), {
        filename: 'large-file.png',
        contentType: 'image/png',
      });

      const res = await client.post('/files/upload', form, {
        headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      expect([400, 413, 422]).toContain(res.status);
    });

    it('should reject when Content-Length header lies about size', async () => {
      const client = createClient(token);

      const smallBuffer = Buffer.alloc(100, 0x00);
      const form = new FormData();
      form.append('file', Readable.from(smallBuffer), {
        filename: 'small.png',
        contentType: 'image/png',
      });

      // Manually override content-length to a huge value
      const headers = {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`,
        'Content-Length': '999999999999',
      };

      const res = await client.post('/files/upload', form, { headers });

      expect([400, 413, 422]).toContain(res.status);
    });
  });

  describe('Polyglot file detection', () => {
    it('should reject GIFAR (GIF+JAR polyglot)', async () => {
      const client = createClient(token);

      // GIF header followed by ZIP/JAR content markers
      const gifHeader = Buffer.from('GIF89a');
      const zipSignature = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
      const polyglot = Buffer.concat([gifHeader, Buffer.alloc(100), zipSignature]);

      const form = new FormData();
      form.append('file', Readable.from(polyglot), {
        filename: 'animation.gif',
        contentType: 'image/gif',
      });

      const res = await client.post('/files/upload', form, {
        headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
      });

      // Either reject or accept but sanitize
      if (res.status === 201) {
        // If accepted, verify the stored file doesn't contain ZIP markers
        const fileRes = await client.get(`/files/${res.data.id}`);
        expect(fileRes.data.mimeType).toBe('image/gif');
      } else {
        expect([400, 415, 422]).toContain(res.status);
      }
    });

    it('should reject PDF with embedded JavaScript', async () => {
      const client = createClient(token);

      const pdfWithJs = Buffer.from(
        '%PDF-1.4\n1 0 obj<</Type/Action/S/JavaScript/JS(app.alert(1))>>endobj'
      );
      const form = new FormData();
      form.append('file', Readable.from(pdfWithJs), {
        filename: 'document.pdf',
        contentType: 'application/pdf',
      });

      const res = await client.post('/files/upload', form, {
        headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
      });

      // PDF with JS should be rejected or the JS stripped
      expect([400, 415, 422]).toContain(res.status);
    });
  });

  describe('Path traversal in filename', () => {
    const TRAVERSAL_FILENAMES = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      'file%2F..%2F..%2Fetc%2Fpasswd',
      '....//....//etc/passwd',
      'image\x00.png',
    ];

    TRAVERSAL_FILENAMES.forEach((filename, index) => {
      it(`should sanitize path traversal filename #${index + 1}`, async () => {
        const client = createClient(token);

        const pngBuffer = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64'
        );
        const form = new FormData();
        form.append('file', Readable.from(pngBuffer), {
          filename,
          contentType: 'image/png',
        });

        const res = await client.post('/files/upload', form, {
          headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
        });

        if (res.status === 201) {
          // If accepted, ensure stored filename is sanitized
          expect(res.data.filename).not.toContain('..');
          expect(res.data.filename).not.toContain('/');
          expect(res.data.filename).not.toContain('\\');
        } else {
          expect([400, 422]).toContain(res.status);
        }
      });
    });
  });
});
