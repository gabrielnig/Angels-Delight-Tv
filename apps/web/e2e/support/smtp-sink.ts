import net from 'node:net';

export interface Mail {
  to: string;
  data: string;
}

/**
 * A tiny SMTP receiver for end to end runs: accepts any mail, keeps it in memory. Not for anything but tests.
 * The app is pointed at it with SMTP_URL=smtp://127.0.0.1:<port>.
 */
export function startSmtpSink(port: number): Promise<{ mails: Mail[]; close(): Promise<void> }> {
  const mails: Mail[] = [];
  const server = net.createServer((socket) => {
    let inData = false;
    let to = '';
    let body = '';
    let buffer = '';
    socket.write('220 sink ESMTP\r\n');
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let index: number;
      while ((index = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (inData) {
          if (line === '.') {
            inData = false;
            mails.push({ to, data: body });
            body = '';
            socket.write('250 queued\r\n');
          } else {
            body += `${line.startsWith('..') ? line.slice(1) : line}\n`;
          }
          continue;
        }
        const upper = line.toUpperCase();
        if (upper.startsWith('EHLO')) socket.write('250-sink\r\n250 8BITMIME\r\n');
        else if (upper.startsWith('HELO')) socket.write('250 sink\r\n');
        else if (upper.startsWith('MAIL FROM')) socket.write('250 ok\r\n');
        else if (upper.startsWith('RCPT TO')) {
          to = line.replace(/^rcpt to:\s*<?/i, '').replace(/>.*$/, '');
          socket.write('250 ok\r\n');
        } else if (upper === 'DATA') {
          inData = true;
          socket.write('354 go\r\n');
        } else if (upper === 'QUIT') {
          socket.write('221 bye\r\n');
          socket.end();
        } else if (upper === 'RSET' || upper === 'NOOP') socket.write('250 ok\r\n');
        else socket.write('250 ok\r\n');
      }
    });
    socket.on('error', () => undefined);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () =>
      resolve({
        mails,
        close: () => new Promise((done) => server.close(() => done())),
      }),
    );
  });
}

/** The 6 digit code in the newest mail for an address. */
export function latestCode(mails: Mail[], address: string): string | null {
  for (const mail of [...mails].reverse()) {
    if (!mail.to.toLowerCase().includes(address.toLowerCase())) continue;
    const decoded = mail.data.replace(/=\r?\n/g, '').replace(/=3D/g, '=');
    const match = /\b(\d{6})\b/.exec(decoded);
    if (match) return match[1] ?? null;
  }
  return null;
}
